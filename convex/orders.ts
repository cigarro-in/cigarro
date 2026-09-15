import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, mutation, query } from "./_generated/server";
import { requireIdentity, requireMember } from "./lib/auth";
import { genDisplayOrderId } from "./lib/ids";
import { assertPositiveInt, rupeesToPaise } from "./lib/money";
import { buildUpiUrl } from "./lib/upi";
import { addressV, orderItemV, orderKind } from "./schema";
import { creditWallet, debitWallet } from "./wallet";
import { commitOrderInventory, releaseOrderInventory, reserveOrderInventory } from "./lib/inventory";

function computeCartTotal(items: Doc<"orders">["items"]): number {
  return items.reduce((sum, it) => {
    assertPositiveInt(it.unitPricePaise, "unitPricePaise");
    if (!Number.isInteger(it.qty) || it.qty <= 0) {
      throw new ConvexError({ code: "INVALID_QTY" });
    }
    return sum + it.unitPricePaise * it.qty;
  }, 0);
}

async function pricePurchaseItems(
  ctx: MutationCtx,
  items: Doc<"orders">["items"],
): Promise<Doc<"orders">["items"]> {
  const priced = [];
  for (const item of items) {
    if (!Number.isInteger(item.qty) || item.qty <= 0)
      throw new ConvexError({ code: "INVALID_QTY" });
    let product = await ctx.db
      .query("catalogProducts")
      .withIndex("by_supabase", (q) => q.eq("supabaseId", item.productId))
      .unique();
    if (product?.isActive) {
      let variant = item.variantId
        ? await ctx.db.query("catalogVariants").withIndex("by_supabase", (q) => q.eq("supabaseId", item.variantId!)).unique()
        : null;
      if (!variant) {
        const variants = await ctx.db
          .query("catalogVariants")
          .withIndex("by_product", (q) => q.eq("productSupabaseId", product!.supabaseId))
          .collect();
        variant = variants.find((row) => row.isDefault) ?? variants[0] ?? null;
      }
      if (!variant || !variant.isActive || variant.productSupabaseId !== product.supabaseId)
        throw new ConvexError({ code: "INVALID_PRODUCT_VARIANT" });
      priced.push({
        productId: product.supabaseId,
        variantId: variant.supabaseId,
        name: `${product.name} · ${variant.variantName}`,
        qty: item.qty,
        unitPricePaise: rupeesToPaise(variant.priceRupees),
      });
      continue;
    }
    const combo = await ctx.db
      .query("catalogCombos")
      .withIndex("by_supabase", (q) => q.eq("supabaseId", item.productId))
      .unique();
    if (!combo?.isActive) throw new ConvexError({ code: "PRODUCT_NOT_FOUND" });
    priced.push({
      productId: combo.supabaseId,
      name: combo.name,
      qty: item.qty,
      unitPricePaise: rupeesToPaise(combo.comboPriceRupees),
    });
  }
  return priced;
}

// Race-free thanks to Convex serializable mutations.
async function allocateSlotAtBase(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  baseAmountPaise: number,
  slotsPerBase: number,
): Promise<Doc<"paymentSlots"> | null> {
  const free = await ctx.db
    .query("paymentSlots")
    .withIndex("by_org_base_state", (q) =>
      q
        .eq("orgId", orgId)
        .eq("baseAmountPaise", baseAmountPaise)
        .eq("state", "free"),
    )
    .first();
  if (free) return free;

  const rows = await ctx.db
    .query("paymentSlots")
    .withIndex("by_org_base_slot", (q) =>
      q.eq("orgId", orgId).eq("baseAmountPaise", baseAmountPaise),
    )
    .collect();
  const taken = new Set(rows.map((r) => r.slot));
  for (let i = 0; i < slotsPerBase; i++) {
    if (!taken.has(i)) {
      const id = await ctx.db.insert("paymentSlots", {
        orgId,
        baseAmountPaise,
        slot: i,
        state: "free",
      });
      return (await ctx.db.get(id))!;
    }
  }
  return null;
}

/**
 * Allocate a free payment slot for an order. If the pool at `baseAmountPaise`
 * is exhausted, try `baseAmountPaise - 1` and `baseAmountPaise + 1` as
 * fallbacks — effectively adding ±1 rupee of ambiguity to the total. In the
 * extremely rare case all three pools are full, we surface SLOT_POOL_EXHAUSTED.
 */
