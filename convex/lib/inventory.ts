import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export type InventoryMovement =
  | "opening_balance"
  | "manual_adjustment"
  | "stock_received"
  | "online_reservation"
  | "reservation_release"
  | "online_sale"
  | "offline_sale"
  | "sale_reversal"
  | "return";

type Reference = { type?: string; id?: string; note?: string };
type OrderLine = { productId: string; variantId?: string; qty: number };

async function trackedVariantForLine(ctx: MutationCtx, line: OrderLine) {
  let variant: Doc<"catalogVariants"> | null = null;
  if (line.variantId) {
    variant = await ctx.db
      .query("catalogVariants")
      .withIndex("by_supabase", (q) => q.eq("supabaseId", line.variantId!))
      .unique();
    if (variant && variant.productSupabaseId !== line.productId) {
      throw new ConvexError({ code: "VARIANT_PRODUCT_MISMATCH" });
    }
  } else {
    const variants = await ctx.db
      .query("catalogVariants")
      .withIndex("by_product", (q) => q.eq("productSupabaseId", line.productId))
      .collect();
    variant = variants.find((v) => v.isDefault) ?? variants[0] ?? null;
  }
  return variant && variant.trackInventory !== false ? variant : null;
}

async function getOrCreateBalance(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  variant: Doc<"catalogVariants">,
  actor: string,
) {
  const existing = await ctx.db
    .query("inventoryBalances")
    .withIndex("by_org_variant", (q) =>
      q.eq("orgId", orgId).eq("variantSupabaseId", variant.supabaseId),
    )
    .unique();
  if (existing) return existing;

  const opening = Math.max(0, Math.floor(variant.stock ?? 0));
  const now = Date.now();
  const id = await ctx.db.insert("inventoryBalances", {
    orgId,
    variantSupabaseId: variant.supabaseId,
    onHand: opening,
    reserved: 0,
    reorderPoint: 10,
    updatedAt: now,
  });
  await ctx.db.insert("inventoryMovements", {
    orgId,
    variantSupabaseId: variant.supabaseId,
    productSupabaseId: variant.productSupabaseId,
    type: "opening_balance",
    quantityDelta: opening,
    reservedDelta: 0,
    onHandBefore: 0,
    onHandAfter: opening,
    reservedBefore: 0,
    reservedAfter: 0,
    note: "Imported from the catalog stock value",
    createdBy: actor,
    createdAt: now,
  });
  return (await ctx.db.get(id))!;
}

export async function changeInventory(
  ctx: MutationCtx,
  args: {
    orgId: Id<"organizations">;
    variant: Doc<"catalogVariants">;
    onHandDelta: number;
    reservedDelta?: number;
    type: InventoryMovement;
    actor: string;
    reference?: Reference;
    allowNegativeOnHand?: boolean;
  },
) {
  if (!Number.isSafeInteger(args.onHandDelta) || !Number.isSafeInteger(args.reservedDelta ?? 0)) {
    throw new ConvexError({ code: "INVENTORY_WHOLE_UNITS_ONLY" });
  }
  const balance = await getOrCreateBalance(ctx, args.orgId, args.variant, args.actor);
  const nextOnHand = balance.onHand + args.onHandDelta;
  const nextReserved = balance.reserved + (args.reservedDelta ?? 0);
  if (!args.allowNegativeOnHand && nextOnHand < 0) {
    throw new ConvexError({
      code: "INSUFFICIENT_STOCK",
      variantId: args.variant.supabaseId,
      available: balance.onHand - balance.reserved,
    });
  }
  if (nextReserved < 0 || (!args.allowNegativeOnHand && nextReserved > nextOnHand)) {
    throw new ConvexError({
      code: "INSUFFICIENT_STOCK",
      variantId: args.variant.supabaseId,
      available: balance.onHand - balance.reserved,
    });
  }
  const now = Date.now();
  await ctx.db.patch(balance._id, {
    onHand: nextOnHand,
    reserved: nextReserved,
    updatedAt: now,
  });
  await ctx.db.insert("inventoryMovements", {
    orgId: args.orgId,
    variantSupabaseId: args.variant.supabaseId,
    productSupabaseId: args.variant.productSupabaseId,
    type: args.type,
    quantityDelta: args.onHandDelta,
    reservedDelta: args.reservedDelta ?? 0,
    onHandBefore: balance.onHand,
    onHandAfter: nextOnHand,
    reservedBefore: balance.reserved,
    reservedAfter: nextReserved,
    referenceType: args.reference?.type,
    referenceId: args.reference?.id,
    note: args.reference?.note,
    createdBy: args.actor,
    createdAt: now,
  });
  return { onHand: nextOnHand, reserved: nextReserved };
}

