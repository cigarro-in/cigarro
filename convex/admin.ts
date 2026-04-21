import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOrgAdmin } from "./lib/auth";
import { audit } from "./lib/audit";
import { freeSlot } from "./orders";
import { orderStatus, shippingStatus } from "./schema";
import { creditWallet } from "./wallet";

// ---------- Mark a pending order as paid manually ----------

export const markPaid = mutation({
  args: {
    orderId: v.id("orders"),
    reference: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { orderId, reference, note }) => {
    const order = await ctx.db.get(orderId);
    if (!order) throw new ConvexError({ code: "NOT_FOUND" });
    const { identity } = await requireOrgAdmin(ctx, order.orgId);
    if (order.status === "paid" || order.status === "late_paid") return;

    await ctx.db.patch(orderId, {
      status: "paid",
      paidAt: Date.now(),
      verificationMethod: "admin_manual",
    });

    if (order.slotId) await freeSlot(ctx, order.slotId);

    if (order.kind === "wallet_load") {
      await creditWallet(ctx, {
        orgId: order.orgId,
        userId: order.userId,
        amountPaise: order.finalAmountPaise,
        reason: "wallet_load_credit",
        relatedOrderId: orderId,
        createdBy: `admin:${identity.subject}`,
        note: `manual:${reference}`,
      });
    }

    await audit(ctx, {
      orgId: order.orgId,
      adminUserId: identity.subject,
      action: "order.mark_paid",
      targetType: "order",
      targetId: orderId,
      payload: { reference, note },
    });
  },
});

// ---------- Refund a paid order (credit to wallet OR flag for manual bank refund) ----------

export const refundOrder = mutation({
  args: {
    orderId: v.id("orders"),
    toWallet: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { orderId, toWallet, note }) => {
    const order = await ctx.db.get(orderId);
    if (!order) throw new ConvexError({ code: "NOT_FOUND" });
    const { identity } = await requireOrgAdmin(ctx, order.orgId);
    if (!["paid", "late_paid"].includes(order.status))
      throw new ConvexError({ code: "NOT_REFUNDABLE", status: order.status });

    await ctx.db.patch(orderId, {
      status: "refunded",
      terminalAt: Date.now(),
    });

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
      payload: { toWallet, note },
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

export const listUnmatchedEmails = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireOrgAdmin(ctx, orgId);
    return await ctx.db
      .query("bankEmails")
      .withIndex("by_org_status", (q) =>
        q.eq("orgId", orgId).eq("status", "no_match"),
      )
      .order("desc")
      .take(100);
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
    if (status) {
      return await ctx.db
        .query("orders")
        .withIndex("by_org_status", (q) =>
          q.eq("orgId", orgId).eq("status", status),
        )
        .order("desc")
        .take(limit ?? 50);
    }
    return await ctx.db
      .query("orders")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(limit ?? 50);
  },
});