export async function allocateSlot(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  baseAmountPaise: number,
  slotsPerBase: number,
): Promise<{ slot: Doc<"paymentSlots">; effectiveBasePaise: number }> {
  const candidates = [
    baseAmountPaise,
    baseAmountPaise - 100,
    baseAmountPaise + 100,
  ].filter((v) => v > 0);
  for (const base of candidates) {
    const slot = await allocateSlotAtBase(ctx, orgId, base, slotsPerBase);
    if (slot) return { slot, effectiveBasePaise: base };
  }
  throw new ConvexError({ code: "SLOT_POOL_EXHAUSTED", baseAmountPaise });
}

export async function freeSlot(
  ctx: MutationCtx,
  slotId: Id<"paymentSlots">,
) {
  await ctx.db.patch(slotId, {
    state: "free",
    orderId: undefined,
    heldAt: undefined,
    quarantinedAt: undefined,
  });
}

// ---------- Public mutations ----------

export const createOrder = mutation({
  args: {
    orgId: v.id("organizations"),
    kind: orderKind,
    items: v.array(orderItemV),
    address: v.optional(addressV),
    walletAmountPaise: v.optional(v.number()),
    discountPaise: v.optional(v.number()),
    discountLabel: v.optional(v.string()),
    // Lucky discount 1–99 paise, generated client-side per order. It doubles
    // as the payment fingerprint: UPI carries paise, so cart totals that
    // collide at the rupee level stay distinguishable in bank emails, which
    // match finalAmountPaise exactly. Must be 1–99, never 0/100+ —
    // 0 collides across orders, 100+ shifts the rupee figure.
    luckyPaise: v.optional(v.number()),
    retryOfOrderId: v.optional(v.id("orders")),
    idempotencyKey: v.optional(v.string()),
    shippingMethod: v.optional(v.string()),
    shippingPricePaise: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireMember(ctx, args.orgId);
    const org = await ctx.db.get(args.orgId);
    if (!org || !org.active)
      throw new ConvexError({ code: "ORG_INACTIVE" });

    // Idempotency — if a prior call with the same key created an order for
    // this user in this org, return it instead of creating a duplicate.
    if (args.idempotencyKey) {
      const prior = await ctx.db
        .query("orders")
        .withIndex("by_org_user_idem", (q) =>
          q
            .eq("orgId", args.orgId)
            .eq("userId", userId)
            .eq("idempotencyKey", args.idempotencyKey),
        )
        .first();
      if (prior) {
        return {
          orderId: prior._id,
          displayOrderId: prior.displayOrderId,
          finalAmountPaise: prior.finalAmountPaise,
          upiUrl: prior.upiUrl || null,
          status: prior.status,
          reused: true as const,
        };
      }
    }

    // Input validation and server-side repricing. Client snapshots are never
    // trusted for product identity, names, or money.
    let orderItems = args.items;
    if (args.kind === "purchase") {
      if (args.items.length === 0)
        throw new ConvexError({ code: "EMPTY_CART" });
      if (!args.address)
        throw new ConvexError({ code: "ADDRESS_REQUIRED" });
      orderItems = await pricePurchaseItems(ctx, args.items);
    } else if (args.kind === "wallet_load") {
      if (args.items.length !== 1 || args.items[0].qty !== 1) {
        throw new ConvexError({ code: "INVALID_WALLET_LOAD" });
      }
    }

    const cartTotal = computeCartTotal(orderItems);
    if (cartTotal <= 0)
      throw new ConvexError({ code: "ZERO_AMOUNT" });

    // Discounts (coupon) are computed + displayed client-side from the
    // discounts table. Clamp so a stale/tampered client can't drive the
    // payable negative — and subtract BEFORE wallet math so the UPI
    // deeplink, /transaction amount, and bank-email match all see the
    // same discounted total the customer approved at checkout.
    const discountPaise = Math.max(
      0,
      Math.min(Math.floor(args.discountPaise ?? 0), cartTotal),
    );

    // Lucky discount doubles as the payment fingerprint (see arg docs):
    // validated strictly only when org.luckyEnabled (absent = enabled, so
    // existing installs keep working). Off (low traffic): any client lucky
    // value is ignored, finals land on exact rupees.
    // ponytail: no fingerprint when off — same-rupee concurrent pendings
    // match first-pending-wins; re-enable lucky if traffic grows.
    const luckyOn = org.luckyEnabled ?? true;
    let luckyPaise = luckyOn ? Math.floor(args.luckyPaise ?? 0) : 0;
    if (luckyOn && (!Number.isInteger(luckyPaise) || luckyPaise < 1 || luckyPaise > 99)) {
      throw new ConvexError({ code: "BAD_LUCKY_PAISE", value: args.luckyPaise });
    }

    // Wallet debit (purchase only; wallet_load cannot use wallet)
    let walletDebit = 0;
    if (args.kind === "purchase" && (args.walletAmountPaise ?? 0) > 0) {
      if (!org.walletEnabled)
        throw new ConvexError({ code: "WALLET_DISABLED" });
      walletDebit = Math.min(args.walletAmountPaise!, cartTotal - discountPaise);
      // Never let wallet eat the lucky paise: the fingerprint must survive
      // in the UPI amount or email matching can't tell orders apart.
      walletDebit = Math.max(0, Math.min(walletDebit, cartTotal - discountPaise - luckyPaise));
      await debitWallet(ctx, {
        orgId: args.orgId,
        userId,
        amountPaise: walletDebit,
        reason: "order_debit",
        createdBy: `user:${userId}`,
      });
    }

    const baseAmount = cartTotal - discountPaise - luckyPaise - walletDebit;
    const displayOrderId = genDisplayOrderId();

    // Fully-paid-by-wallet: no UPI, immediately paid. No slot needed — the
    // lucky discount still applies (customer keeps the saving).
    if (baseAmount === 0) {
      const orderId = await ctx.db.insert("orders", {
        orgId: args.orgId,
        userId,
        displayOrderId,
        kind: args.kind,
        retryOfOrderId: args.retryOfOrderId,
        items: orderItems,
        address: args.address,
        cartTotalPaise: cartTotal,
        walletDebitPaise: walletDebit,
        discountPaise,
        discountLabel: args.discountLabel,
        baseAmountPaise: 0,
        slotOffsetPaise: 0,
        finalAmountPaise: 0,
        upiUrl: "",
        status: "paid",
        verificationMethod: "wallet_only",
        createdAt: Date.now(),
        paidAt: Date.now(),
      });
      const paidOrder = await ctx.db.get(orderId);
      if (paidOrder) await commitOrderInventory(ctx, paidOrder, `user:${userId}`);
      // Link ledger debit to order
      await linkLatestDebitToOrder(ctx, args.orgId, userId, orderId);
      return {
        orderId,
        displayOrderId,
        finalAmountPaise: 0,
        upiUrl: null as string | null,
        status: "paid" as const,
      };
    }

    // UPI / mixed path: the payable IS the fingerprint — no additive slot.
    // Lucky paise keep same-rupee totals distinct for exact email matching.
    // Slot tables stay only for legacy rows.
    const finalAmount = baseAmount;

    // Pick a VPA — prefer active entry in paymentVpas, fall back to org.upiVpa.
    const activeVpa = await ctx.db
      .query("paymentVpas")
      .withIndex("by_org_active", (q) =>
        q.eq("orgId", args.orgId).eq("active", true),
      )
      .first();
    const payingVpa = activeVpa?.vpa ?? org.upiVpa;

    const upiUrl = buildUpiUrl({
      vpa: payingVpa,
      payeeName: org.name,
      amountPaise: finalAmount,
      referenceId: displayOrderId,
    });

    const orderId = await ctx.db.insert("orders", {
      orgId: args.orgId,
      userId,
      displayOrderId,
      kind: args.kind,
      retryOfOrderId: args.retryOfOrderId,
      items: orderItems,
      address: args.address,
      cartTotalPaise: cartTotal,
      walletDebitPaise: walletDebit,
      discountPaise: discountPaise + luckyPaise,
      discountLabel: args.discountLabel,
      shippingMethod: args.shippingMethod,
      shippingPricePaise: args.shippingPricePaise,
      // Legacy fingerprint columns, now vestigial: no slot is held, so the
      // base IS the final. Kept populated so old indexes/queries keep working.
      baseAmountPaise: finalAmount,
      slotOffsetPaise: 0,
      finalAmountPaise: finalAmount,
      slotId: undefined,
      upiUrl,
      status: "pending",
      createdAt: Date.now(),
      payingVpa,
      idempotencyKey: args.idempotencyKey,
    });

    if (args.kind === "purchase") {
      await reserveOrderInventory(ctx, args.orgId, orderItems, orderId, `user:${userId}`);
      await ctx.db.patch(orderId, { inventoryState: "reserved" });
    }

    if (activeVpa) {
      await ctx.db.patch(activeVpa._id, { lastUsedAt: Date.now() });
    }

    if (walletDebit > 0) {
      await linkLatestDebitToOrder(ctx, args.orgId, userId, orderId);
    }

    await ctx.scheduler.runAfter(
      org.slotTimeoutMs,
      internal.payments.expireHeldSlot,
      { orderId },
    );

    // Schedule 5 Gmail polls — the poller idle-skips when nothing is pending,
    // and ingest dedupes by messageId, so overlapping polls are safe.
    const pokeOffsets = [
      30_000,
      90_000,
      3 * 60_000,
      6 * 60_000,
      9 * 60_000 + 45_000,
    ];
    for (const ms of pokeOffsets) {
      await ctx.scheduler.runAfter(ms, internal.gmail.pollInbox, {
        orgId: args.orgId,
        reason: "scheduled",
      });
    }

    return {
      orderId,
      displayOrderId,
      finalAmountPaise: finalAmount,
      upiUrl,
      status: "pending" as const,
    };
  },
});

