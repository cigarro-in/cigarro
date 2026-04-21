import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireIdentity, requireOrgAdmin } from "./lib/auth";
import { role } from "./schema";

const DEFAULT_SLOT_TIMEOUT_MS = 10 * 60 * 1000; // 10 min — UPI payment window
const DEFAULT_QUARANTINE_MS = 20 * 60 * 1000; // 20 min — grace for late UPI arrivals
const DEFAULT_SLOTS_PER_BASE = 100;

// ---------- Public queries ----------

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!org) return null;
    // Don't leak inactive org details
    if (!org.active) return null;
    return {
      _id: org._id,
      slug: org.slug,
      name: org.name,
      upiVpa: org.upiVpa,
      walletEnabled: org.walletEnabled,
    };
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
    const orgs = await Promise.all(
      memberships.map(async (m) => {
        const org = await ctx.db.get(m.orgId);
        return org ? { org, role: m.role } : null;
      }),
    );
    return orgs.filter((x): x is NonNullable<typeof x> => x !== null);
  },
});

// ---------- Admin ----------

export const listMembers = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireOrgAdmin(ctx, orgId);
    return await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId))
      .collect();
  },
});

export const addMember = mutation({
  args: {
    orgId: v.id("organizations"),
    userId: v.string(),
    role,
  },
  handler: async (ctx, args) => {
    await requireOrgAdmin(ctx, args.orgId);
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", args.orgId).eq("userId", args.userId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { role: args.role });
      return existing._id;
    }
    return await ctx.db.insert("memberships", {
      orgId: args.orgId,
      userId: args.userId,
      role: args.role,
      createdAt: Date.now(),
    });
  },
});

export const updateSettings = mutation({
  args: {
    orgId: v.id("organizations"),
    upiVpa: v.optional(v.string()),
    walletEnabled: v.optional(v.boolean()),
    slotTimeoutMs: v.optional(v.number()),
    quarantineMs: v.optional(v.number()),
    slotsPerBase: v.optional(v.number()),
    gasWebhookUrl: v.optional(v.string()),
    gasWebhookSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOrgAdmin(ctx, args.orgId);
    const patch: Record<string, unknown> = {};
    if (args.upiVpa !== undefined) patch.upiVpa = args.upiVpa;
    if (args.walletEnabled !== undefined)
      patch.walletEnabled = args.walletEnabled;
    if (args.slotTimeoutMs !== undefined) {
      if (args.slotTimeoutMs < 60_000 || args.slotTimeoutMs > 60 * 60_000)
        throw new ConvexError({ code: "TIMEOUT_OUT_OF_RANGE" });
      patch.slotTimeoutMs = args.slotTimeoutMs;
    }
    if (args.quarantineMs !== undefined) {
      if (args.quarantineMs < 0 || args.quarantineMs > 24 * 60 * 60_000)
        throw new ConvexError({ code: "QUARANTINE_OUT_OF_RANGE" });
      patch.quarantineMs = args.quarantineMs;
    }
    if (args.slotsPerBase !== undefined) {
      if (!Number.isInteger(args.slotsPerBase) || args.slotsPerBase < 10 || args.slotsPerBase > 1000)
        throw new ConvexError({ code: "SLOTS_OUT_OF_RANGE" });
      patch.slotsPerBase = args.slotsPerBase;
    }
    if (args.gasWebhookUrl !== undefined) {
      const v = args.gasWebhookUrl.trim();
      if (v && !/^https:\/\/script\.google(?:usercontent)?\.com\//i.test(v))
        throw new ConvexError({ code: "INVALID_GAS_URL" });
      patch.gasWebhookUrl = v || undefined;
    }
    if (args.gasWebhookSecret !== undefined) {
      const v = args.gasWebhookSecret.trim();
      if (v && v.length < 20)
        throw new ConvexError({ code: "SECRET_TOO_SHORT" });
      patch.gasWebhookSecret = v || undefined;
    }
    await ctx.db.patch(args.orgId, patch);
  },
});

export const getSettings = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireOrgAdmin(ctx, orgId);
    const org = await ctx.db.get(orgId);
    if (!org) return null;
    return {
      upiVpa: org.upiVpa,
      walletEnabled: org.walletEnabled,
      slotTimeoutMs: org.slotTimeoutMs,
      quarantineMs: org.quarantineMs,
      slotsPerBase: org.slotsPerBase,
      bankEmailAlias: org.bankEmailAlias,
      gasWebhookUrl: org.gasWebhookUrl ?? null,
      gasConnected: !!(org.gasWebhookUrl && org.gasWebhookSecret),
    };
  },
});

// ---------- Seed (one-time bootstrap; callable via `npx convex run`) ----------
//
// Example:
//   npx convex run organizations:seedOrg '{"slug":"cigarro","name":"Cigarro",
//     "upiVpa":"cigarro@ybl","bankEmailAlias":"cigarro",
//     "ownerUserId":"<supabase-user-id>"}'
//
// Marked as internal mutation so it's not exposed over the public API.

export const seedOrg = internalMutation({
  args: {
    slug: v.string(),
    name: v.string(),
    upiVpa: v.string(),
    bankEmailAlias: v.string(),
    ownerUserId: v.string(),
    walletEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) throw new ConvexError({ code: "SLUG_TAKEN" });

    const aliasConflict = await ctx.db
      .query("organizations")
      .withIndex("by_alias", (q) => q.eq("bankEmailAlias", args.bankEmailAlias))
      .unique();
    if (aliasConflict) throw new ConvexError({ code: "ALIAS_TAKEN" });

    const orgId = await ctx.db.insert("organizations", {
      slug: args.slug,
      name: args.name,
      upiVpa: args.upiVpa,
      bankEmailAlias: args.bankEmailAlias,
      walletEnabled: args.walletEnabled ?? true,
      slotTimeoutMs: DEFAULT_SLOT_TIMEOUT_MS,
      quarantineMs: DEFAULT_QUARANTINE_MS,
      slotsPerBase: DEFAULT_SLOTS_PER_BASE,
      active: true,
      createdAt: Date.now(),
    });

    await ctx.db.insert("memberships", {
      orgId,
      userId: args.ownerUserId,
      role: "owner",
      createdAt: Date.now(),
    });

    return { orgId };
  },
});
