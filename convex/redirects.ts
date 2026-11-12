import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireOrgAdminBySlug } from "./lib/org";
import {
  normalizeFromPath,
  normalizePath,
  normalizeTarget,
  parseStatus,
  resolveFinalTarget,
  type RedirectEdge,
  type RedirectStatus,
} from "./lib/redirectPaths";

// Per-store 301/302/410 redirects. Every write goes through planRedirects,
// which keeps two invariants per org:
//   1. No stored toPath is itself a fromPath (chains collapse to the final
//      target; existing rows pointing at a newly-redirected path are repointed).
//   2. No loops.
// Tables are empty for new orgs, so every read here must tolerate no rows.

type RedirectSource = "manual" | "import" | "slug_change";
type Incoming = {
  idx: number;
  fromPath: string;
  toPath: string;
  status: RedirectStatus;
  source: RedirectSource;
};
type PlanResult =
  | { ok: true; toPath: string; status: RedirectStatus }
  | { ok: false; code: string; error: string };

const MAX_IMPORT_ROWS = 2000;

// Entity paths that are served live. A redirect may not shadow a live page.
const LIVE_PREFIXES = [
  ["/product/", "catalogProducts"],
  ["/blog/", "blogPosts"],
  ["/brand/", "catalogBrands"],
  ["/category/", "catalogCategories"],
] as const;

const KIND_PREFIX = {
  product: "/product/",
  blog: "/blog/",
  brand: "/brand/",
  category: "/category/",
} as const;
export type RedirectKind = keyof typeof KIND_PREFIX;

async function livePathExists(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  path: string,
): Promise<boolean> {
  for (const [prefix, table] of LIVE_PREFIXES) {
    if (!path.startsWith(prefix)) continue;
    const slug = path.slice(prefix.length);
    if (!slug || slug.includes("/")) return false;
    const row = await ctx.db
      .query(table as any)
      .withIndex("by_org_slug", (q: any) =>
        q.eq("orgId", orgId).eq("slug", slug),
      )
      .first();
    return !!row;
  }
  return false;
}