async function linkLatestDebitToOrder(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  userId: string,
  orderId: Id<"orders">,
) {
  const latest = await ctx.db
    .query("walletLedger")
    .withIndex("by_org_user_time", (q) =>
      q.eq("orgId", orgId).eq("userId", userId),
    )
    .order("desc")
    .first();
  if (latest && !latest.relatedOrderId && latest.reason === "order_debit") {
    await ctx.db.patch(latest._id, { relatedOrderId: orderId });
  }
}

export const cancelOrder = mutation({
  args: {
    orderId: v.id("orders"),
    userOpenedUpiApp: v.boolean(),
  },
  handler: async (ctx, { orderId, userOpenedUpiApp }) => {
    const order = await ctx.db.get(orderId);
    if (!order) throw new ConvexError({ code: "NOT_FOUND" });
    const { userId } = await requireMember(ctx, order.orgId);
    if (order.userId !== userId)
      throw new ConvexError({ code: "FORBIDDEN" });
    if (order.status !== "pending") return;

    await ctx.db.patch(orderId, {
      status: "cancelled",
      terminalAt: Date.now(),
    });
    await releaseOrderInventory(ctx, order, "system");

    // Refund wallet debit if any
    if (order.walletDebitPaise > 0 && !order.walletRefundedAt) {
      await creditWallet(ctx, {
        orgId: order.orgId,
        userId: order.userId,
        amountPaise: order.walletDebitPaise,
        reason: "order_cancelled_refund",
        relatedOrderId: orderId,
        createdBy: "system",
      });
      await ctx.db.patch(orderId, { walletRefundedAt: Date.now() });
    }

    if (!order.slotId) return;

    // Legacy slot rows (pre-lucky-fingerprint orders) still go through the
    // quarantine path; new orders never hold a slot so this is a no-op.
    if (userOpenedUpiApp) {
      // Payment may still arrive — quarantine
      await ctx.db.patch(order.slotId, {
        state: "quarantined",
        quarantinedAt: Date.now(),
      });
      const org = (await ctx.db.get(order.orgId))!;
      await ctx.scheduler.runAfter(
        org.quarantineMs,
        internal.payments.releaseQuarantine,
        { slotId: order.slotId },
      );
    } else {
      await freeSlot(ctx, order.slotId);
    }
  },
});

