import { ConvexError, v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { MutationCtx, mutation, query } from "./_generated/server";
import { requireOrgAdmin, requirePaymentsAdmin } from "./lib/auth";
import { onOrderPaid, onOrderReversed } from "./platformFees";
import { audit } from "./lib/audit";
import { freeSlot, scheduleOrderExpiry } from "./orders";
import { orderStatus, shippingStatus } from "./schema";
import { creditWallet } from "./wallet";
import { commitOrderInventory, releaseOrderInventory, returnOrderInventory } from "./lib/inventory";
import { rewardDeliveredReferral, rewardPaidReferral } from "./referrals";
import { schedulePaidOrderPush } from "./push";
import { clampPageSize, pageArgs, scanPage } from "./lib/pagination";
import { deriveOrderStage, orderSearchTextServer, STAGE_FILTER_STAGES } from "./lib/orderStage";
import { orderNumberOf } from "./lib/ids";

// ---------- Mark a pending order as paid manually ----------

// Shared by markPaid and confirmPaymentClaim so both take the same path.
// An expired or cancelled order paid afterwards becomes late_paid, the same
// status the bank-email path gives a payment that lands after expiry.
async function markPaidByAdmin(
  ctx: MutationCtx,
  order: Doc<"orders">,
  actorId: string, // store admin userId, or sa:<id> for the platform org
  reference: string,
  note: string | undefined,
  auditAction: string,
) {
  const orderId = order._id;
  const previousStatus = order.status;
  const afterTimeout = previousStatus === "expired" || previousStatus === "cancelled";
  const newStatus = afterTimeout ? "late_paid" : "paid";
  await ctx.db.patch(orderId, {
    status: newStatus,
    paidAt: Date.now(),
    verificationMethod: "admin_manual",
    ...(order.paymentClaim?.status === "review"
      ? {
          paymentClaim: {
            utr: order.paymentClaim.utr,
            submittedAt: order.paymentClaim.submittedAt,
            status: "confirmed" as const,
            reviewedAt: Date.now(),
            confirmedVia: "admin" as const,
          },
        }
      : {}),
  });
  await schedulePaidOrderPush(ctx, orderId);
  await commitOrderInventory(ctx, order, `admin:${actorId}`);

  // Expiry already freed the slot, and another order may hold it by now.
  if (order.slotId && !afterTimeout) await freeSlot(ctx, order.slotId);

  if (order.kind === "wallet_load") {
    await creditWallet(ctx, {
      orgId: order.orgId,
      userId: order.userId,
      amountPaise: order.finalAmountPaise,
      reason: "wallet_load_credit",
      relatedOrderId: orderId,
      createdBy: `admin:${actorId}`,
      note: `manual:${reference}`,
    });
  }

  // Marketplace fee (stores) or merchant ledger credit (platform-org deposit/dues).
  await onOrderPaid(ctx, orderId);

  // Refer & earn: rewards credited on payment when the store's rule says so.
  await rewardPaidReferral(ctx, { ...order, status: newStatus }, `admin:${actorId}`);

  await audit(ctx, {
    orgId: order.orgId,
    adminUserId: actorId,
    action: auditAction,
    targetType: "order",
    targetId: orderId,
    payload: { reference, note, previousStatus, newStatus },
  });
}

export const markPaid = mutation({
  args: {
    orderId: v.id("orders"),
    reference: v.string(),
    note: v.optional(v.string()),
    // Super admin acting on the platform org only (lib/auth requirePaymentsAdmin).
    saToken: v.optional(v.string()),
  },
  handler: async (ctx, { orderId, reference, note, saToken }) => {
    const order = await ctx.db.get(orderId);
    if (!order) throw new ConvexError({ code: "NOT_FOUND" });
    const { userId: actorId } = await requirePaymentsAdmin(ctx, order.orgId, saToken, "write");
    if (order.status === "paid" || order.status === "late_paid") return;
    if (["refunded", "voided"].includes(order.status))
      throw new ConvexError({ code: "ORDER_NOT_PAYABLE", status: order.status });
    if (order.walletDebitPaise > 0 && order.walletRefundedAt)
      throw new ConvexError({
        code: "WALLET_PORTION_ALREADY_REFUNDED",
        message: "The wallet part of this order was already returned to the customer.",
      });

    // Payment window timed out but the customer paid. If they already placed a
    // retry that is pending or paid, marking this one paid would count the
    // same payment twice: handle the retry instead.
    const afterTimeout = order.status === "expired" || order.status === "cancelled";
    if (afterTimeout) {
      const retries = await ctx.db
        .query("orders")
        .withIndex("by_retry_of", (q) => q.eq("retryOfOrderId", orderId))
        .collect();
      const live = retries.find((r) => ["pending", "paid", "late_paid"].includes(r.status));
      if (live)
        throw new ConvexError({
          code: "RETRY_ORDER_EXISTS",
          message: `The customer already placed a retry for this order (${orderNumberOf(live) !== undefined ? `#${orderNumberOf(live)}` : "see their orders"}, ${live.status}). Mark that one paid instead.`,
          retryOrderId: live._id,
        });
    }

    await markPaidByAdmin(
      ctx,
      order,
      actorId,
      reference,
      note,
      afterTimeout ? "order.mark_paid_after_timeout" : "order.mark_paid",
    );
  },
});

// ---------- Customer payment claims (UTR the customer submitted) ----------

export const confirmPaymentClaim = mutation({
  args: { orderId: v.id("orders"), saToken: v.optional(v.string()) },
  handler: async (ctx, { orderId, saToken }) => {
    const order = await ctx.db.get(orderId);
    if (!order) throw new ConvexError({ code: "NOT_FOUND" });
    const { userId: actorId } = await requirePaymentsAdmin(ctx, order.orgId, saToken, "write");
    const claim = order.paymentClaim;
    if (!claim || claim.status !== "review")
      throw new ConvexError({ code: "CLAIM_NOT_UNDER_REVIEW" });

    // Already paid by a bank message or another path: close the review only.
    if (order.status === "paid" || order.status === "late_paid") {
      await ctx.db.patch(orderId, {
        paymentClaim: {
          utr: claim.utr,
          submittedAt: claim.submittedAt,
          status: "confirmed",
          reviewedAt: Date.now(),
          confirmedVia: "auto",
        },
      });
      return;
    }
    if (order.status !== "pending")
      throw new ConvexError({ code: "ORDER_NOT_PAYABLE", status: order.status });
    if (order.walletDebitPaise > 0 && order.walletRefundedAt)
      throw new ConvexError({ code: "WALLET_PORTION_ALREADY_REFUNDED" });

    await markPaidByAdmin(
      ctx,
      order,
      actorId,
      `customer_claim:${claim.utr}`,
      undefined,
      "order.confirm_payment_claim",
    );
  },
});

export const rejectPaymentClaim = mutation({
  args: { orderId: v.id("orders"), reason: v.optional(v.string()), saToken: v.optional(v.string()) },
  handler: async (ctx, { orderId, reason, saToken }) => {
    const order = await ctx.db.get(orderId);
    if (!order) throw new ConvexError({ code: "NOT_FOUND" });
    const { userId: actorId } = await requirePaymentsAdmin(ctx, order.orgId, saToken, "write");
    const claim = order.paymentClaim;
    if (!claim || claim.status !== "review")
      throw new ConvexError({ code: "CLAIM_NOT_UNDER_REVIEW" });

    const rejectReason = reason?.trim() ? reason.trim().slice(0, 300) : undefined;
    await ctx.db.patch(orderId, {
      paymentClaim: {
        utr: claim.utr,
        submittedAt: claim.submittedAt,
        status: "rejected",
        reviewedAt: Date.now(),
        ...(rejectReason ? { rejectReason } : {}),
      },
    });

    // Expiry was skipped while under review: schedule it again now.
    if (order.status === "pending") {
      const org = await ctx.db.get(order.orgId);
      if (org) await scheduleOrderExpiry(ctx, order, org.slotTimeoutMs);
    }

    await audit(ctx, {
      orgId: order.orgId,
      adminUserId: actorId,
      action: "order.reject_payment_claim",
      targetType: "order",
      targetId: orderId,
      payload: { utr: claim.utr, reason: rejectReason ?? null },
    });
  },
});

// ---------- Refund a paid order (credit to wallet OR flag for manual bank refund) ----------

export const refundOrder = mutation({
  args: {
    orderId: v.id("orders"),
    toWallet: v.boolean(),
    restock: v.optional(v.boolean()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { orderId, toWallet, restock, note }) => {
    const order = await ctx.db.get(orderId);
    if (!order) throw new ConvexError({ code: "NOT_FOUND" });
    const { identity } = await requireOrgAdmin(ctx, order.orgId);
    if (!["paid", "late_paid"].includes(order.status))
      throw new ConvexError({ code: "NOT_REFUNDABLE", status: order.status });

    await ctx.db.patch(orderId, {
      status: "refunded",
      terminalAt: Date.now(),
      refundDestination: toWallet ? "wallet" : "bank",
    });
    if (restock) await returnOrderInventory(ctx, order, `admin:${identity.subject}`);
    await onOrderReversed(ctx, orderId, "refunded", `admin:${identity.subject}`);

    // A mixed-wallet order has two customer-funded portions. The UPI portion
    // follows the selected refund destination; the wallet portion must always
    // return to the wallet or it would be silently lost on a bank refund.
    if (order.walletDebitPaise > 0 && !order.walletRefundedAt) {
      await creditWallet(ctx, {
        orgId: order.orgId,
        userId: order.userId,
        amountPaise: order.walletDebitPaise,
        reason: "order_refund_admin",
        relatedOrderId: orderId,
        createdBy: `admin:${identity.subject}`,
        note: "wallet portion of order refund",
      });
      await ctx.db.patch(orderId, { walletRefundedAt: Date.now() });
    }

    if (toWallet) {
      await creditWallet(ctx, {
        orgId: order.orgId,
        userId: order.userId,
        amountPaise: order.finalAmountPaise,
        reason: "order_refund_admin",
        relatedOrderId: orderId,
        createdBy: `admin:${identity.subject}`,
        note,
      });
    }
    // If !toWallet, the admin will process a bank refund out of band.

    await audit(ctx, {
      orgId: order.orgId,
      adminUserId: identity.subject,
      action: "order.refund",
      targetType: "order",
      targetId: orderId,
      payload: { toWallet, restock: restock ?? false, note },
    });
  },
});

// ---------- Void a pending/expired order without payment side effects ----------

export const voidOrder = mutation({
  args: {
    orderId: v.id("orders"),
    reason: v.string(),
  },
  handler: async (ctx, { orderId, reason }) => {
    const order = await ctx.db.get(orderId);
    if (!order) throw new ConvexError({ code: "NOT_FOUND" });
    const { identity } = await requireOrgAdmin(ctx, order.orgId);
    if (["paid", "late_paid", "refunded"].includes(order.status)) {
      throw new ConvexError({ code: "CANNOT_VOID_PAID_ORDER" });
    }

    await ctx.db.patch(orderId, {
      status: "voided",
      terminalAt: Date.now(),
    });
    await releaseOrderInventory(ctx, order, `admin:${identity.subject}`);
    // No-op today (paid orders cannot be voided); keeps fees right if that changes.
    await onOrderReversed(ctx, orderId, "voided", `admin:${identity.subject}`);

    if (order.walletDebitPaise > 0 && !order.walletRefundedAt) {
      await creditWallet(ctx, {
        orgId: order.orgId,
        userId: order.userId,
        amountPaise: order.walletDebitPaise,
        reason: "order_cancelled_refund",
        relatedOrderId: orderId,
        createdBy: `admin:${identity.subject}`,
      });
      await ctx.db.patch(orderId, { walletRefundedAt: Date.now() });
    }

    if (order.slotId) await freeSlot(ctx, order.slotId);

    await audit(ctx, {
      orgId: order.orgId,
      adminUserId: identity.subject,
      action: "order.void",
      targetType: "order",
      targetId: orderId,
      payload: { reason },
    });
  },
});

// NOTE: Previous `resolveLatePayment` and `listPendingLatePayments` queries
// are removed — late payments are now auto-applied in `payments.ingestBankEmail`
// (see the auto-late-apply branch). The latePayments table remains in the
// schema for historical records but nothing writes to it anymore.

// ---------- Admin queries ----------

export const listRecentBankEmails = query({
  args: {
    orgId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { orgId, limit }) => {
    await requireOrgAdmin(ctx, orgId);
    const n = clampPageSize(limit);
    // Pull a wider window and sort in memory by receivedAt desc — bankEmails
    // doesn't have a by_org_receivedAt index but volume is small (shops
    // process hundreds/day max and we only show the tail).
    const rows = await ctx.db
      .query("bankEmails")
      .withIndex("by_org_status", (q) => q.eq("orgId", orgId))
      .take(200);
    return rows
      .slice()
      .sort((a, b) => b.receivedAt - a.receivedAt)
      .slice(0, n);
  },
});

export const listUnmatchedEmails = query({
  args: { orgId: v.id("organizations"), limit: v.optional(v.number()) },
  handler: async (ctx, { orgId, limit }) => {
    await requireOrgAdmin(ctx, orgId);
    // Every non-terminal email state: parse failures, close-but-no-match,
    // nothing-close, and legacy leftovers. Matched/duplicate/ignored are
    // resolved by definition and stay out.
    const rows = await ctx.db
      .query("bankEmails")
      .withIndex("by_org_status", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(300);
    const open = new Set(["no_match", "no_candidate", "parse_failed", "unmatched"]);
    return rows.filter((r) => open.has(r.status)).slice(0, clampPageSize(limit));
  },
});

// ---------- Shipping lifecycle ----------

export const updateShipping = mutation({
  args: {
    orderId: v.id("orders"),
    shippingStatus: v.optional(shippingStatus),
    trackingCarrier: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
    trackingUrl: v.optional(v.string()),
    shippingNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new ConvexError({ code: "NOT_FOUND" });
    const { identity } = await requireOrgAdmin(ctx, order.orgId);
    if (order.kind !== "purchase")
      throw new ConvexError({ code: "NOT_SHIPPABLE" });
    if (!["paid", "late_paid"].includes(order.status))
      throw new ConvexError({ code: "ORDER_NOT_PAID", status: order.status });

    const patch: Record<string, unknown> = {};
    const now = Date.now();

    if (args.shippingStatus !== undefined) {
      patch.shippingStatus = args.shippingStatus;
      if (args.shippingStatus === "shipped" && !order.shippedAt)
        patch.shippedAt = now;
      if (args.shippingStatus === "delivered" && !order.deliveredAt)
        patch.deliveredAt = now;
    }
    if (args.trackingCarrier !== undefined)
      patch.trackingCarrier = args.trackingCarrier;
    if (args.trackingNumber !== undefined)
      patch.trackingNumber = args.trackingNumber;
    if (args.trackingUrl !== undefined) patch.trackingUrl = args.trackingUrl;
    if (args.shippingNotes !== undefined)
      patch.shippingNotes = args.shippingNotes;

    await ctx.db.patch(args.orderId, patch);

    if (args.shippingStatus === "delivered") {
      await rewardDeliveredReferral(ctx, order, `admin:${identity.subject}`);
    }

    await audit(ctx, {
      orgId: order.orgId,
      adminUserId: identity.subject,
      action: "order.update_shipping",
      targetType: "order",
      targetId: args.orderId,
      payload: patch,
    });
  },
});

export const getOrder = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get(orderId);
    if (!order) return null;
    await requireOrgAdmin(ctx, order.orgId);
    return order;
  },
});

