// Product list bulk actions that the generic catalog mutations do not cover.
// Additive: membership changes for many products at once, without having to
// resend a whole collection/category (saveCollection / setCategoryProducts
// replace the full product list).
import { mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { findOrgDocBySupabase, inOrg, requireOrgAdminBySlug } from "./lib/org";
import { isLegacyOrg } from "./lib/legacyOrg";

const GROUPS = {
  collection: {
    table: "catalogCollections",
    join: "catalogCollectionProducts",
    field: "collectionSupabaseId",
    orgIndex: "by_org_collection",
    legacyIndex: "by_collection",
  },
  category: {
    table: "catalogCategories",
    join: "catalogProductCategories",
    field: "categorySupabaseId",
    orgIndex: "by_org_category",
    legacyIndex: "by_category",
  },
} as const;

async function groupJoins(ctx: any, org: any, g: (typeof GROUPS)[keyof typeof GROUPS], groupId: string) {
  const scoped = await ctx.db
    .query(g.join)
    .withIndex(g.orgIndex, (q: any) => q.eq("orgId", org._id).eq(g.field, groupId))
    .collect();
  if (!isLegacyOrg(org)) return scoped;
  const legacy = await ctx.db
    .query(g.join)
    .withIndex(g.legacyIndex, (q: any) => q.eq(g.field, groupId))
    .collect();
  const seen = new Set(scoped.map((r: any) => r._id));
  return [...scoped, ...legacy.filter((r: any) => r.orgId == null && !seen.has(r._id))];
}

/**
 * Add or remove many products to/from one collection or category.
 * Idempotent: products already in the group are skipped on add; missing
 * ones are ignored on remove. New collection members go to the end.
 */
export const setProductsGroupMembership = mutation({
  args: {
    orgSlug: v.string(),
    kind: v.union(v.literal("collection"), v.literal("category")),
    groupSupabaseId: v.string(),
    productSupabaseIds: v.array(v.string()),
    mode: v.union(v.literal("add"), v.literal("remove")),
  },
  handler: async (ctx, { orgSlug, kind, groupSupabaseId, productSupabaseIds, mode }) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    const g = GROUPS[kind];
    const group = await findOrgDocBySupabase(ctx, g.table, org, groupSupabaseId);
    if (!group || !inOrg(group, org)) throw new ConvexError({ code: "NOT_FOUND" });
    for (const pid of productSupabaseIds) {
      const p = await findOrgDocBySupabase(ctx, "catalogProducts", org, pid);
      if (!p || !inOrg(p, org)) throw new ConvexError({ code: "NOT_FOUND" });
    }
    const existing = await groupJoins(ctx, org, g, groupSupabaseId);
    const targets = new Set(productSupabaseIds);
    let changed = 0;
    if (mode === "remove") {
      for (const j of existing) {
        if (targets.has(j.productSupabaseId)) {
          await ctx.db.delete(j._id);
          changed++;
        }
      }
      return { changed };
    }
    const present = new Set(existing.map((j: any) => j.productSupabaseId));
    let order =
      existing.reduce((max: number, j: any) => Math.max(max, j.sortOrder ?? j.order ?? -1), -1) + 1;
    for (const pid of productSupabaseIds) {
      if (present.has(pid)) continue;
      present.add(pid);
      if (kind === "collection") {
        await ctx.db.insert("catalogCollectionProducts", {
          orgId,
          collectionSupabaseId: groupSupabaseId,
          productSupabaseId: pid,
          sortOrder: order++,
        });
      } else {
        await ctx.db.insert("catalogProductCategories", {
          orgId,
          categorySupabaseId: groupSupabaseId,
          productSupabaseId: pid,
        });
      }
      changed++;
    }
    return { changed };
  },
});
