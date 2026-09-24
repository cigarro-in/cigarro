import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireOrgAdminBySlug } from "./lib/org";

// ---------- Org-isolation backfill ----------
// Assigns missing orgId on merchant-owned rows to the caller's org (run it
// for the legacy org, `smokeshop`, first). Bounded batches: each call patches
// at most `batchSize` rows per table and reports remaining counts, so repeat
// calls converge without hitting mutation limits. Admin-authorized: only an
// owner/admin of the target org can claim rows into it.
//
// Run (after `npx convex deploy` ships the schema):
//   npx convex run orgBackfill:backfillOrgIds '{"orgSlug":"smokeshop","batchSize":200}'
// until every table reports mayHaveMore: false.

const MERCHANT_TABLES = [
  "blogCategories",
  "blogPosts",
  "heroSlides",
  "sectionConfigurations",
  "homepageComponentConfig",
  "siteSettings",
  "catalogBrands",
  "catalogCategories",
  "catalogProducts",
  "catalogVariants",
  "catalogProductCategories",
  "catalogCollections",
  "catalogCollectionProducts",
  "catalogCombos",
  "catalogComboItems",
  "discounts",
  "referrals",
  "productReviews",
] as const;

export const backfillOrgIds = mutation({
  args: {
    orgSlug: v.string(),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.orgSlug !== "smokeshop")
      throw new ConvexError({ code: "LEGACY_DATA_BELONGS_TO_SMOKESHOP" });
    const { orgId } = await requireOrgAdminBySlug(ctx, args.orgSlug);
    const batch = Math.max(1, Math.min(args.batchSize ?? 200, 500));
    const out: Record<string, { patched: number; mayHaveMore: boolean }> = {};
    for (const table of MERCHANT_TABLES) {
      // The optional field is indexed, so query only unscoped rows. This
      // advances after each batch instead of repeatedly reading the same head.
      const missing = await ctx.db
        .query(table as any)
        .withIndex("by_org", (q: any) => q.eq("orgId", undefined))
        .take(batch);
      for (const row of missing) {
        await ctx.db.patch(row._id, { orgId });
      }
      out[table] = {
        patched: missing.length,
        mayHaveMore: missing.length === batch,
      };
    }
    return out;
  },
});

// Read-only progress check (same admin gate — row counts are merchant data).
export const backfillStatus = query({
  args: { orgSlug: v.string() },
  handler: async (ctx, args) => {
    if (args.orgSlug !== "smokeshop")
      throw new ConvexError({ code: "LEGACY_DATA_BELONGS_TO_SMOKESHOP" });
    await requireOrgAdminBySlug(ctx, args.orgSlug);
    const out: Record<string, { missing: number; capped: boolean }> = {};
    for (const table of MERCHANT_TABLES) {
      const sample = await ctx.db
        .query(table as any)
        .withIndex("by_org", (q: any) => q.eq("orgId", undefined))
        .take(2000);
      out[table] = { missing: sample.length, capped: sample.length === 2000 };
    }
    return out;
  },
});
