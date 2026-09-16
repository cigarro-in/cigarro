import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, internalMutation } from "./_generated/server";
import { parseWithTemplates, parseBankEmail } from "./lib/email";
import { isValidOrderNumber } from "./lib/ids";
import { freeSlot } from "./orders";
import { creditWallet } from "./wallet";
import { commitOrderInventory, releaseOrderInventory } from "./lib/inventory";

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
    await releaseOrderInventory(ctx, order, "system");

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
 * Ingest one bank-credit email and attempt to match it to an order.
 * Called by the Gmail poller (primary feed) or the push webhook (fallback).
 * Deduplicates by messageId; safe to re-ingest the same email.
 */
export const ingestBankEmail = internalMutation({
  args: {
    orgId: v.optional(v.id("organizations")),
    to: v.optional(v.string()),
    alias: v.optional(v.string()),
    from: v.string(),
    subject: v.optional(v.string()),
    textBody: v.optional(v.string()),
    htmlBody: v.optional(v.string()),
    rawBody: v.optional(v.string()),
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

    // 2) Resolve org.
    //    Prefer the explicit orgId passed by the Gmail poller (it polls one
    //    bound inbox, so the email's `to:` can't identify the tenant).
    //    Fall back to bankInboxes / legacy org.bankEmailAlias for the push
    //    webhook path.
    const toLower = (args.to ?? "").toLowerCase();
    let orgId: Id<"organizations"> | undefined = args.orgId;

    if (!orgId && toLower) {
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

    if (!parsed) {
      // Re-check: this row may be a re-ingest of an email that already
      // errored. But a row with amountPaise > 0 / upiRef / amount-like text
      // is a TEMPLATE gap, not junk — keep it visible as unmatched so the
      // admin tab + seed-sync can act on it instead of silently ignoring.
      const looksPayable =
        /rs\.?\s*[0-9]|inr\s*[0-9]|₹\s*[0-9]|credited|upi\s+ref/i.test(body);
      if (looksPayable) {
        await ctx.db.patch(emailId, { status: "unmatched" });
        return await matchEmailToOrder(ctx, emailId, orgId, {
          amountPaise: 0,
          upiRef: undefined,
          payerVpa: undefined,
          payerName: undefined,
        });
      }
      // No amount could be extracted at all (e.g. marketing mail). Mark
      // separately so the admin Unmatched tab isn't flooded with statements
      // and promos — those were never payable candidates.
      await ctx.db.patch(emailId, { status: "ignored" });
      return { parsed: false, emailId };
    }

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

  // 0) UPI ref first: exact, collision-proof, amount-independent. Our
  //    deeplink sets tr=<displayOrderId>, but the bank's credit alert
  //    carries the BANK's ref (UTR/RRN), not our tr — so this only hits
  //    when a template was explicitly taught the mapping. Falls through
  //    to amount matching otherwise.
  if (upiRef) {
    const byRef = await ctx.db
      .query("orders")
      .withIndex("by_display_id", (q) => q.eq("displayOrderId", upiRef))
      .first();
    if (byRef && byRef.orgId === orgId && byRef.status === "pending") {
      await markOrderPaid(ctx, byRef, emailId, "paid", { upiRef, payerVpa, payerName });
      return { matched: true, orderId: byRef._id, via: "upi_ref" };
    }
  }

  // 0b) Order-number fallback: our UPI note echoes `Order <5-digit>`, which
  //    bank alerts carry in the body text. Exact and idempotent (email dedupe
  //    by messageId happens before we get here). The amount must still equal
  //    the order's fingerprint — otherwise an under/over-payment would mark
  //    the order paid. Legacy orders have no orderNumber and skip this path —
  //    displayOrderId ref (above) and exact-amount matching (below) cover them.
  const email = await ctx.db.get(emailId);
  const bodyText = `${email?.subject ?? ""}\n${email?.rawBody ?? ""}`;
  const numberCandidates = [
    ...new Set(bodyText.match(/\b\d{5}\b/g) ?? []),
  ]
    .map(Number)
    .filter(isValidOrderNumber)
    .slice(0, 5);
  if (numberCandidates.length > 0) {
    for (const n of numberCandidates) {
      const hit = await ctx.db
        .query("orders")
        .withIndex("by_org_order_number", (q) =>
          q.eq("orgId", orgId).eq("orderNumber", n),
        )
        .first();
      if (hit && hit.status === "pending" && hit.finalAmountPaise === amountPaise) {
        await markOrderPaid(ctx, hit, emailId, "paid", {
          upiRef,
          payerVpa,
          payerName,
        });
        return { matched: true, orderId: hit._id, via: "order_number" };
      }
    }
  }

  // 1) Exact amount match on a pending order (lucky-paisa fingerprint).
  //    No tolerance window: UPI carries paise and templates parse them, so
  //    the alert amount equals finalAmountPaise to the paisa. A ±window
  //    would MERGE distinct orders (same cart total, different lucky paise)
  //    into one match — exactness is the whole point of the fingerprint.
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
    // A mixed-wallet order refunds its wallet portion when it expires. If the
    // old UPI request is paid afterwards, fulfilling it would underpay the
    // order. Preserve the expired order and credit only the newly received
    // bank amount to the customer's wallet.
    if (expired.walletDebitPaise > 0 && expired.walletRefundedAt) {
      await creditWallet(ctx, {
        orgId,
        userId: expired.userId,
        amountPaise,
        reason: "late_payment_credit",
        relatedOrderId: expired._id,
        createdBy: "system",
        note: `late payment for expired order ${expired.displayOrderId}`,
      });
      await ctx.db.patch(emailId, {
        status: "matched",
        matchedOrderId: expired._id,
      });
      return {
        matched: false,
        credited: true,
        orderId: expired._id,
        via: "late_wallet_credit",
      };
    }
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

  // 4) No match — orphan payment for admin. Distinguish "nothing was
  //    even close" (wrong amount / stale order / drift) from "close but no
  //    cigar" (likely rounding or a fingerprint collision) so the admin tab
  //    can say something actionable instead of a bare no_match.
  const RUPEE = 100;
  const pendings = await ctx.db
    .query("orders")
    .withIndex("by_org_status", (q) => q.eq("orgId", orgId).eq("status", "pending"))
    .order("desc")
    .take(200);
  let nearest = Infinity;
  for (const o of pendings) {
    const d = Math.abs(o.finalAmountPaise - amountPaise);
    if (d < nearest) nearest = d;
  }
  await ctx.db.patch(emailId, {
    status: nearest <= 2 * RUPEE ? "no_match" : "no_candidate",
  });
  return { matched: false, nearestPaise: nearest === Infinity ? null : nearest };
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
  await commitOrderInventory(ctx, order, "system");

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
