import { ConvexError, v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import {
  action,
  ActionCtx,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  MutationCtx,
  query,
} from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requireSaSession, requireSaWrite } from "./lib/auth";
import { audit } from "./lib/audit";
import {
  hostRestriction,
  isCfManagedHost,
  isValidHostname,
  normalizeHost,
  resolveHostDecision,
} from "./lib/hosts";
import { appendStatusHistory, deriveDomainStatus } from "./lib/domainStatus";
import { cfConfig, type CfDomainState } from "./cloudflare";
import { LEGACY_ORG_SLUG } from "./lib/legacyOrg";

export { normalizeHost } from "./lib/hosts";

// Cloudflare polling: every 2 minutes, up to 30 attempts after the add.
const CF_POLL_MS = 2 * 60 * 1000;
const CF_MAX_POLLS = 30;
// Active domains are re-checked every 6h (catches DNS pointed away, SSL trouble).
// Non-active domains are re-checked on every monitor tick (every 15 min).
const ACTIVE_RECHECK_MS = 6 * 60 * 60 * 1000;

function platformRoot(): string {
  return normalizeHost(process.env.PLATFORM_ROOT_DOMAIN ?? "cigarro.in");
}

function defaultOrgSlug(): string {
  return process.env.DEFAULT_ORG_SLUG ?? LEGACY_ORG_SLUG;
}

// Hosts Cloudflare Pages must serve (customer hosts and store subdomains).
// The platform root and www.<root> are never sent to Cloudflare.
function isCfManaged(host: string): boolean {
  return isCfManagedHost(host, platformRoot());
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

type MonitorTarget = {
  _id: Id<"orgDomains">;
  hostname: string;
  status: Doc<"orgDomains">["status"];
  cfCheckedAt?: number;
};

const selfRef = {
  getRow: makeFunctionReference<
    "query",
    { domainId: Id<"orgDomains"> },
    Doc<"orgDomains"> | null
  >("domains:getDomainInternal"),
  listMonitorTargets: makeFunctionReference<"query", Record<string, never>, MonitorTarget[]>(
    "domains:listMonitorTargets",
  ),
  listStoreRows: makeFunctionReference<
    "query",
    { orgId: Id<"organizations"> },
    Doc<"orgDomains">[]
  >("domains:listStoreRows"),
  applyCf: makeFunctionReference<"mutation", ApplyArgs, null>("domains:applyCfState"),
  beginRefresh: makeFunctionReference<
    "mutation",
    { saToken: string; domainId: Id<"orgDomains"> },
    { hostname: string }
  >("domains:beginRefresh"),
  beginRemove: makeFunctionReference<
    "mutation",
    { saToken: string; domainId: Id<"orgDomains"> },
    { hostname: string; cfManaged: boolean; adminId: string }
  >("domains:beginRemove"),
  finishRemove: makeFunctionReference<
    "mutation",
    { domainId: Id<"orgDomains">; adminId: string; hostname: string },
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
    return rows.map((r) => ({ ...r, cfManaged: isCfManaged(r.hostname) }));
  },
});

// Every domain on every store, for the /sa domains monitor.
export const listAllDomains = query({
  args: { saToken: v.string() },
  handler: async (ctx, { saToken }) => {
    await requireSaSession(ctx, saToken);
    const rows = await ctx.db.query("orgDomains").collect();
    const orgs = new Map<string, Doc<"organizations">>();
    for (const org of await ctx.db.query("organizations").collect()) {
      orgs.set(org._id, org);
    }
    return rows.map((r) => {
      const org = orgs.get(r.orgId);
      return {
        ...r,
        cfManaged: isCfManaged(r.hostname),
        storeName: org?.name ?? "(missing store)",
        storeSlug: org?.slug ?? "",
        storeActive: org?.active ?? false,
      };
    });
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
    const cloudflare = isCfManaged(host);
    if (cloudflare) cfConfig();

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
      payload: { hostname: host, kind: "alias", cloudflare },
    });
    if (cloudflare) await ctx.scheduler.runAfter(0, selfRef.provision, { domainId: id });
    return id;
  },
});

