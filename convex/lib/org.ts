import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireIdentity } from "./auth";

type Ctx = QueryCtx | MutationCtx;
type Org = { _id: Id<"organizations">; slug: string };

// Merchant-owned reads/writes resolve the org from this slug (never from a
// caller-supplied id alone), so a forged orgId can't cross tenant boundaries.
export async function resolveOrg(ctx: Ctx, orgSlug: string) {
  const org = await ctx.db
    .query("organizations")
    .withIndex("by_slug", (q) => q.eq("slug", orgSlug))
    .unique();
  if (!org || !org.active)
    throw new ConvexError({ code: "ORG_NOT_FOUND", orgSlug });
  return org;
}

// Admin surface: owner/admin of THIS org only (never "admin of any org").
export async function requireOrgAdminBySlug(ctx: Ctx, orgSlug: string) {
  const org = await resolveOrg(ctx, orgSlug);
  const identity = await requireIdentity(ctx);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_org_user", (q) =>
      q.eq("orgId", org._id).eq("userId", identity.subject),
    )
    .unique();
  if (
    !membership ||
    (membership.role !== "admin" && membership.role !== "owner")
  )
    throw new ConvexError({ code: "NOT_ORG_ADMIN", orgSlug });
  return {
    org,
    orgId: org._id as Id<"organizations">,
    identity,
    membership,
  };
}

// Where a legacy orgId arg is kept, it must equal the slug-resolved org.
export function assertOrgMatch(
  provided: Id<"organizations"> | undefined,
  org: { _id: Id<"organizations"> },
) {
  if (provided !== undefined && provided !== org._id)
    throw new ConvexError({ code: "ORG_MISMATCH" });
}

// Row belongs to org? Pre-backfill rows carry no orgId; they belong to the
// legacy single-tenant org (smokeshop) only. Never true for another org's
// rows, and never true across orgs — no global fallback.
export function inOrg(
  row: { orgId?: Id<"organizations"> | null },
  org: Org,
) {
  if (row.orgId === org._id) return true;
  return (
    (row.orgId === undefined || row.orgId === null) &&
    org.slug === "smokeshop"
  );
}

// by_org collect + legacy null-orgId rows for the smokeshop window. After the
// backfill assigns every row, the legacy half finds nothing and this is a
// plain scoped collect.
export async function collectInOrg(
  ctx: Ctx,
  table: any,
  org: Org,
): Promise<any[]> {
  const scoped = await ctx.db
    .query(table)
    .withIndex("by_org", (q: any) => q.eq("orgId", org._id))
    .collect();
  if (org.slug !== "smokeshop") return scoped;
  const legacy = await ctx.db
    .query(table)
    .withIndex("by_org", (q: any) => q.eq("orgId", undefined))
    .collect();
  const seen = new Set(scoped.map((r: any) => r._id));
  for (const r of legacy) if (!seen.has(r._id)) scoped.push(r);
  return scoped;
}

// Scoped supabaseId lookup with a smokeshop-only legacy fallback. Never uses
// the global by_supabase .unique() blindly: post-backfill two orgs may hold
// the same supabaseId (per-org copies), which would make .unique() throw.
export async function findOrgDocBySupabase(
  ctx: Ctx,
  table: any,
  org: Org,
  supabaseId: string,
): Promise<any> {
  const scoped = await ctx.db
    .query(table)
    .withIndex("by_org_supabase", (q: any) =>
      q.eq("orgId", org._id).eq("supabaseId", supabaseId),
    )
    .unique();
  if (scoped) return scoped;
  if (org.slug !== "smokeshop") return null;
  const legacy = await ctx.db
    .query(table)
    .withIndex("by_supabase", (q: any) => q.eq("supabaseId", supabaseId))
    .collect();
  return legacy.find((r: any) => r.orgId == null) ?? null;
}

// Same, for slug-keyed tables. Uses collect (not .unique()) on the global
// slug index so cross-org duplicate slugs can never throw.
export async function findOrgDocBySlug(
  ctx: Ctx,
  table: any,
  org: Org,
  slug: string,
): Promise<any> {
  const scoped = await ctx.db
    .query(table)
    .withIndex("by_org_slug", (q: any) =>
      q.eq("orgId", org._id).eq("slug", slug),
    )
    .unique();
  if (scoped) return scoped;
  if (org.slug !== "smokeshop") return null;
  const rows = await ctx.db
    .query(table)
    .withIndex("by_slug", (q: any) => q.eq("slug", slug))
    .collect();
  return rows.find((r: any) => r.orgId == null) ?? null;
}