export const listRecentOrders = query({
  args: {
    orgId: v.id("organizations"),
    status: v.optional(orderStatus),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { orgId, status, limit }) => {
    await requireOrgAdmin(ctx, orgId);
    const n = clampPageSize(limit);
    if (status) {
      return await ctx.db
        .query("orders")
        .withIndex("by_org_status", (q) =>
          q.eq("orgId", orgId).eq("status", status),
        )
        .order("desc")
        .take(n);
    }
    return await ctx.db
      .query("orders")
      .withIndex("by_org_created", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(n);
  },
});

// Admin orders list, one page at a time. Newest first. Stage and search are
// applied while scanning (a sparse filter may return a short page with
// isDone false; keep calling with continueCursor). Dates: from inclusive, to
// exclusive, both ms timestamps.
export const listOrdersPage = query({
  args: {
    orgId: v.id("organizations"),
    stage: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    search: v.optional(v.string()),
    ...pageArgs,
  },
  handler: async (ctx, { orgId, stage, from, to, search, cursor, pageSize }) => {
    await requireOrgAdmin(ctx, orgId);
    if (stage !== undefined && !Object.prototype.hasOwnProperty.call(STAGE_FILTER_STAGES, stage)) {
      throw new ConvexError({ code: "BAD_STAGE" });
    }
    const stages = stage && stage !== "all" ? STAGE_FILTER_STAGES[stage] : null;
    const q = (search ?? "").trim().toLowerCase();
    const toInclusive = to !== undefined ? to - 1 : undefined;

    return await scanPage<Doc<"orders">>({
      cursor,
      pageSize,
      keyOf: (o) => o.createdAt,
      build: (after) => {
        const afterKey = after ? after.key : undefined;
        const bound =
          toInclusive === undefined
            ? afterKey
            : afterKey === undefined
              ? toInclusive
              : Math.min(toInclusive, afterKey);
        return ctx.db
          .query("orders")
          .withIndex("by_org_created", (ix) => {
            const lower = ix.eq("orgId", orgId).gte("createdAt", from ?? 0);
            return bound === undefined ? lower : lower.lte("createdAt", bound);
          })
          .order("desc");
      },
      match: (o) => {
        if (stages && !stages.includes(deriveOrderStage(o))) return false;
        if (q === "") return true;
        const num = orderNumberOf(o);
        return orderSearchTextServer(o, num === undefined ? "" : String(num)).includes(q);
      },
    });
  },
});

// Pending orders where a customer reported a payment that is awaiting review.
export const listPaymentClaims = query({
  args: { orgId: v.id("organizations"), saToken: v.optional(v.string()) },
  handler: async (ctx, { orgId, saToken }) => {
    await requirePaymentsAdmin(ctx, orgId, saToken, "read");
    return await ctx.db
      .query("orders")
      .withIndex("by_org_claim_status", (q) =>
        q.eq("orgId", orgId).eq("paymentClaim.status", "review"),
      )
      .order("desc")
      .take(100);
  },
});

// Find one order by its five-digit customer-facing number (admin search).
// Legacy rows without orderNumber are not findable here; search them by
// displayOrderId in the client list instead.
export const findOrderByNumber = query({
  args: {
    orgId: v.id("organizations"),
    orderNumber: v.number(),
  },
  handler: async (ctx, { orgId, orderNumber }) => {
    await requireOrgAdmin(ctx, orgId);
    return await ctx.db
      .query("orders")
      .withIndex("by_org_order_number", (q) =>
        q.eq("orgId", orgId).eq("orderNumber", orderNumber),
      )
      .first();
  },
});
