import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, internalMutation } from "./_generated/server";
import { parseWithTemplates, parseBankEmail } from "./lib/email";
import { freeSlot } from "./orders";
import { creditWallet } from "./wallet";

// ---------- Scheduled cleanups ----------

export const expireHeldSlot = internalMutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get(orderId);
    if (!order) return;
    if (order.status !== "pending") return;

    await ctx.db.patch(orderId, {
      status: "expired",
      terminalAt: Date.now(),
    });

    if (order.walletDebitPaise > 0 && !order.walletRefundedAt) {
      await creditWallet(ctx, {
        orgId: order.orgId,
        userId: order.userId,
        amountPaise: order.walletDebitPaise,
        reason: "order_expired_refund",
        relatedOrderId: orderId,
        createdBy: "system",
      });
      await ctx.db.patch(orderId, { walletRefundedAt: Date.now() });
    }

    if (order.slotId) {
      const org = await ctx.db.get(order.orgId);
      await ctx.db.patch(order.slotId, {
        state: "quarantined",
        quarantinedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(
        org?.quarantineMs ?? 20 * 60 * 1000,
        internal.payments.releaseQuarantine,
        { slotId: order.slotId },
      );
    }
  },
});

export const releaseQuarantine = internalMutation({
  args: { slotId: v.id("paymentSlots") },
  handler: async (ctx, { slotId }) => {
    const slot = await ctx.db.get(slotId);
    if (!slot || slot.state !== "quarantined") return;
    await freeSlot(ctx, slotId);
  },
});

// ---------- Bank email ingestion (public entrypoint called via HTTP) ----------

/**
 * Called by the external GAS/worker when a bank email is received or discovered.
 * Deduplicates by messageId, resolves the org via bankInboxes (or legacy alias),
 * picks a parser template, and attempts to match the credit to an order.
 */
export const ingestBankEmail = internalMutation({
  args: {
    to: v.optional(v.string()), // inbox alias that received the email
    alias: v.optional(v.string()), // legacy: local-part only
    from: v.string(),
    subject: v.optional(v.string()),
    textBody: v.optional(v.string()),
    htmlBody: v.optional(v.string()),
    rawBody: v.optional(v.string()), // legacy
    messageId: v.string(),
  },
  handler: async (ctx, args) => {
    // 1) Idempotency by message-id
    const seen = await ctx.db
      .query("bankEmails")
      .withIndex("by_message_id", (q) =>
        q.eq("gmailMessageId", args.messageId),
      )
      .unique();
    if (seen) return { duplicate: true, emailId: seen._id };

    // 2) Resolve org — prefer new bankInboxes, fall back to legacy org.bankEmailAlias
    const toLower = (args.to ?? "").toLowerCase();
    let orgId: Id<"organizations"> | undefined;

    if (toLower) {
      const inbox = await ctx.db
        .query("bankInboxes")
        .withIndex("by_alias", (q) => q.eq("alias", toLower))
        .unique();
      if (inbox && inbox.active) orgId = inbox.orgId;
    }
    if (!orgId) {
      const localPart = (args.alias ?? toLower.split("@")[0] ?? "").trim();
      if (localPart) {
        const legacyOrg = await ctx.db
          .query("organizations")
          .withIndex("by_alias", (q) => q.eq("bankEmailAlias", localPart))
          .unique();
        if (legacyOrg) orgId = legacyOrg._id;
      }
    }
    if (!orgId) return { orgNotFound: true };

    // 3) Assemble the body text for parsing
    const body =
      args.textBody ||
      args.htmlBody ||
      args.rawBody ||
      "";

    // 4) Pick templates and attempt extraction
    const orgTemplates = await ctx.db
      .query("bankEmailTemplates")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const systemTemplates = await ctx.db
      .query("bankEmailTemplates")
      .withIndex("by_org", (q) => q.eq("orgId", undefined))
      .collect();
    const templates = [...orgTemplates, ...systemTemplates];

    const parsed =
      templates.length > 0
        ? parseWithTemplates(
            { from: args.from, subject: args.subject, body },
            templates.map((t) => ({
              _id: t._id,
              bankKey: t.bankKey,
              label: t.label,
              senderRegex: t.senderRegex,
              subjectRegex: t.subjectRegex,
              amountRegex: t.amountRegex,
              refRegex: t.refRegex,
              payerVpaRegex: t.payerVpaRegex,
              payerNameRegex: t.payerNameRegex,
              creditOnly: t.creditOnly,
              debitGuardRegex: t.debitGuardRegex,
              priority: t.priority,
              active: t.active,
            })),
          )
        : parseBankEmail(body);

    // 5) Persist the raw email for audit/reconciliation regardless of outcome
    const emailId = await ctx.db.insert("bankEmails", {
      orgId,
      gmailMessageId: args.messageId,
      receivedAt: Date.now(),
      amountPaise: parsed?.amountPaise ?? 0,
      senderEmail: args.from,
      toAlias: toLower || undefined,
      bankKey: parsed?.bankKey,
      templateId: (parsed?.templateId as Id<"bankEmailTemplates"> | undefined) ?? undefined,
      upiRef: parsed?.upiRef,
      payerVpa: parsed?.payerVpa,
      payerName: parsed?.payerName,
      subject: args.subject,
      rawBody: body,
      status: parsed ? "unmatched" : "parse_failed",
    });

    if (!parsed) return { parsed: false, emailId };

    // 6) Duplicate-by-UPI-ref check — same reference already processed
    if (parsed.upiRef) {
      const prior = await ctx.db
        .query("bankEmails")
        .withIndex("by_upi_ref", (q) => q.eq("upiRef", parsed.upiRef!))
        .filter((q) => q.neq(q.field("_id"), emailId))
        .first();
      if (prior) {
        await ctx.db.patch(emailId, {
          status: "duplicate",
          duplicateOfEmailId: prior._id,
        });
        return { duplicate: true, emailId, priorEmailId: prior._id };
      }
    }

    // 7) Try to match the credit to an order
    return await matchEmailToOrder(ctx, emailId, orgId, parsed);
  },
});

