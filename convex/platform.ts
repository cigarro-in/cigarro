import { ConvexError, v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { requireSaSession, requireSaWrite } from "./lib/auth";
import { audit } from "./lib/audit";
import { normalizePhoneE164 } from "./lib/phone";
import { role } from "./schema";
import { insertOrganization } from "./organizations";
import { pickUniqueBankAlias } from "./lib/bankAlias";
import { ensureStoreSubdomain } from "./domains";

// Super-admin (Citadel SSO) store management. Every function takes `saToken`:
// reads use requireSaSession, writes use requireSaWrite (write window + audit
// as actorType "super_admin", no orgId for platform-level rows).

const STORE_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;
// First path segments the admin host reserves for app/API routes (see
// functions/lib/org.js). A store with one of these slugs would be unreachable.
const RESERVED_SLUGS = new Set([
  "api",
  "assets",
  "icons",
  "fonts",
  "functions",
  "admin",
  "sa",
  "www",
]);

// ---------- migrations ----------

// Read-only view of the one-time migration ledger (convex/migrations.ts).
export const listMigrations = query({
  args: { saToken: v.string() },
  handler: async (ctx, { saToken }) => {
    await requireSaSession(ctx, saToken);
    const rows = await ctx.db.query("migrations").collect();
    return rows
      .map((r) => ({
        _id: r._id,
        name: r.name,
        status: r.status,
        result: r.result ?? null,
        runs: r.runs,
        updatedAt: r.updatedAt,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

// Manual trigger for the migration runner (convex/migrations.ts). Only the
// internal runner is referenced by path (generated api.d.ts omits this module).
const runPendingRef = makeFunctionReference<
  "action",
  Record<string, never>,
  Record<string, string>
>("migrations:runPending");
const authorizeMigrationRunRef = makeFunctionReference<
  "mutation",
  { saToken: string },
  null
>("platform:authorizeMigrationRun");

// Write-gated and audited check, run before the action starts the runner.
export const authorizeMigrationRun = internalMutation({
  args: { saToken: v.string() },
  handler: async (ctx, { saToken }) => {
    const sa = await requireSaWrite(ctx, saToken);
    await audit(ctx, {
      adminUserId: sa.adminId,
      actorType: "super_admin",
      action: "platform.migrations.run",
      targetType: "migrations",
      targetId: "pending",
    });
    return null;
  },
});

export const runPendingMigrations = action({
  args: { saToken: v.string() },
  handler: async (ctx, { saToken }): Promise<Record<string, string>> => {
    await ctx.runMutation(authorizeMigrationRunRef, { saToken });
    return await ctx.runAction(runPendingRef, {});
  },
});

// ---------- stores ----------

export const listStores = query({
  args: { saToken: v.string() },
  handler: async (ctx, { saToken }) => {
    await requireSaSession(ctx, saToken);
    const orgs = await ctx.db.query("organizations").collect();
    return await Promise.all(
      orgs.map(async (org) => {
        const domains = await ctx.db
          .query("orgDomains")
          .withIndex("by_org", (q) => q.eq("orgId", org._id))
          .collect();
        const members = await ctx.db
          .query("memberships")
          .withIndex("by_org_user", (q) => q.eq("orgId", org._id))
          .collect();
        const primary = domains.find((d) => d.kind === "primary") ?? null;
        return {
          _id: org._id,
          slug: org.slug,
          name: org.name,
          active: org.active,
          upiVpa: org.upiVpa,
          bankEmailAlias: org.bankEmailAlias,
          createdAt: org.createdAt,
          domainCount: domains.length,
          memberCount: members.length,
          primaryHost: primary?.hostname ?? null,
          primaryStatus: primary?.status ?? null,
        };
      }),
    );
  },
});

export const createStore = mutation({
  args: {
    saToken: v.string(),
    slug: v.string(),
    name: v.string(),
    upiVpa: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sa = await requireSaWrite(ctx, args.saToken);
    const slug = args.slug.trim().toLowerCase();
    if (!STORE_SLUG_RE.test(slug) || RESERVED_SLUGS.has(slug)) {
      throw new ConvexError({ code: "INVALID_SLUG" });
    }
    const name = args.name.trim();
    if (!name || name.length > 80) throw new ConvexError({ code: "INVALID_NAME" });

    // The bank alias starts from the slug. An empty VPA is allowed here; the store
    // must set one (updateSettings) before it takes payments.
    // Never reuse an alias that already routes bank email to another org
    // (the legacy org owns `smokeshop`-era aliases); suffix -2, -3, ... instead.
    const bankEmailAlias = await pickUniqueBankAlias(ctx, slug);
    const orgId = await insertOrganization(ctx, {
      slug,
      name,
      upiVpa: (args.upiVpa ?? "").trim(),
      bankEmailAlias,
    });
    // <slug>.<platform root>: registered on Cloudflare, primary while the store has none.
    await ensureStoreSubdomain(ctx, { orgId, slug, adminId: sa.adminId });
    await audit(ctx, {
      adminUserId: sa.adminId,
      actorType: "super_admin",
      action: "platform.store.create",
      targetType: "organization",
      targetId: orgId,
      payload: { slug, name },
    });
    return orgId;
  },
});

export const setStoreActive = mutation({
  args: { saToken: v.string(), orgId: v.id("organizations"), active: v.boolean() },
  handler: async (ctx, { saToken, orgId, active }) => {
    const sa = await requireSaWrite(ctx, saToken);
    const org = await ctx.db.get(orgId);
    if (!org) throw new ConvexError({ code: "ORG_NOT_FOUND" });
    await ctx.db.patch(orgId, { active });
    await audit(ctx, {
      adminUserId: sa.adminId,
      actorType: "super_admin",
      action: "platform.store.setActive",
      targetType: "organization",
      targetId: orgId,
      payload: { slug: org.slug, from: org.active, to: active },
    });
    return orgId;
  },
});

// ---------- members ----------

export const listMembers = query({
  args: { saToken: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, { saToken, orgId }) => {
    await requireSaSession(ctx, saToken);
    const rows = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId))
      .collect();
    return await Promise.all(
      rows.map(async (m) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_user", (q) => q.eq("userId", m.userId))
          .first();
        return {
          _id: m._id,
          userId: m.userId,
          role: m.role,
          phone: user?.phone ?? null,
          name: user?.name ?? null,
          createdAt: m.createdAt,
        };
      }),
    );
  },
});

// Finds or creates the store-scoped user row for (orgId, phone), the same way
// userState.resolvePhoneIdentity does, then upserts the membership.
export const addStoreAdmin = mutation({
  args: {
    saToken: v.string(),
    orgId: v.id("organizations"),
    phone: v.string(),
    role,
  },
  handler: async (ctx, { saToken, orgId, phone, role: memberRole }) => {
    const sa = await requireSaWrite(ctx, saToken);
    const org = await ctx.db.get(orgId);
    if (!org) throw new ConvexError({ code: "ORG_NOT_FOUND" });
    const e164 = normalizePhoneE164(phone);
    if (!e164) throw new ConvexError({ code: "INVALID_PHONE" });

    const now = Date.now();
    let user = await ctx.db
      .query("users")
      .withIndex("by_org_phone", (q) => q.eq("orgId", orgId).eq("phone", e164))
      .first();
    if (!user) {
      const userId = crypto.randomUUID();
      const id = await ctx.db.insert("users", {
        userId,
        orgId,
        phone: e164,
        createdAt: now,
        updatedAt: now,
      });
      user = (await ctx.db.get(id))!;
    }

    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", user!.userId))
      .unique();
    let membershipId;
    if (existing) {
      await ctx.db.patch(existing._id, { role: memberRole });
      membershipId = existing._id;
    } else {
      membershipId = await ctx.db.insert("memberships", {
        orgId,
        userId: user.userId,
        role: memberRole,
        createdAt: now,
      });
    }

    await audit(ctx, {
      orgId,
      adminUserId: sa.adminId,
      actorType: "super_admin",
      action: "platform.member.upsert",
      targetType: "membership",
      targetId: membershipId,
      payload: { slug: org.slug, userId: user.userId, role: memberRole },
    });
    return { membershipId, userId: user.userId };
  },
});

export const removeMember = mutation({
  args: { saToken: v.string(), membershipId: v.id("memberships") },
  handler: async (ctx, { saToken, membershipId }) => {
    const sa = await requireSaWrite(ctx, saToken);
    const m = await ctx.db.get(membershipId);
    if (!m) throw new ConvexError({ code: "MEMBER_NOT_FOUND" });
    if (m.role === "owner") {
      const owners = await ctx.db
        .query("memberships")
        .withIndex("by_org_role", (q) => q.eq("orgId", m.orgId).eq("role", "owner"))
        .collect();
      if (owners.length <= 1) throw new ConvexError({ code: "LAST_OWNER" });
    }
    await ctx.db.delete(membershipId);
    await audit(ctx, {
      orgId: m.orgId,
      adminUserId: sa.adminId,
      actorType: "super_admin",
      action: "platform.member.remove",
      targetType: "membership",
      targetId: membershipId,
      payload: { userId: m.userId, role: m.role },
    });
    return membershipId;
  },
});
