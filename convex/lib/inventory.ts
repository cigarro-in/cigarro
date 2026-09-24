import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { findOrgDocBySupabase, inOrg } from "./org";

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
type Org = { _id: Id<"organizations">; slug: string };

async function orgOf(ctx: MutationCtx, orgId: Id<"organizations">): Promise<Org> {
  const org = await ctx.db.get(orgId);
  if (!org) throw new ConvexError({ code: "ORG_NOT_FOUND" });
  return { _id: org._id, slug: org.slug };
}

async function orgVariantsByProduct(
  ctx: MutationCtx,
  org: Org,
  productSupabaseId: string,
): Promise<any[]> {
  const scoped = await ctx.db
    .query("catalogVariants")
    .withIndex("by_org_product", (q) =>
      q.eq("orgId", org._id).eq("productSupabaseId", productSupabaseId),
    )
    .collect();
  if (org.slug !== "smokeshop") return scoped;
  const legacy = await ctx.db
    .query("catalogVariants")
    .withIndex("by_product", (q) =>
      q.eq("productSupabaseId", productSupabaseId),
    )
    .collect();
  const seen = new Set(scoped.map((r) => r._id));
  return [...scoped, ...legacy.filter((r) => r.orgId == null && !seen.has(r._id))];
}

async function orgComboItems(
  ctx: MutationCtx,
  org: Org,
  comboSupabaseId: string,
): Promise<any[]> {
  const scoped = await ctx.db
    .query("catalogComboItems")
    .withIndex("by_org_combo", (q) =>
      q.eq("orgId", org._id).eq("comboSupabaseId", comboSupabaseId),
    )
    .collect();
  if (org.slug !== "smokeshop") return scoped;
  const legacy = await ctx.db
    .query("catalogComboItems")
    .withIndex("by_combo", (q) => q.eq("comboSupabaseId", comboSupabaseId))
    .collect();
  const seen = new Set(scoped.map((r) => r._id));
  return [...scoped, ...legacy.filter((r) => r.orgId == null && !seen.has(r._id))];
}

async function trackedVariantForLine(
  ctx: MutationCtx,
  org: Org,
  line: OrderLine,
) {
  let variant: Doc<"catalogVariants"> | null = null;
  if (line.variantId) {
    const found = await findOrgDocBySupabase(
      ctx,
      "catalogVariants",
      org,
      line.variantId!,
    );
    variant = found && inOrg(found, org) ? found : null;
    if (variant && variant.productSupabaseId !== line.productId) {
      throw new ConvexError({ code: "VARIANT_PRODUCT_MISMATCH" });
    }
  } else {
    const variants = await orgVariantsByProduct(ctx, org, line.productId);
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

async function aggregateTrackedLines(
  ctx: MutationCtx,
  org: Org,
  lines: OrderLine[],
) {
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
    const variant = await trackedVariantForLine(ctx, org, line);
    if (variant) {
      add(variant, line.qty);
      continue;
    }
    // Combo order lines carry the combo UUID as productId and no variantId.
    // Combos resolve inside the order's org only.
    const combo = await findOrgDocBySupabase(ctx, "catalogCombos", org, line.productId);
    if (!combo || !inOrg(combo, org)) continue;
    const comboItems = await orgComboItems(ctx, org, combo.supabaseId);
    for (const comboItem of comboItems) {
      const comboVariant = await findOrgDocBySupabase(
        ctx,
        "catalogVariants",
        org,
        comboItem.variantSupabaseId,
      );
      if (comboVariant && inOrg(comboVariant, org))
        add(comboVariant, comboItem.quantity * line.qty);
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
  const org = await orgOf(ctx, orgId);
  for (const { variant, qty } of await aggregateTrackedLines(ctx, org, lines)) {
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
  const org = await orgOf(ctx, order.orgId);
  const wasReserved = order.inventoryState === "reserved";
  for (const { variant, qty } of await aggregateTrackedLines(ctx, org, order.items)) {
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
  const org = await orgOf(ctx, order.orgId);
  for (const { variant, qty } of await aggregateTrackedLines(ctx, org, order.items)) {
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
  const org = await orgOf(ctx, order.orgId);
  for (const { variant, qty } of await aggregateTrackedLines(ctx, org, order.items)) {
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
