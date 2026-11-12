import { ConvexError, v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import {
  action,
  ActionCtx,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requireSaSession, requireSaWrite } from "./lib/auth";
import { audit } from "./lib/audit";
import {
  hostRestriction,
  isValidHostname,
  normalizeHost,
  resolveHostDecision,
} from "./lib/hosts";
import { cfConfig, type CfDomainState } from "./cloudflare";

export { normalizeHost } from "./lib/hosts";

const statusV = v.union(
  v.literal("pending"),
  v.literal("active"),
  v.literal("disabled"),
);

// Cloudflare polling: every 2 minutes, up to 30 attempts after the add.
const CF_POLL_MS = 2 * 60 * 1000;
const CF_MAX_POLLS = 30;

function platformRoot(): string {
  return normalizeHost(process.env.PLATFORM_ROOT_DOMAIN ?? "cigarro.in");
}

function defaultOrgSlug(): string {
  return process.env.DEFAULT_ORG_SLUG ?? "smokeshop";
}

// Customer-owned hosts are the only ones sent to Cloudflare. Platform hosts
// (cigarro.in, www, *.cigarro.in) are served by the platform itself.
function isCfManaged(host: string): boolean {
  return hostRestriction(host, platformRoot()) === "none";
}

// Cross-module references, typed by hand: the generated api predates these
// modules until `npx convex dev` codegen runs.
const cfRef = {
  add: makeFunctionReference<"action", { hostname: string }, CfDomainState>(
    "cloudflare:addPagesDomain",
  ),
  get: makeFunctionReference<"action", { hostname: string }, CfDomainState>(
    "cloudflare:getPagesDomain",
  ),
  del: makeFunctionReference<"action", { hostname: string }, CfDomainState>(
    "cloudflare:deletePagesDomain",
  ),
};

type ApplyArgs = {
  domainId: Id<"orgDomains">;
  cfStatus?: string;
  cfError?: string;
  cfHostnameId?: string;
  dnsInstructions?: { cnameTarget: string; txtRecords: { name: string; value: string }[] };
};

const selfRef = {
  getRow: makeFunctionReference<
    "query",
    { domainId: Id<"orgDomains"> },
    Doc<"orgDomains"> | null
  >("domains:getDomainInternal"),
  applyCf: makeFunctionReference<"mutation", ApplyArgs, null>("domains:applyCfState"),
  beginRefresh: makeFunctionReference<
    "mutation",
    { saToken: string; domainId: Id<"orgDomains"> },
    { hostname: string }
  >("domains:beginRefresh"),
  beginRemove: makeFunctionReference<
    "mutation",
    { saToken: string; domainId: Id<"orgDomains"> },
    {
      hostname: string;
      managed: boolean;
      adminId: string;
      orgId: Id<"organizations">;
      kind: "primary" | "alias";
      status: "pending" | "active" | "disabled";
    }
  >("domains:beginRemove"),
  finishRemove: makeFunctionReference<
    "mutation",
    {
      domainId: Id<"orgDomains">;
      adminId: string;
      orgId: Id<"organizations">;
      hostname: string;
      kind: "primary" | "alias";
      status: "pending" | "active" | "disabled";
    },
    null
  >("domains:finishRemove"),
  provision: makeFunctionReference<"action", { domainId: Id<"orgDomains"> }, null>(
    "domains:provisionDomain",
  ),
  poll: makeFunctionReference<
    "action",
    { domainId: Id<"orgDomains">; attempt: number },
    null
  >("domains:pollDomain"),
};

function errorText(err: unknown): string {
  const data = (err as { data?: { code?: string; message?: string } })?.data;
  if (data?.code) return data.message ? `${data.code}: ${data.message}` : data.code;
  return err instanceof Error ? err.message.slice(0, 300) : "CF_UNKNOWN_ERROR";
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
    const rows = await ctx.db
      .query("orgDomains")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return rows.map((r) => ({ ...r, managed: isCfManaged(r.hostname) }));
  },
});