// ---------- Matching logic ----------

interface ParsedForMatch {
  amountPaise: number;
  upiRef?: string;
  payerVpa?: string;
  payerName?: string;
}

async function matchEmailToOrder(
  ctx: MutationCtx,
  emailId: Id<"bankEmails">,
  orgId: Id<"organizations">,
  parsed: ParsedForMatch,
) {
  const { amountPaise, upiRef, payerVpa, payerName } = parsed;

  // 1) Exact match on a pending order at that amount
  const pending = await ctx.db
    .query("orders")
    .withIndex("by_org_final_status", (q) =>
      q
        .eq("orgId", orgId)
        .eq("finalAmountPaise", amountPaise)
        .eq("status", "pending"),
    )
    .first();

  if (pending) {
    await markOrderPaid(ctx, pending, emailId, "paid", { upiRef, payerVpa, payerName });
    return { matched: true, orderId: pending._id, via: "pending" };
  }

  // 2) Auto-apply late payment on an expired order within quarantine window
  const org = await ctx.db.get(orgId);
  const quarantineMs = org?.quarantineMs ?? 20 * 60 * 1000;
  const cutoff = Date.now() - quarantineMs;
  const expired = await ctx.db
    .query("orders")
    .withIndex("by_org_final_status", (q) =>
      q
        .eq("orgId", orgId)
        .eq("finalAmountPaise", amountPaise)
        .eq("status", "expired"),
    )
    .order("desc")
    .first();
  if (expired && expired.terminalAt && expired.terminalAt >= cutoff) {
    await markOrderPaid(ctx, expired, emailId, "late_paid", {
      upiRef,
      payerVpa,
      payerName,
    });
    return { matched: true, orderId: expired._id, via: "auto_late" };
  }

  // 3) Duplicate / overpayment: amount matches a recently-paid order
  //    Credit the difference to the customer's wallet, mark email as duplicate.
  const recentPaid = await ctx.db
    .query("orders")
    .withIndex("by_org_final_status", (q) =>
      q
        .eq("orgId", orgId)
        .eq("finalAmountPaise", amountPaise)
        .eq("status", "paid"),
    )
    .order("desc")
    .first();
  if (
    recentPaid &&
    recentPaid.paidAt &&
    recentPaid.paidAt >= Date.now() - 6 * 60 * 60 * 1000
  ) {
    await ctx.db.patch(recentPaid._id, {
      extraCreditsPaise: (recentPaid.extraCreditsPaise ?? 0) + amountPaise,
    });
    await creditWallet(ctx, {
      orgId,
      userId: recentPaid.userId,
      amountPaise,
      reason: "duplicate_payment_credit",
      relatedOrderId: recentPaid._id,
      createdBy: "system",
      note: `duplicate for order ${recentPaid.displayOrderId}${upiRef ? ` (ref ${upiRef})` : ""}`,
    });
    await ctx.db.patch(emailId, {
      status: "duplicate",
      matchedOrderId: recentPaid._id,
    });
    return {
      matched: false,
      duplicate: true,
      creditedOrder: recentPaid._id,
    };
  }

  // 4) No match — orphan payment for admin
  await ctx.db.patch(emailId, { status: "no_match" });
  return { matched: false };
}

async function markOrderPaid(
  ctx: MutationCtx,
  order: Doc<"orders">,
  emailId: Id<"bankEmails">,
  newStatus: "paid" | "late_paid",
  extras: { upiRef?: string; payerVpa?: string; payerName?: string },
) {
  await ctx.db.patch(order._id, {
    status: newStatus,
    paidAt: Date.now(),
    verificationMethod: "email",
    bankEmailId: emailId,
    payerVpa: extras.payerVpa,
    payerName: extras.payerName,
  });

  if (order.kind === "wallet_load") {
    await creditWallet(ctx, {
      orgId: order.orgId,
      userId: order.userId,
      amountPaise: order.finalAmountPaise,
      reason: "wallet_load_credit",
      relatedOrderId: order._id,
      createdBy: "system",
    });
  }

  if (order.slotId) await freeSlot(ctx, order.slotId);

  await ctx.db.patch(emailId, {
    status: "matched",
    matchedOrderId: order._id,
  });
}