// Core writer. `incoming` must already be normalized, with unique fromPaths.
// Results are aligned with `incoming` by position.
async function planRedirects(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  incoming: Incoming[],
  opts: { checkLive: boolean },
): Promise<PlanResult[]> {
  const results = new Map<number, PlanResult>();

  // Live-page guard runs before the overlay is built, so a rejected row never
  // leaks its target into chain resolution.
  const candidates: Incoming[] = [];
  for (const row of incoming) {
    if (opts.checkLive && (await livePathExists(ctx, orgId, row.fromPath))) {
      results.set(row.idx, {
        ok: false,
        code: "PATH_IS_LIVE",
        error: `${row.fromPath} is a live page; it cannot be redirected`,
      });
    } else {
      candidates.push(row);
    }
  }

  const existing = await ctx.db
    .query("orgRedirects")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const byFrom = new Map(existing.map((d) => [d.fromPath, d]));
  const overlay = new Map(candidates.map((r) => [r.fromPath, r]));

  const lookup = (path: string): RedirectEdge | undefined => {
    const inc = overlay.get(path);
    if (inc) return { toPath: inc.toPath, status: inc.status };
    const doc = byFrom.get(path);
    return doc ? { toPath: doc.toPath, status: doc.status } : undefined;
  };

  const resolved = new Map<string, { toPath: string; status: RedirectStatus }>();
  for (const row of candidates) {
    const r = resolveFinalTarget(row.fromPath, row.toPath, row.status, lookup);
    if (!r.ok) {
      results.set(row.idx, {
        ok: false,
        code: r.loop ? "REDIRECT_LOOP" : "REDIRECT_CHAIN_TOO_LONG",
        error: r.error,
      });
      continue;
    }
    resolved.set(row.fromPath, { toPath: r.toPath, status: r.status });
    results.set(row.idx, { ok: true, toPath: r.toPath, status: r.status });
  }

  const now = Date.now();
  const writtenFroms = new Set(resolved.keys());
  for (const row of candidates) {
    const final = resolved.get(row.fromPath);
    if (!final) continue;
    const doc = byFrom.get(row.fromPath);
    if (doc) {
      await ctx.db.patch(doc._id, {
        toPath: final.toPath,
        status: final.status,
        source: row.source,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("orgRedirects", {
        orgId,
        fromPath: row.fromPath,
        toPath: final.toPath,
        status: final.status,
        source: row.source,
        hits: 0,
        createdAt: now,
        updatedAt: now,
      });
    }
    // Rows that point at this path now point at its final target instead,
    // so no chain can form. Rows written above are already final.
    for (const ref of existing) {
      if (ref.toPath !== row.fromPath || writtenFroms.has(ref.fromPath)) continue;
      await ctx.db.patch(ref._id, {
        toPath: final.status === 410 ? "" : final.toPath,
        status: final.status === 410 ? 410 : ref.status,
        updatedAt: now,
      });
    }
  }

  return incoming.map(
    (row) =>
      results.get(row.idx) ?? {
        ok: false,
        code: "INTERNAL",
        error: "Not processed",
      },
  );
}

// Called when an entity is created or its slug changes. The page now lives at
// `kind/slug`, so any redirect that was sending that path elsewhere is removed.
export async function dropRedirectForLivePath(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  kind: RedirectKind,
  slug: string,
) {
  const p = normalizePath(KIND_PREFIX[kind] + slug);
  if (!p.ok) return;
  const row = await ctx.db
    .query("orgRedirects")
    .withIndex("by_org_from", (q) =>
      q.eq("orgId", orgId).eq("fromPath", p.path),
    )
    .unique();
  if (row) await ctx.db.delete(row._id);
}

// Called after an entity's slug changes: old path -> new path (301), and every
// existing redirect that pointed at the old path is repointed to the new one.
export async function recordSlugChange(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  kind: RedirectKind,
  oldSlug: string,
  newSlug: string,
) {
  const oldP = normalizePath(KIND_PREFIX[kind] + oldSlug);
  const newP = normalizePath(KIND_PREFIX[kind] + newSlug);
  if (!oldP.ok || !newP.ok || oldP.path === newP.path) return;
  await dropRedirectForLivePath(ctx, orgId, kind, newSlug);
  await planRedirects(
    ctx,
    orgId,
    [
      {
        idx: 0,
        fromPath: oldP.path,
        toPath: newP.path,
        status: 301,
        source: "slug_change",
      },
    ],
    { checkLive: false },
  );
}

// ---------------- Edge: lookup and hit ----------------

// Public. Returns only what the edge needs. Never throws for unknown orgs.
export const lookup = query({
  args: { orgSlug: v.string(), path: v.string() },
  handler: async (ctx, { orgSlug, path }) => {
    const p = normalizeFromPath(path);
    if (!p.ok) return null;
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", orgSlug))
      .unique();
    if (!org || !org.active) return null;
    const row = await ctx.db
      .query("orgRedirects")
      .withIndex("by_org_from", (q) =>
        q.eq("orgId", org._id).eq("fromPath", p.path),
      )
      .unique();
    if (!row) return null;
    return { toPath: row.toPath, status: row.status };
  },
});

// Public, cheap: increments only when the redirect exists. Unknown paths are a
// no-op, so this cannot create rows. The edge should throttle its calls.
export const hit = mutation({
  args: { orgSlug: v.string(), fromPath: v.string() },
  handler: async (ctx, { orgSlug, fromPath }) => {
    const p = normalizeFromPath(fromPath);
    if (!p.ok) return { hit: false };
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", orgSlug))
      .unique();
    if (!org || !org.active) return { hit: false };
    const row = await ctx.db
      .query("orgRedirects")
      .withIndex("by_org_from", (q) =>
        q.eq("orgId", org._id).eq("fromPath", p.path),
      )
      .unique();
    if (!row) return { hit: false };
    await ctx.db.patch(row._id, {
      hits: row.hits + 1,
      lastHitAt: Date.now(),
    });
    return { hit: true };
  },
});

// ---------------- Admin ----------------

const toRow = (d: {
  _id: Id<"orgRedirects">;
  fromPath: string;
  toPath: string;
  status: RedirectStatus;
  source: RedirectSource;
  hits: number;
  lastHitAt?: number;
  updatedAt: number;
}) => ({
  id: d._id,
  fromPath: d.fromPath,
  toPath: d.toPath,
  status: d.status,
  source: d.source,
  hits: d.hits,
  lastHitAt: d.lastHitAt ?? null,
  updatedAt: d.updatedAt,
});

// Paginated by fromPath. `search` is a fromPath prefix (e.g. "/product/").
export const list = query({
  args: {
    orgSlug: v.string(),
    search: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { orgSlug, search, paginationOpts }) => {
    const { orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    let prefix = (search ?? "").trim().toLowerCase();
    if (prefix && !prefix.startsWith("/")) prefix = "/" + prefix;
    const page = await ctx.db
      .query("orgRedirects")
      .withIndex("by_org_from", (q) =>
        prefix
          ? q
              .eq("orgId", orgId)
              .gte("fromPath", prefix)
              .lt("fromPath", prefix + "￿")
          : q.eq("orgId", orgId),
      )
      .paginate(paginationOpts);
    return {
      page: page.page.map(toRow),
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

// Create or edit one redirect. Editing with `id` may change fromPath.
export const upsert = mutation({
  args: {
    orgSlug: v.string(),
    id: v.optional(v.id("orgRedirects")),
    fromPath: v.string(),
    toPath: v.string(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAdminBySlug(ctx, args.orgSlug);
    const prev = args.id ? await ctx.db.get(args.id) : null;
    if (args.id && (!prev || prev.orgId !== orgId))
      throw new ConvexError({ code: "NOT_FOUND" });

    const from = normalizeFromPath(args.fromPath);
    if (!from.ok) throw new ConvexError({ code: "INVALID_FROM", message: from.error });
    const status = parseStatus(args.status);
    if (!status.ok) throw new ConvexError({ code: "INVALID_STATUS", message: status.error });
    const to = normalizeTarget(args.toPath, status.status);
    if (!to.ok) throw new ConvexError({ code: "INVALID_TO", message: to.error });

    if (prev && prev.fromPath !== from.path) await ctx.db.delete(prev._id);
    const [result] = await planRedirects(
      ctx,
      orgId,
      [
        {
          idx: 0,
          fromPath: from.path,
          toPath: to.toPath,
          status: status.status,
          source: "manual",
        },
      ],
      { checkLive: true },
    );
    if (!result.ok) throw new ConvexError({ code: result.code, message: result.error });
    return { fromPath: from.path, toPath: result.toPath, status: result.status };
  },
});

export const remove = mutation({
  args: { orgSlug: v.string(), id: v.id("orgRedirects") },
  handler: async (ctx, { orgSlug, id }) => {
    const { orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    const row = await ctx.db.get(id);
    if (!row || row.orgId !== orgId) throw new ConvexError({ code: "NOT_FOUND" });
    await ctx.db.delete(id);
    return { deleted: true };
  },
});

// rows: { from, to, status? }. Per-row results; valid rows are written even
// when others fail. `to` is ignored for 410.
export const bulkImport = mutation({
  args: {
    orgSlug: v.string(),
    rows: v.array(
      v.object({
        from: v.string(),
        to: v.optional(v.string()),
        status: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { orgSlug, rows }) => {
    const { orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    if (rows.length > MAX_IMPORT_ROWS)
      throw new ConvexError({ code: "TOO_MANY_ROWS", max: MAX_IMPORT_ROWS });

    type RowResult =
      | { index: number; ok: true; fromPath: string; toPath: string; status: RedirectStatus }
      | { index: number; ok: false; error: string };
    const results: RowResult[] = new Array(rows.length);
    const incoming: Incoming[] = [];
    const seen = new Set<string>();

    rows.forEach((row, index) => {
      const fail = (error: string) => {
        results[index] = { index, ok: false, error };
      };
      const from = normalizeFromPath(row.from);
      if (!from.ok) return fail(from.error);
      const status = parseStatus(row.status);
      if (!status.ok) return fail(status.error);
      const to = normalizeTarget(row.to ?? "", status.status);
      if (!to.ok) return fail(to.error);
      if (seen.has(from.path)) return fail("Duplicate from path in this import");
      seen.add(from.path);
      incoming.push({
        idx: index,
        fromPath: from.path,
        toPath: to.toPath,
        status: status.status,
        source: "import",
      });
    });

    const planned = await planRedirects(ctx, orgId, incoming, { checkLive: true });
    incoming.forEach((row, i) => {
      const r = planned[i];
      results[row.idx] = r.ok
        ? { index: row.idx, ok: true, fromPath: row.fromPath, toPath: r.toPath, status: r.status }
        : { index: row.idx, ok: false, error: r.error };
    });

    const ok = results.filter((r) => r.ok).length;
    return { results, imported: ok, failed: results.length - ok };
  },
});

export const exportAll = query({
  args: { orgSlug: v.string() },
  handler: async (ctx, { orgSlug }) => {
    const { orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    const rows = await ctx.db
      .query("orgRedirects")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    rows.sort((a, b) => (a.fromPath < b.fromPath ? -1 : a.fromPath > b.fromPath ? 1 : 0));
    return rows.map(toRow);
  },
});