// Creates the <slug>.<platform root> row (managed, registered on Cloudflare).
// Becomes primary when the store has none. Plain helper: called from
// createStore (platform.ts) and from provisionSubdomain below.
export async function ensureStoreSubdomain(
  ctx: MutationCtx,
  args: { orgId: Id<"organizations">; slug: string; adminId: string },
): Promise<{ created: boolean; hostname: string | null; reason: string | null }> {
  const root = platformRoot();
  const skip = (hostname: string | null, reason: string) => ({
    created: false,
    hostname,
    reason,
  });
  if (!root) return skip(null, "no_platform_root");
  // The legacy org is served on cigarro.in itself; it gets no subdomain row.
  if (args.slug === defaultOrgSlug()) return skip(null, "default_org");

  const hostname = `${args.slug}.${root}`;
  if (hostRestriction(hostname, root) !== "platform") return skip(hostname, "reserved_label");

  const existing = await ctx.db
    .query("orgDomains")
    .withIndex("by_hostname", (q) => q.eq("hostname", hostname))
    .unique();
  if (existing) return skip(hostname, "exists");

  const rows = await ctx.db
    .query("orgDomains")
    .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
    .collect();
  const kind = rows.some((r) => r.kind === "primary") ? "alias" : "primary";

  const id = await ctx.db.insert("orgDomains", {
    orgId: args.orgId,
    hostname,
    kind,
    status: "pending",
    managed: true,
    createdAt: Date.now(),
  });
  await audit(ctx, {
    orgId: args.orgId,
    adminUserId: args.adminId,
    actorType: "super_admin",
    action: "orgDomain.add",
    targetType: "orgDomain",
    targetId: id,
    payload: { hostname, kind, managed: true, cloudflare: true },
  });
  await ctx.scheduler.runAfter(0, selfRef.provision, { domainId: id });
  return { created: true, hostname, reason: null };
}

