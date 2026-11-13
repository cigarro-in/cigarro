import type { QueryCtx, MutationCtx } from "../_generated/server";

// The original store (the cigarro.in storefront). Its slug was `smokeshop`
// until the renameSmokeshopToOldsmokeshop-v1 migration (convex/migrations.ts)
// moved it here, freeing `smokeshop` for a new store. Nothing else may treat
// the slug `smokeshop` as special.
export const LEGACY_ORG_SLUG = "oldsmokeshop";

// Pre-rename slug. Honored only while the rename has not completed (the
// deploy-to-migration window, <= 10 min), and for pre-rename JWTs (see
// tokenMatchesOrg). Never a default for anything else.
export const PRE_RENAME_LEGACY_SLUG = "smokeshop";

export const RENAME_MIGRATION = "renameSmokeshopToOldsmokeshop-v1";

export function isLegacyOrg(org: { slug: string }): boolean {
  return org.slug === LEGACY_ORG_SLUG;
}

export async function renameDone(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const row = await ctx.db
    .query("migrations")
    .withIndex("by_name", (q) => q.eq("name", RENAME_MIGRATION))
    .unique();
  return row?.status === "done";
}

export async function storeSlugTaken(
  ctx: QueryCtx | MutationCtx,
  slug: string,
): Promise<boolean> {
  const row = await ctx.db
    .query("organizations")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .first();
  return row !== null;
}