async function aggregateTrackedLines(ctx: MutationCtx, lines: OrderLine[]) {
  const quantities = new Map<string, { variant: Doc<"catalogVariants">; qty: number }>();
  const add = (variant: Doc<"catalogVariants">, qty: number) => {
    if (variant.trackInventory === false) return;
    const prior = quantities.get(variant.supabaseId);
    quantities.set(variant.supabaseId, { variant, qty: (prior?.qty ?? 0) + qty });
  };
  for (const line of lines) {
    if (!Number.isSafeInteger(line.qty) || line.qty <= 0) {
      throw new ConvexError({ code: "INVALID_QUANTITY" });
    }
    const variant = await trackedVariantForLine(ctx, line);
    if (variant) {
      add(variant, line.qty);
      continue;
    }
    // Combo order lines carry the combo UUID as productId and no variantId.
    const combo = await ctx.db
      .query("catalogCombos")
      .withIndex("by_supabase", (q) => q.eq("supabaseId", line.productId))
      .unique();
    if (!combo) continue;
    const comboItems = await ctx.db
      .query("catalogComboItems")
      .withIndex("by_combo", (q) => q.eq("comboSupabaseId", combo.supabaseId))
      .collect();
    for (const comboItem of comboItems) {
      const comboVariant = await ctx.db
        .query("catalogVariants")
        .withIndex("by_supabase", (q) => q.eq("supabaseId", comboItem.variantSupabaseId))
        .unique();
      if (comboVariant) add(comboVariant, comboItem.quantity * line.qty);
    }
  }
  return [...quantities.values()];
}

export async function reserveOrderInventory(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  lines: OrderLine[],
  orderId: Id<"orders">,
  actor: string,
) {
  for (const { variant, qty } of await aggregateTrackedLines(ctx, lines)) {
    const balance = await getOrCreateBalance(ctx, orgId, variant, actor);
    if (balance.onHand - balance.reserved < qty) {
      throw new ConvexError({
        code: "INSUFFICIENT_STOCK",
        variantId: variant.supabaseId,
        available: balance.onHand - balance.reserved,
      });
    }
    await changeInventory(ctx, {
      orgId,
      variant,
      onHandDelta: 0,
      reservedDelta: qty,
      type: "online_reservation",
      actor,
      reference: { type: "order", id: orderId },
    });
  }
}

export async function commitOrderInventory(
  ctx: MutationCtx,
  order: Doc<"orders">,
  actor: string,
) {
  if (order.kind !== "purchase" || order.inventoryState === "committed") return;
  const wasReserved = order.inventoryState === "reserved";
  for (const { variant, qty } of await aggregateTrackedLines(ctx, order.items)) {
    await changeInventory(ctx, {
      orgId: order.orgId,
      variant,
      onHandDelta: -qty,
      reservedDelta: wasReserved ? -qty : 0,
      type: "online_sale",
      actor,
      reference: { type: "order", id: order._id },
      // Legacy or late-paid rows may be committed after their reservation was
      // released. Payment has already arrived, so record the shortage instead
      // of rejecting the payment transaction.
      allowNegativeOnHand: !wasReserved,
    });
  }
  await ctx.db.patch(order._id, { inventoryState: "committed" });
}

export async function releaseOrderInventory(
  ctx: MutationCtx,
  order: Doc<"orders">,
  actor: string,
) {
  if (order.kind !== "purchase" || order.inventoryState !== "reserved") return;
  for (const { variant, qty } of await aggregateTrackedLines(ctx, order.items)) {
    await changeInventory(ctx, {
      orgId: order.orgId,
      variant,
      onHandDelta: 0,
      reservedDelta: -qty,
      type: "reservation_release",
      actor,
      reference: { type: "order", id: order._id },
    });
  }
  await ctx.db.patch(order._id, { inventoryState: "released" });
}

export async function returnOrderInventory(
  ctx: MutationCtx,
  order: Doc<"orders">,
  actor: string,
) {
  if (order.kind !== "purchase" || order.inventoryState !== "committed") return;
  for (const { variant, qty } of await aggregateTrackedLines(ctx, order.items)) {
    await changeInventory(ctx, {
      orgId: order.orgId,
      variant,
      onHandDelta: qty,
      type: "return",
      actor,
      reference: { type: "order", id: order._id, note: "Restocked during refund" },
    });
  }
  await ctx.db.patch(order._id, { inventoryState: "returned" });
}
