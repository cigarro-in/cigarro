import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOrgAdmin } from "./lib/auth";
import { audit } from "./lib/audit";
import { changeInventory } from "./lib/inventory";

export const list = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireOrgAdmin(ctx, orgId);
    const [products, variants, balances] = await Promise.all([
      ctx.db.query("catalogProducts").collect(),
      ctx.db.query("catalogVariants").collect(),
      ctx.db.query("inventoryBalances").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect(),
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
    orgId: v.id("organizations"),
    variantSupabaseId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { orgId, variantSupabaseId, limit }) => {
    await requireOrgAdmin(ctx, orgId);
    if (variantSupabaseId) {
      return await ctx.db
        .query("inventoryMovements")
        .withIndex("by_org_variant_time", (q) =>
          q.eq("orgId", orgId).eq("variantSupabaseId", variantSupabaseId),
        )
        .order("desc")
        .take(Math.min(limit ?? 50, 200));
    }
    return await ctx.db
      .query("inventoryMovements")
      .withIndex("by_org_time", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(Math.min(limit ?? 50, 200));
  },
});

export const adjust = mutation({
  args: {
    orgId: v.id("organizations"),
    variantSupabaseId: v.string(),
    targetOnHand: v.number(),
    reorderPoint: v.number(),
    reason: v.union(v.literal("manual_adjustment"), v.literal("stock_received"), v.literal("return")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireOrgAdmin(ctx, args.orgId);
    if (!Number.isSafeInteger(args.targetOnHand) || args.targetOnHand < 0)
      throw new ConvexError({ code: "INVALID_STOCK" });
    if (!Number.isSafeInteger(args.reorderPoint) || args.reorderPoint < 0)
      throw new ConvexError({ code: "INVALID_REORDER_POINT" });
    const variant = await ctx.db
      .query("catalogVariants")
      .withIndex("by_supabase", (q) => q.eq("supabaseId", args.variantSupabaseId))
      .unique();
    if (!variant) throw new ConvexError({ code: "VARIANT_NOT_FOUND" });
    const current = await ctx.db
      .query("inventoryBalances")
      .withIndex("by_org_variant", (q) =>
        q.eq("orgId", args.orgId).eq("variantSupabaseId", args.variantSupabaseId),
      )
      .unique();
    const currentOnHand = current?.onHand ?? Math.max(0, Math.floor(variant.stock ?? 0));
    if (args.targetOnHand < (current?.reserved ?? 0))
      throw new ConvexError({ code: "STOCK_BELOW_RESERVED", reserved: current?.reserved ?? 0 });
    await changeInventory(ctx, {
      orgId: args.orgId,
      variant,
      onHandDelta: args.targetOnHand - currentOnHand,
      type: args.reason,
      actor: `admin:${identity.subject}`,
      reference: { type: "manual", note: args.note },
    });
    const balance = await ctx.db
      .query("inventoryBalances")
      .withIndex("by_org_variant", (q) =>
        q.eq("orgId", args.orgId).eq("variantSupabaseId", args.variantSupabaseId),
      )
      .unique();
    if (balance) await ctx.db.patch(balance._id, { reorderPoint: args.reorderPoint });
    await audit(ctx, {
      orgId: args.orgId,
      adminUserId: identity.subject,
      action: "inventory.adjust",
      targetType: "catalogVariant",
      targetId: args.variantSupabaseId,
      payload: { targetOnHand: args.targetOnHand, reorderPoint: args.reorderPoint, reason: args.reason, note: args.note },
    });
    return { onHand: args.targetOnHand };
  },
});
