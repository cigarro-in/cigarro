import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOrgAdmin } from "./lib/auth";
import {
  assertOrgMatch,
  collectInOrg,
  findOrgDocBySupabase,
  inOrg,
  resolveOrg,
} from "./lib/org";
import { audit } from "./lib/audit";
import { changeInventory } from "./lib/inventory";

export const list = query({
  args: { orgSlug: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, { orgSlug, orgId }) => {
    const org = await resolveOrg(ctx, orgSlug);
    assertOrgMatch(orgId, org);
    await requireOrgAdmin(ctx, org._id);
    // Catalog rows resolve inside this org only — never another tenant's.
    const [products, variants, balances] = await Promise.all([
      collectInOrg(ctx, "catalogProducts", org),
      collectInOrg(ctx, "catalogVariants", org),
      ctx.db.query("inventoryBalances").withIndex("by_org", (q) => q.eq("orgId", org._id)).collect(),
    ]);
    const productById = new Map(products.map((p) => [p.supabaseId, p]));
    const balanceByVariant = new Map(balances.map((b) => [b.variantSupabaseId, b]));
    return variants
      .filter((variant) => variant.isActive)
      .map((variant) => {
        const balance = balanceByVariant.get(variant.supabaseId);
        const onHand = balance?.onHand ?? Math.max(0, Math.floor(variant.stock ?? 0));
        const reserved = balance?.reserved ?? 0;
        const reorderPoint = balance?.reorderPoint ?? 10;
        const product = productById.get(variant.productSupabaseId);
        return {
          variantSupabaseId: variant.supabaseId,
          productSupabaseId: variant.productSupabaseId,
          productName: product?.name ?? "Unknown product",
          variantName: variant.variantName,
          imageUrl: variant.images?.[0],
          priceRupees: variant.priceRupees,
          trackInventory: variant.trackInventory !== false,
          onHand,
          reserved,
          available: onHand - reserved,
          reorderPoint,
          lowStock: variant.trackInventory !== false && onHand - reserved <= reorderPoint,
          updatedAt: balance?.updatedAt ?? variant.updatedAt,
        };
      })
      .sort((a, b) => Number(b.lowStock) - Number(a.lowStock) || a.productName.localeCompare(b.productName));
  },
});

export const history = query({
  args: {
    orgSlug: v.string(),
    orgId: v.id("organizations"),
    variantSupabaseId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { orgSlug, orgId, variantSupabaseId, limit }) => {
    const org = await resolveOrg(ctx, orgSlug);
    assertOrgMatch(orgId, org);
    await requireOrgAdmin(ctx, org._id);
    if (variantSupabaseId) {
      return await ctx.db
        .query("inventoryMovements")
        .withIndex("by_org_variant_time", (q) =>
          q.eq("orgId", org._id).eq("variantSupabaseId", variantSupabaseId),
        )
        .order("desc")
        .take(Math.min(limit ?? 50, 200));
    }
    return await ctx.db
      .query("inventoryMovements")
      .withIndex("by_org_time", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(Math.min(limit ?? 50, 200));
  },
});

export const adjust = mutation({
  args: {
    orgSlug: v.string(),
    orgId: v.id("organizations"),
    variantSupabaseId: v.string(),
    targetOnHand: v.number(),
    reorderPoint: v.number(),
    reason: v.union(v.literal("manual_adjustment"), v.literal("stock_received"), v.literal("return")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    assertOrgMatch(args.orgId, org);
    const { identity } = await requireOrgAdmin(ctx, org._id);
    if (!Number.isSafeInteger(args.targetOnHand) || args.targetOnHand < 0)
      throw new ConvexError({ code: "INVALID_STOCK" });
    if (!Number.isSafeInteger(args.reorderPoint) || args.reorderPoint < 0)
      throw new ConvexError({ code: "INVALID_REORDER_POINT" });
    const variant = await findOrgDocBySupabase(
      ctx,
      "catalogVariants",
      org,
      args.variantSupabaseId,
    );
    if (!variant || !inOrg(variant, org))
      throw new ConvexError({ code: "VARIANT_NOT_FOUND" });
    const current = await ctx.db
      .query("inventoryBalances")
      .withIndex("by_org_variant", (q) =>
        q.eq("orgId", org._id).eq("variantSupabaseId", args.variantSupabaseId),
      )
      .unique();
    const currentOnHand = current?.onHand ?? Math.max(0, Math.floor(variant.stock ?? 0));
    if (args.targetOnHand < (current?.reserved ?? 0))
      throw new ConvexError({ code: "STOCK_BELOW_RESERVED", reserved: current?.reserved ?? 0 });
    await changeInventory(ctx, {
      orgId: org._id,
      variant,
      onHandDelta: args.targetOnHand - currentOnHand,
      type: args.reason,
      actor: `admin:${identity.subject}`,
      reference: { type: "manual", note: args.note },
    });
    const balance = await ctx.db
      .query("inventoryBalances")
      .withIndex("by_org_variant", (q) =>
        q.eq("orgId", org._id).eq("variantSupabaseId", args.variantSupabaseId),
      )
      .unique();
    if (balance) await ctx.db.patch(balance._id, { reorderPoint: args.reorderPoint });
    await audit(ctx, {
      orgId: org._id,
      adminUserId: identity.subject,
      action: "inventory.adjust",
      targetType: "catalogVariant",
      targetId: args.variantSupabaseId,
      payload: { targetOnHand: args.targetOnHand, reorderPoint: args.reorderPoint, reason: args.reason, note: args.note },
    });
    return { onHand: args.targetOnHand };
  },
});
