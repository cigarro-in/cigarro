import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, mutation, query } from "./_generated/server";
import { requireIdentity, requireMember } from "./lib/auth";
import { genDisplayOrderId } from "./lib/ids";
import { assertPositiveInt } from "./lib/money";
import { buildUpiUrl } from "./lib/upi";
import { addressV, orderItemV, orderKind } from "./schema";
import { creditWallet, debitWallet } from "./wallet";

function computeCartTotal(items: Doc<"orders">["items"]): number {
  return items.reduce((sum, it) => {
    assertPositiveInt(it.unitPricePaise, "unitPricePaise");
    if (!Number.isInteger(it.qty) || it.qty <= 0) {
      throw new ConvexError({ code: "INVALID_QTY" });
    }
    return sum + it.unitPricePaise * it.qty;
  }, 0);
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
    retryOfOrderId: v.optional(v.id("orders")),
    idempotencyKey: v.optional(v.string()),
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

    // Input validation
    if (args.kind === "purchase") {
      if (args.items.length === 0)
        throw new ConvexError({ code: "EMPTY_CART" });
      if (!args.address)
        throw new ConvexError({ code: "ADDRESS_REQUIRED" });
    } else if (args.kind === "wallet_load") {
      if (args.items.length !== 1 || args.items[0].qty !== 1) {
        throw new ConvexError({ code: "INVALID_WALLET_LOAD" });
      }
    }

    const cartTotal = computeCartTotal(args.items);
    if (cartTotal <= 0)
      throw new ConvexError({ code: "ZERO_AMOUNT" });

    // Wallet debit (purchase only; wallet_load cannot use wallet)
    let walletDebit = 0;
    if (args.kind === "purchase" && (args.walletAmountPaise ?? 0) > 0) {
      if (!org.walletEnabled)
        throw new ConvexError({ code: "WALLET_DISABLED" });
      walletDebit = Math.min(args.walletAmountPaise!, cartTotal);
      await debitWallet(ctx, {
        orgId: args.orgId,
        userId,
        amountPaise: walletDebit,
        reason: "order_debit",
        createdBy: `user:${userId}`,
      });
    }

    const baseAmount = cartTotal - walletDebit;
    const displayOrderId = genDisplayOrderId();

    // Fully-paid-by-wallet: no slot, no UPI, immediately paid.
    if (baseAmount === 0) {
      const orderId = await ctx.db.insert("orders", {
        orgId: args.orgId,
        userId,
        displayOrderId,
        kind: args.kind,
        retryOfOrderId: args.retryOfOrderId,
        items: args.items,
        address: args.address,
        cartTotalPaise: cartTotal,
        walletDebitPaise: walletDebit,
        baseAmountPaise: 0,
        slotOffsetPaise: 0,
        finalAmountPaise: 0,
        upiUrl: "",
        status: "paid",
        verificationMethod: "wallet_only",
        createdAt: Date.now(),
        paidAt: Date.now(),
      });
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

    // UPI / mixed path: allocate slot (with ±1 rupee fallback on exhaustion)
    const { slot, effectiveBasePaise } = await allocateSlot(
      ctx,
      args.orgId,
      baseAmount,
      org.slotsPerBase,
    );
    const finalAmount = effectiveBasePaise + slot.slot;

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
      items: args.items,
      address: args.address,
      cartTotalPaise: cartTotal,
      walletDebitPaise: walletDebit,
      baseAmountPaise: effectiveBasePaise,
      slotOffsetPaise: slot.slot,
      finalAmountPaise: finalAmount,
      slotId: slot._id,
      upiUrl,
      status: "pending",
      createdAt: Date.now(),
      payingVpa,
      idempotencyKey: args.idempotencyKey,
    });

    if (activeVpa) {
      await ctx.db.patch(activeVpa._id, { lastUsedAt: Date.now() });
    }

    if (walletDebit > 0) {
      await linkLatestDebitToOrder(ctx, args.orgId, userId, orderId);
    }

    await ctx.db.patch(slot._id, {
      state: "held",
      orderId,
      heldAt: Date.now(),
    });

    await ctx.scheduler.runAfter(
      org.slotTimeoutMs,
      internal.payments.expireHeldSlot,
      { orderId },
    );

    // Schedule the 5 Gmail pokes — idle-skipped server-side if no GAS config.
    const pokeOffsets = [
      30_000,
      90_000,
      3 * 60_000,
      6 * 60_000,
      9 * 60_000 + 45_000,
    ];
    for (const ms of pokeOffsets) {
      await ctx.scheduler.runAfter(ms, internal.scheduler.pokeGas, {
        orgId: args.orgId,
        reason: "scheduled",
        triggerOrderId: orderId,
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
  handler: async (ctx, { oldOrderId }) => {
    const old = await ctx.db.get(oldOrderId);
    if (!old) throw new ConvexError({ code: "NOT_FOUND" });
    const { userId } = await requireMember(ctx, old.orgId);
    if (old.userId !== userId)
      throw new ConvexError({ code: "FORBIDDEN" });
    if (!["expired", "cancelled"].includes(old.status))
      throw new ConvexError({ code: "NOT_RETRYABLE", status: old.status });

    // Delegate to createOrder. Wallet not reapplied automatically — user
    // can choose to reapply on the checkout UI if they want.
    return await ctx.runMutation(api.orders.createOrder, {
      orgId: old.orgId,
      kind: old.kind,
      items: old.items,
      address: old.address,
      walletAmountPaise: 0,
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