export const retryOrder = mutation({
  args: { oldOrderId: v.id("orders") },
  handler: async (ctx, { oldOrderId }): Promise<any> => {
    const old = await ctx.db.get(oldOrderId);
    if (!old) throw new ConvexError({ code: "NOT_FOUND" });
    const { userId } = await requireMember(ctx, old.orgId);
    if (old.userId !== userId)
      throw new ConvexError({ code: "FORBIDDEN" });
    if (!["expired", "cancelled"].includes(old.status))
      throw new ConvexError({ code: "NOT_RETRYABLE", status: old.status });

    // Delegate to createOrder. Wallet not reapplied automatically — user
    // can choose to reapply on the checkout UI if they want. Lucky re-rolls
    // per attempt so the new order gets a fresh fingerprint — unless the org
    // disabled it, in which case createOrder ignores the value (exact rupees).
    // Coupon vs lucky can't be told apart here (both live in discountPaise),
    // so the retry keeps the whole discount: worst case the new order is up
    // to 99p cheaper than the original — never more expensive, never a
    // matching hazard.
    const org = await ctx.db.get(old.orgId);
    const luckyOn = (org as any)?.luckyEnabled ?? true;
    return await ctx.runMutation(api.orders.createOrder, {
      orgId: old.orgId,
      kind: old.kind,
      items: old.items,
      address: old.address,
      walletAmountPaise: 0,
      discountPaise: old.discountPaise,
      discountLabel: old.discountLabel,
      luckyPaise: luckyOn ? 1 + Math.floor(Math.random() * 99) : 0,
      retryOfOrderId: oldOrderId,
    });
  },
});

// ---------- Queries ----------

export const getMine = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get(orderId);
    if (!order) return null;
    const identity = await requireIdentity(ctx);
    if (order.userId !== identity.subject) return null;
    return order;
  },
});

export const listMyOrders = query({
  args: {
    orgId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { orgId, limit }) => {
    const identity = await requireIdentity(ctx);
    return await ctx.db
      .query("orders")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", orgId).eq("userId", identity.subject),
      )
      .order("desc")
      .take(limit ?? 25);
  },
});
