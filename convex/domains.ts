import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireSaSession, requireSaWrite } from "./lib/auth";
import { audit } from "./lib/audit";
import {
  hostRestriction,
  isValidHostname,
  normalizeHost,
  resolveHostDecision,
} from "./lib/hosts";

export { normalizeHost } from "./lib/hosts";

const kindV = v.union(v.literal("primary"), v.literal("alias"));
const statusV = v.union(
  v.literal("pending"),
  v.literal("active"),
  v.literal("disabled"),
);

function platformRoot(): string {
  return normalizeHost(process.env.PLATFORM_ROOT_DOMAIN ?? "cigarro.in");
}

function defaultOrgSlug(): string {
  return process.env.DEFAULT_ORG_SLUG ?? "smokeshop";
}

// ---------- Public resolution ----------

// Returns only public routing fields. Never payment/bank config.
export const resolveByHost = query({
  args: { hostname: v.string() },
  handler: async (ctx, { hostname }) => {
    return await resolveHostDecision<Id<"organizations">>(
      hostname,
      {
        domainByHost: (host) =>
          ctx.db
            .query("orgDomains")
            .withIndex("by_hostname", (q) => q.eq("hostname", host))
            .unique(),
        activePrimaryHost: async (orgId) => {
          const rows = await ctx.db
            .query("orgDomains")
            .withIndex("by_org", (q) => q.eq("orgId", orgId))
            .collect();
          return (
            rows.find((r) => r.kind === "primary" && r.status === "active")
              ?.hostname ?? null
          );
        },
        orgBySlug: (slug) =>
          ctx.db
            .query("organizations")
            .withIndex("by_slug", (q) => q.eq("slug", slug))
            .unique(),
        orgById: (orgId) => ctx.db.get(orgId),
      },
      { platformRoot: platformRoot(), defaultOrgSlug: defaultOrgSlug() },
    );
  },
});

// ---------- Platform-admin management ----------

export const listDomains = query({
  args: { saToken: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, { saToken, orgId }) => {
    await requireSaSession(ctx, saToken);
    return await ctx.db
      .query("orgDomains")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
  },
});

export const addDomain = mutation({
  args: {
    saToken: v.string(),
    orgId: v.id("organizations"),
    hostname: v.string(),
    kind: kindV,
  },
  handler: async (ctx, { saToken, orgId, hostname, kind }) => {
    const sa = await requireSaWrite(ctx, saToken);
    const org = await ctx.db.get(orgId);
    if (!org) throw new ConvexError({ code: "ORG_NOT_FOUND" });

    const host = normalizeHost(hostname);
    if (!isValidHostname(host))
      throw new ConvexError({ code: "INVALID_HOSTNAME" });

    const restriction = hostRestriction(host, platformRoot());
    if (
      restriction === "reserved" ||
      (restriction === "platform" && kind === "primary")
    ) {
      throw new ConvexError({ code: "RESERVED_HOSTNAME", restriction });
    }

    const existing = await ctx.db
      .query("orgDomains")
      .withIndex("by_hostname", (q) => q.eq("hostname", host))
      .unique();
    if (existing) throw new ConvexError({ code: "DUPLICATE_HOSTNAME" });

    const demoted: string[] = [];
    if (kind === "primary") {
      const rows = await ctx.db
        .query("orgDomains")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect();
      for (const row of rows) {
        if (row.kind === "primary") {
          await ctx.db.patch(row._id, { kind: "alias" });
          demoted.push(row._id);
        }
      }
    }

    const id = await ctx.db.insert("orgDomains", {
      orgId,
      hostname: host,
      kind,
      status: "pending",
      createdAt: Date.now(),
    });
    await audit(ctx, {
      orgId,
      adminUserId: sa.adminId,
      actorType: "super_admin",
      action: "orgDomain.add",
      targetType: "orgDomain",
      targetId: id,
      payload: { hostname: host, kind, demotedPrimaryIds: demoted },
    });
    return id;
  },
});

export const setDomainStatus = mutation({
  args: { saToken: v.string(), domainId: v.id("orgDomains"), status: statusV },
  handler: async (ctx, { saToken, domainId, status }) => {
    const sa = await requireSaWrite(ctx, saToken);
    const row = await ctx.db.get(domainId);
    if (!row) throw new ConvexError({ code: "DOMAIN_NOT_FOUND" });

    const patch: { status: typeof status; verifiedAt?: number } = { status };
    if (status === "active" && row.verifiedAt === undefined)
      patch.verifiedAt = Date.now();
    await ctx.db.patch(domainId, patch);

    await audit(ctx, {
      orgId: row.orgId,
      adminUserId: sa.adminId,
      actorType: "super_admin",
      action: "orgDomain.setStatus",
      targetType: "orgDomain",
      targetId: domainId,
      payload: { hostname: row.hostname, from: row.status, to: status },
    });
    return domainId;
  },
});

export const removeDomain = mutation({
  args: { saToken: v.string(), domainId: v.id("orgDomains") },
  handler: async (ctx, { saToken, domainId }) => {
    const sa = await requireSaWrite(ctx, saToken);
    const row = await ctx.db.get(domainId);
    if (!row) throw new ConvexError({ code: "DOMAIN_NOT_FOUND" });

    await ctx.db.delete(domainId);
    await audit(ctx, {
      orgId: row.orgId,
      adminUserId: sa.adminId,
      actorType: "super_admin",
      action: "orgDomain.remove",
      targetType: "orgDomain",
      targetId: domainId,
      payload: { hostname: row.hostname, kind: row.kind, status: row.status },
    });
    return domainId;
  },
});

// ---------- Seed ----------

// Idempotent. Bypasses addDomain's reserved-host check on purpose: cigarro.in
// is the platform root and is the smokeshop primary by design.
export const seedSmokeshopDomains = internalMutation({
  args: {},
  handler: async (ctx) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", "smokeshop"))
      .unique();
    if (!org) throw new ConvexError({ code: "ORG_NOT_FOUND", slug: "smokeshop" });

    const existingRows = await ctx.db
      .query("orgDomains")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .collect();
    const hasPrimary = existingRows.some((r) => r.kind === "primary");

    const now = Date.now();
    const seeds = [
      { hostname: "cigarro.in", kind: "primary" as const },
      { hostname: "www.cigarro.in", kind: "alias" as const },
    ];
    const results: { hostname: string; action: string }[] = [];
    for (const seed of seeds) {
      const hit = await ctx.db
        .query("orgDomains")
        .withIndex("by_hostname", (q) => q.eq("hostname", seed.hostname))
        .unique();
      if (hit) {
        results.push({ hostname: seed.hostname, action: "exists" });
        continue;
      }
      if (seed.kind === "primary" && hasPrimary) {
        results.push({ hostname: seed.hostname, action: "skipped_other_primary" });
        continue;
      }
      await ctx.db.insert("orgDomains", {
        orgId: org._id,
        hostname: seed.hostname,
        kind: seed.kind,
        status: "active",
        createdAt: now,
        verifiedAt: now,
      });
      results.push({ hostname: seed.hostname, action: "inserted" });
    }
    return results;
  },
});