// Always adds an alias. Primary is set only via setPrimary, after the domain
// is active on Cloudflare.
export const addDomain = mutation({
  args: {
    saToken: v.string(),
    orgId: v.id("organizations"),
    hostname: v.string(),
  },
  handler: async (ctx, { saToken, orgId, hostname }) => {
    const sa = await requireSaWrite(ctx, saToken);
    const org = await ctx.db.get(orgId);
    if (!org) throw new ConvexError({ code: "ORG_NOT_FOUND" });

    const host = normalizeHost(hostname);
    if (!isValidHostname(host))
      throw new ConvexError({ code: "INVALID_HOSTNAME" });

    const restriction = hostRestriction(host, platformRoot());
    if (restriction === "reserved") {
      throw new ConvexError({ code: "RESERVED_HOSTNAME", restriction });
    }

    const existing = await ctx.db
      .query("orgDomains")
      .withIndex("by_hostname", (q) => q.eq("hostname", host))
      .unique();
    if (existing) throw new ConvexError({ code: "DUPLICATE_HOSTNAME" });

    // Fail fast in the UI when Cloudflare is not configured.
    const managed = restriction === "none";
    if (managed) cfConfig();

    const id = await ctx.db.insert("orgDomains", {
      orgId,
      hostname: host,
      kind: "alias",
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
      payload: { hostname: host, kind: "alias", cloudflare: managed },
    });
    if (managed) await ctx.scheduler.runAfter(0, selfRef.provision, { domainId: id });
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

// Makes an active alias the store's primary and demotes the previous primary
// to alias, so the old host 301s to the new one.
export const setPrimary = mutation({
  args: { saToken: v.string(), domainId: v.id("orgDomains") },
  handler: async (ctx, { saToken, domainId }) => {
    const sa = await requireSaWrite(ctx, saToken);
    const row = await ctx.db.get(domainId);
    if (!row) throw new ConvexError({ code: "DOMAIN_NOT_FOUND" });
    if (row.status !== "active")
      throw new ConvexError({ code: "DOMAIN_NOT_ACTIVE" });
    if (!isCfManaged(row.hostname))
      throw new ConvexError({ code: "RESERVED_HOSTNAME" });
    if (row.kind === "primary") return domainId;

    const rows = await ctx.db
      .query("orgDomains")
      .withIndex("by_org", (q) => q.eq("orgId", row.orgId))
      .collect();
    const demoted: string[] = [];
    for (const other of rows) {
      if (other.kind === "primary" && other._id !== domainId) {
        await ctx.db.patch(other._id, { kind: "alias" });
        demoted.push(other.hostname);
      }
    }
    await ctx.db.patch(domainId, { kind: "primary" });

    await audit(ctx, {
      orgId: row.orgId,
      adminUserId: sa.adminId,
      actorType: "super_admin",
      action: "orgDomain.setPrimary",
      targetType: "orgDomain",
      targetId: domainId,
      payload: { hostname: row.hostname, demotedHostnames: demoted },
    });
    return domainId;
  },
});

// Removes the row and, for customer hosts, the Cloudflare Pages domain.
// A Cloudflare failure leaves the row in place so the admin can retry.
export const removeDomain = action({
  args: { saToken: v.string(), domainId: v.id("orgDomains") },
  handler: async (ctx, { saToken, domainId }) => {
    const info = await ctx.runMutation(selfRef.beginRemove, { saToken, domainId });
    if (info.managed) await ctx.runAction(cfRef.del, { hostname: info.hostname });
    await ctx.runMutation(selfRef.finishRemove, {
      domainId,
      adminId: info.adminId,
      orgId: info.orgId,
      hostname: info.hostname,
      kind: info.kind,
      status: info.status,
    });
    return domainId;
  },
});

// Re-reads the domain from Cloudflare. Re-adds it if it has gone missing there.
export const refreshDomainStatus = action({
  args: { saToken: v.string(), domainId: v.id("orgDomains") },
  handler: async (ctx, { saToken, domainId }) => {
    const { hostname } = await ctx.runMutation(selfRef.beginRefresh, {
      saToken,
      domainId,
    });
    const state = await syncFromCf(ctx, domainId, hostname);
    return { cfStatus: state.status };
  },
});

// ---------- Cloudflare sync helpers ----------

async function recordState(
  ctx: ActionCtx,
  domainId: Id<"orgDomains">,
  state: CfDomainState,
): Promise<void> {
  await ctx.runMutation(selfRef.applyCf, {
    domainId,
    cfStatus: state.status,
    cfError: state.error,
    cfHostnameId: state.id,
    dnsInstructions: { cnameTarget: state.cnameTarget, txtRecords: state.txtRecords },
  });
}

// GET from Cloudflare, re-adding when absent. Records the result; rethrows
// on failure after recording the error text on the row.
async function syncFromCf(
  ctx: ActionCtx,
  domainId: Id<"orgDomains">,
  hostname: string,
): Promise<CfDomainState> {
  try {
    let state = await ctx.runAction(cfRef.get, { hostname });
    if (state.status === "absent") state = await ctx.runAction(cfRef.add, { hostname });
    await recordState(ctx, domainId, state);
    return state;
  } catch (err) {
    await ctx.runMutation(selfRef.applyCf, { domainId, cfError: errorText(err) });
    throw err;
  }
}

export const getDomainInternal = internalQuery({
  args: { domainId: v.id("orgDomains") },
  handler: async (ctx, { domainId }) => ctx.db.get(domainId),
});

export const beginRefresh = internalMutation({
  args: { saToken: v.string(), domainId: v.id("orgDomains") },
  handler: async (ctx, { saToken, domainId }) => {
    await requireSaWrite(ctx, saToken);
    const row = await ctx.db.get(domainId);
    if (!row) throw new ConvexError({ code: "DOMAIN_NOT_FOUND" });
    if (!isCfManaged(row.hostname)) throw new ConvexError({ code: "NOT_CF_MANAGED" });
    cfConfig();
    return { hostname: row.hostname };
  },
});

export const beginRemove = internalMutation({
  args: { saToken: v.string(), domainId: v.id("orgDomains") },
  handler: async (ctx, { saToken, domainId }) => {
    const sa = await requireSaWrite(ctx, saToken);
    const row = await ctx.db.get(domainId);
    if (!row) throw new ConvexError({ code: "DOMAIN_NOT_FOUND" });
    const managed = isCfManaged(row.hostname);
    if (managed) cfConfig();
    return {
      hostname: row.hostname,
      managed,
      adminId: sa.adminId,
      orgId: row.orgId,
      kind: row.kind,
      status: row.status,
    };
  },
});

export const finishRemove = internalMutation({
  args: {
    domainId: v.id("orgDomains"),
    adminId: v.string(),
    orgId: v.id("organizations"),
    hostname: v.string(),
    kind: v.union(v.literal("primary"), v.literal("alias")),
    status: statusV,
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.domainId);
    if (row) await ctx.db.delete(args.domainId);
    await audit(ctx, {
      orgId: args.orgId,
      adminUserId: args.adminId,
      actorType: "super_admin",
      action: "orgDomain.remove",
      targetType: "orgDomain",
      targetId: args.domainId,
      payload: { hostname: args.hostname, kind: args.kind, status: args.status },
    });
    return null;
  },
});

export const applyCfState = internalMutation({
  args: {
    domainId: v.id("orgDomains"),
    cfStatus: v.optional(v.string()),
    cfError: v.optional(v.string()),
    cfHostnameId: v.optional(v.string()),
    dnsInstructions: v.optional(
      v.object({
        cnameTarget: v.string(),
        txtRecords: v.array(v.object({ name: v.string(), value: v.string() })),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.domainId);
    if (!row) return null;

    // Only pending rows auto-activate. An admin-disabled row stays disabled.
    const activate = args.cfStatus === "active" && row.status === "pending";
    await ctx.db.patch(args.domainId, {
      cfStatus: args.cfStatus,
      cfError: args.cfError,
      cfHostnameId: args.cfHostnameId ?? row.cfHostnameId,
      dnsInstructions: args.dnsInstructions,
      cfCheckedAt: Date.now(),
      ...(activate
        ? {
            status: "active" as const,
            verifiedAt: row.verifiedAt ?? Date.now(),
          }
        : {}),
    });
    return null;
  },
});

// Scheduled right after addDomain. Adds the domain on Cloudflare, then polls.
export const provisionDomain = internalAction({
  args: { domainId: v.id("orgDomains") },
  handler: async (ctx, { domainId }) => {
    const row = await ctx.runQuery(selfRef.getRow, { domainId });
    if (!row || row.status !== "pending") return null;

    let active = false;
    try {
      const state = await ctx.runAction(cfRef.add, { hostname: row.hostname });
      await recordState(ctx, domainId, state);
      active = state.status === "active";
    } catch (err) {
      await ctx.runMutation(selfRef.applyCf, { domainId, cfError: errorText(err) });
    }
    if (!active) {
      await ctx.scheduler.runAfter(CF_POLL_MS, selfRef.poll, { domainId, attempt: 1 });
    }
    return null;
  },
});

export const pollDomain = internalAction({
  args: { domainId: v.id("orgDomains"), attempt: v.number() },
  handler: async (ctx, { domainId, attempt }) => {
    const row = await ctx.runQuery(selfRef.getRow, { domainId });
    if (!row || row.status !== "pending") return null;

    let active = false;
    try {
      const state = await syncFromCf(ctx, domainId, row.hostname);
      active = state.status === "active";
    } catch {
      // Error already recorded on the row; keep polling.
    }
    if (!active && attempt < CF_MAX_POLLS) {
      await ctx.scheduler.runAfter(CF_POLL_MS, selfRef.poll, {
        domainId,
        attempt: attempt + 1,
      });
    }
    return null;
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