// "Provision subdomain" for stores created before auto-provisioning.
export const provisionSubdomain = mutation({
  args: { saToken: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, { saToken, orgId }) => {
    const sa = await requireSaWrite(ctx, saToken);
    const org = await ctx.db.get(orgId);
    if (!org) throw new ConvexError({ code: "ORG_NOT_FOUND" });
    return await ensureStoreSubdomain(ctx, { orgId, slug: org.slug, adminId: sa.adminId });
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

// Deletes the Cloudflare Pages domain first (a 404 counts as already gone),
// then the row. A Cloudflare failure leaves the row in place so the admin can
// retry. Removing the primary promotes the store subdomain (or, failing that,
// an active alias) so the store always has a canonical host.
export const removeDomain = action({
  args: { saToken: v.string(), domainId: v.id("orgDomains") },
  handler: async (ctx, { saToken, domainId }) => {
    const info = await ctx.runMutation(selfRef.beginRemove, { saToken, domainId });
    if (info.cfManaged) await ctx.runAction(cfRef.del, { hostname: info.hostname });
    await ctx.runMutation(selfRef.finishRemove, {
      domainId,
      adminId: info.adminId,
      hostname: info.hostname,
    });
    return domainId;
  },
});

// Internal: removes every domain of a store from Cloudflare and the table.
// Not wired to any UI yet (store deletion/archiving is not implemented).
export const releaseStoreDomains = internalAction({
  args: { orgId: v.id("organizations"), adminId: v.string() },
  handler: async (ctx, { orgId, adminId }) => {
    const rows = await ctx.runQuery(selfRef.listStoreRows, { orgId });
    const released: string[] = [];
    // Non-primary rows first so the primary is removed last and nothing is promoted.
    const ordered = [...rows].sort((a, b) => Number(a.kind === "primary") - Number(b.kind === "primary"));
    for (const row of ordered) {
      if (isCfManaged(row.hostname)) {
        await ctx.runAction(cfRef.del, { hostname: row.hostname });
      }
      await ctx.runMutation(selfRef.finishRemove, {
        domainId: row._id,
        adminId,
        hostname: row.hostname,
      });
      released.push(row.hostname);
    }
    return released;
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
    const state = await checkFromCf(ctx, domainId, hostname, { reAdd: true });
    return { cfStatus: state.status };
  },
});

// ---------- Cloudflare sync helpers ----------

async function recordState(
  ctx: ActionCtx,
  domainId: Id<"orgDomains">,
  state: CfDomainState,
): Promise<void> {
  const absent = state.status === "absent" || state.status === "deleted";
  await ctx.runMutation(selfRef.applyCf, {
    domainId,
    cfStatus: state.status,
    cfError: state.error,
    cfHostnameId: state.id,
    ...(absent
      ? {}
      : {
          dnsInstructions: {
            cnameTarget: state.cnameTarget,
            txtRecords: state.txtRecords,
          },
        }),
  });
}

// GET from Cloudflare (re-adding when absent if reAdd is set). Records the
// result; rethrows on failure after recording the error text on the row.
async function checkFromCf(
  ctx: ActionCtx,
  domainId: Id<"orgDomains">,
  hostname: string,
  opts: { reAdd: boolean },
): Promise<CfDomainState> {
  try {
    let state = await ctx.runAction(cfRef.get, { hostname });
    if (opts.reAdd && state.status === "absent") {
      state = await ctx.runAction(cfRef.add, { hostname });
    }
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

export const listStoreRows = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) =>
    ctx.db
      .query("orgDomains")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
});

export const listMonitorTargets = internalQuery({
  args: {},
  handler: async (ctx): Promise<MonitorTarget[]> => {
    const rows = await ctx.db.query("orgDomains").collect();
    return rows
      .filter((r) => isCfManaged(r.hostname))
      .map((r) => ({
        _id: r._id,
        hostname: r.hostname,
        status: r.status,
        cfCheckedAt: r.cfCheckedAt,
      }));
  },
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
    const cfManaged = isCfManaged(row.hostname);
    if (cfManaged) cfConfig();
    return { hostname: row.hostname, cfManaged, adminId: sa.adminId };
  },
});

export const finishRemove = internalMutation({
  args: {
    domainId: v.id("orgDomains"),
    adminId: v.string(),
    hostname: v.string(),
  },
  handler: async (ctx, { domainId, adminId, hostname }) => {
    const row = await ctx.db.get(domainId);
    if (!row) return null;

    // Never leave a store without a canonical host: promote the store
    // subdomain, else an active alias.
    let promotedHostname: string | null = null;
    if (row.kind === "primary") {
      const siblings = (
        await ctx.db
          .query("orgDomains")
          .withIndex("by_org", (q) => q.eq("orgId", row.orgId))
          .collect()
      ).filter((r) => r._id !== domainId);
      const next =
        siblings.find((r) => r.managed === true) ??
        siblings.find((r) => r.status === "active") ??
        null;
      if (next) {
        await ctx.db.patch(next._id, { kind: "primary" });
        promotedHostname = next.hostname;
      }
    }

    await ctx.db.delete(domainId);
    await audit(ctx, {
      orgId: row.orgId,
      adminUserId: adminId,
      actorType: "super_admin",
      action: "orgDomain.remove",
      targetType: "orgDomain",
      targetId: domainId,
      payload: {
        hostname,
        kind: row.kind,
        status: row.status,
        promotedHostname,
      },
    });
    return null;
  },
});

// Single writer for Cloudflare-derived state. Status follows Cloudflare on every
// check; every transition is written to adminAuditLog as a system action.
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

    const now = Date.now();
    const patch: Partial<Doc<"orgDomains">> = { cfCheckedAt: now, cfError: args.cfError };

    if (args.cfStatus !== undefined) {
      const cfStatus = args.cfStatus;
      let next = deriveDomainStatus(cfStatus);
      // An active domain that Cloudflare no longer reports active is an error,
      // not a quiet return to pending.
      if (row.status === "active" && next !== "active") next = "error";
      patch.cfStatus = cfStatus;
      if (args.cfHostnameId !== undefined) patch.cfHostnameId = args.cfHostnameId;
      if (args.dnsInstructions !== undefined) patch.dnsInstructions = args.dnsInstructions;
      if (next === "error" && !args.cfError) {
        patch.cfError =
          cfStatus === "absent"
            ? "Not registered on the Cloudflare Pages project"
            : `Cloudflare reports ${cfStatus}`;
      }
      if (next === "active") {
        patch.lastActiveAt = now;
        if (row.verifiedAt === undefined) patch.verifiedAt = now;
      }
      if (next !== row.status) {
        patch.status = next;
        patch.statusHistory = appendStatusHistory(row.statusHistory, {
          status: next,
          at: now,
          cfStatus,
        });
        await ctx.db.insert("adminAuditLog", {
          orgId: row.orgId,
          adminUserId: "system",
          action: "orgDomain.statusChange",
          targetType: "orgDomain",
          targetId: args.domainId,
          payload: { hostname: row.hostname, from: row.status, to: next, cfStatus },
          createdAt: now,
        });
      }
    }

    await ctx.db.patch(args.domainId, patch);
    return null;
  },
});

// Scheduled right after addDomain / ensureStoreSubdomain. Adds the domain on
// Cloudflare, then polls.
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
      const state = await checkFromCf(ctx, domainId, row.hostname, { reAdd: true });
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

// Cron (every 15 min, convex/crons.ts). Re-checks every non-active domain on
// each tick and every active domain at most once per 6h. GET only: a domain
// missing from Cloudflare is recorded as error, not silently re-added (Refresh
// now does that).
export const monitor = internalAction({
  args: {},
  handler: async (ctx) => {
    try {
      cfConfig();
    } catch {
      return null; // Cloudflare not configured: nothing to monitor.
    }
    const targets = await ctx.runQuery(selfRef.listMonitorTargets, {});
    const now = Date.now();
    for (const row of targets) {
      if (
        row.status === "active" &&
        row.cfCheckedAt !== undefined &&
        now - row.cfCheckedAt < ACTIVE_RECHECK_MS
      ) {
        continue;
      }
      try {
        await checkFromCf(ctx, row._id, row.hostname, { reAdd: false });
      } catch {
        // Error already recorded on the row.
      }
    }
    return null;
  },
});
