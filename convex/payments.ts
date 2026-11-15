import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, internalMutation, query } from "./_generated/server";
import { requireOrgAdmin } from "./lib/auth";
import { isBankSenderAllowed, senderAddress } from "./lib/bankSenders";
import { normalizeEmailBody, parseWithTemplates, parseBankEmail } from "./lib/email";
import {
  classifyCredit,
  extractAmountPaise,
  extractUpiRef,
  type PipelineConfig,
} from "./lib/bankMessage";
import { parseSmsSender } from "./lib/smsSenders";
import { loadPipelineConfig, recordPaymentMessage, type MessageOutcome } from "./pipeline";
import { isValidOrderNumber, orderNumberRef } from "./lib/ids";
import { freeSlot } from "./orders";
import { RECONCILE_OFFSETS_MS } from "./lib/pollSchedule";
import { creditWallet } from "./wallet";
import { schedulePaidOrderPush } from "./push";
import { rewardPaidReferral } from "./referrals";
import { commitOrderInventory, releaseOrderInventory } from "./lib/inventory";

// ---------- Scheduled cleanups ----------

export const expireHeldSlot = internalMutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get(orderId);
    if (!order) return;
    if (order.status !== "pending") return;
    // Customer claimed a UPI transaction ID and the store is reviewing it:
    // the order (and its inventory) stays held. Rejecting the claim
    // reschedules expiry (see admin.rejectPaymentClaim).
    if (order.paymentClaim?.status === "review") return;

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

    // Sparse order-triggered post-expiry reconciliation: catch a late UPI
    // credit inside the quarantine window (auto late-paid / wallet credit).
    // Each check skips (zero Gmail calls) when nothing is reconcilable.
    for (const ms of RECONCILE_OFFSETS_MS) {
      await ctx.scheduler.runAfter(ms, internal.gmail.pollInbox, {
        orgId: order.orgId,
        orderId,
        reason: "reconcile",
      });
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

    // 3) Store sender allowlist: a non-empty list ignores every other sender.
    const storeOrg = await ctx.db.get(orgId);
    return await processBankMessage(ctx, {
      config: await loadPipelineConfig(ctx, orgId),
      orgId,
      messageId: args.messageId,
      channel: "email",
      from: args.from,
      subject: args.subject,
      body: args.textBody || args.htmlBody || args.rawBody || "",
      toAlias: toLower || undefined,
      senderAllowed: isBankSenderAllowed(args.from, storeOrg?.allowedBankSenders),
      ignoredNote: "sender not in store allowlist",
    });
  },
});

// ---------- Shared credit processing (email + SMS relay) ----------

export interface BankMessageInput {
  orgId: Id<"organizations">;
  messageId: string;
  channel: "email" | "sms";
  from: string;
  subject?: string;
  body: string;
  toAlias?: string;
  /** Caller decided whether the sender is allowed for this channel. */
  senderAllowed: boolean;
  ignoredNote: string;
  /** Decision config (super-admin global + store override). */
  config: PipelineConfig;
}

type Channel = "email" | "sms";
const CHANNEL_LABEL: Record<Channel, string> = { email: "email", sms: "SMS" };

const VIA_REASON: Record<string, string> = {
  upi_ref: "Matched by UPI reference",
  order_number: "Matched by the order number in the payment note",
  pending: "Matched by exact amount",
  auto_late: "Paid after the order expired, applied as a late payment",
  late_wallet_credit: "Paid after the order expired, credited to the customer's wallet",
};

/**
 * Writes the paymentMessages row (super-admin Messages view) for a message that
 * went through processBankMessage, from the final bankEmails row.
 */
async function recordProcessed(
  ctx: MutationCtx,
  emailId: Id<"bankEmails">,
  input: BankMessageInput,
  result: Record<string, unknown>,
) {
  const row = await ctx.db.get(emailId);
  if (!row) return;
  const channel = input.channel;
  let outcome: MessageOutcome;
  let reason: string;
  let orderId = row.matchedOrderId;
  let duplicateOfChannel: Channel | undefined;
  switch (row.status) {
    case "matched":
      outcome = "matched";
      reason = VIA_REASON[String(result.via ?? "")] ?? "Confirmed the order";
      break;
    case "duplicate": {
      outcome = "duplicate";
      const prior = row.duplicateOfEmailId ? await ctx.db.get(row.duplicateOfEmailId) : null;
      if (prior) {
        duplicateOfChannel = prior.channel ?? "email";
        orderId = orderId ?? prior.matchedOrderId;
        const how =
          result.dedupe === "upi_ref"
            ? `UPI ref ${row.upiRef}`
            : result.dedupe === "late_other_channel"
              ? "same amount, that message already confirmed the order"
              : "same amount, a few minutes apart";
        reason = `Same payment already received by ${CHANNEL_LABEL[duplicateOfChannel]} (${how})`;
      } else {
        reason = "Second payment for an order that was already paid; credited to the customer's wallet";
      }
      break;
    }
    case "ignored":
      outcome = "ignored";
      reason = row.adminNote ?? (result.parsed === false ? "No amount in the message" : "Ignored");
      break;
    case "no_match":
      outcome = "credit_unmatched";
      reason = "No pending order with this exact amount (one is within ₹2)";
      break;
    case "no_candidate":
      outcome = "credit_unmatched";
      reason =
        row.amountPaise > 0
          ? "No pending order near this amount"
          : "Amount could not be read (no bank template matched this message)";
      break;
    case "quarantine_late":
      outcome = "credit_unmatched";
      reason = "Held for review";
      break;
    default:
      outcome = "credit_unmatched";
      reason = row.amountPaise > 0 ? "Not matched" : "Amount could not be read";
  }
  const who = channel === "sms" ? parseSmsSender(input.from) : null;
  await recordPaymentMessage(ctx, {
    orgId: input.orgId,
    channel,
    at: row.receivedAt,
    sender: input.from,
    senderEntity: who?.entity,
    suffix: who?.suffix,
    subject: input.subject,
    body: channel === "email" ? normalizeEmailBody(input.body) : input.body,
    outcome,
    reason,
    amountPaise: row.amountPaise > 0 ? row.amountPaise : undefined,
    upiRef: row.upiRef,
    bankEmailId: row._id,
    orderId,
    duplicateOfEmailId: row.duplicateOfEmailId,
    duplicateOfChannel,
  });
}

/**
 * Cross-channel dedupe. The same UPI credit can arrive by SMS and by email.
 * Same payment when the UPI ref matches (any channel), or when the amount
 * matches within the window on the other channel and the refs do not conflict
 * (at least one side has none). Returns the first-arrived row.
 */
async function findChannelDuplicate(
  ctx: MutationCtx,
  self: Doc<"bankEmails">,
  windowMs: number,
): Promise<{ prior: Doc<"bankEmails">; by: "upi_ref" | "amount_time" } | null> {
  const root = async (d: Doc<"bankEmails">) =>
    d.status === "duplicate" && d.duplicateOfEmailId ? ((await ctx.db.get(d.duplicateOfEmailId)) ?? d) : d;

  if (self.upiRef) {
    const byRef = await ctx.db
      .query("bankEmails")
      .withIndex("by_org_upi_ref", (q) => q.eq("orgId", self.orgId).eq("upiRef", self.upiRef))
      .take(10);
    const hit = byRef.find((d) => d._id !== self._id);
    if (hit) return { prior: await root(hit), by: "upi_ref" };
  }
  if (self.amountPaise <= 0 || windowMs <= 0) return null;
  const channel = self.channel ?? "email";
  const near = await ctx.db
    .query("bankEmails")
    .withIndex("by_org_amount_received", (q) =>
      q
        .eq("orgId", self.orgId)
        .eq("amountPaise", self.amountPaise)
        .gte("receivedAt", self.receivedAt - windowMs)
        .lte("receivedAt", self.receivedAt + windowMs),
    )
    .take(20);
  const hit = near.find(
    (d) =>
      d._id !== self._id &&
      (d.channel ?? "email") !== channel &&
      d.status !== "ignored" &&
      d.status !== "parse_failed" &&
      !(d.upiRef && self.upiRef && d.upiRef !== self.upiRef),
  );
  return hit ? { prior: await root(hit), by: "amount_time" } : null;
}

/**
 * Parse, dedupe, persist and match one incoming bank message. Used by the
 * Gmail/email path (ingestBankEmail) and the SMS relay (smsRelay.ingest).
 * Every message is stored in bankEmails (status shows what happened).
 */
export async function processBankMessage(ctx: MutationCtx, input: BankMessageInput) {
  const { orgId, messageId, from, subject, body, toAlias, channel } = input;

  // Not allowed: stored as ignored (not dropped) so the message-id dedupe still holds.
  if (!input.senderAllowed) {
    const ignoredId = await ctx.db.insert("bankEmails", {
      orgId,
      gmailMessageId: messageId,
      receivedAt: Date.now(),
      amountPaise: 0,
      senderEmail: from,
      toAlias,
      subject,
      rawBody: body,
      status: "ignored",
      adminNote: input.ignoredNote,
      channel,
    });
    const r = { ignored: true, reason: "sender_not_allowed", emailId: ignoredId };
    await recordProcessed(ctx, ignoredId, input, r);
    return r;
  }

  // Pick templates and attempt extraction
  const orgTemplates = await ctx.db
    .query("bankEmailTemplates")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const systemTemplates = await ctx.db
    .query("bankEmailTemplates")
    .withIndex("by_org", (q) => q.eq("orgId", undefined))
    .collect();
  const templates = [...orgTemplates, ...systemTemplates];

  let parsed: ParsedForMatch & { bankKey?: string; templateId?: string } | null = null;
  if (templates.length > 0) {
    parsed = parseWithTemplates(
      { from, subject, body },
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
    );
  } else if (channel === "email") {
    parsed = parseBankEmail(body);
  }
  // SMS with no template hit: the generic amount parser, but only for text
  // that reads as a credit and not as a debit (super-admin keyword rules).
  if (!parsed && channel === "sms" && classifyCredit(body, input.config) === "credit") {
    const amountPaise = extractAmountPaise(body);
    if (amountPaise) parsed = { bankKey: "sms", amountPaise };
  }
  // 12-digit UPI reference (RRN) for cross-channel dedupe, when the template
  // gave none or something else.
  if (parsed && !(parsed.upiRef && /^\d{12}$/.test(parsed.upiRef))) {
    const ref = extractUpiRef(channel === "email" ? normalizeEmailBody(body) : body);
    if (ref) parsed.upiRef = ref;
  }

  // Persist the raw message for audit/reconciliation regardless of outcome
  const emailId = await ctx.db.insert("bankEmails", {
    orgId,
    gmailMessageId: messageId,
    receivedAt: Date.now(),
    amountPaise: parsed?.amountPaise ?? 0,
    senderEmail: from,
    toAlias,
    bankKey: parsed?.bankKey,
    templateId: (parsed?.templateId as Id<"bankEmailTemplates"> | undefined) ?? undefined,
    upiRef: parsed?.upiRef,
    payerVpa: parsed?.payerVpa,
    payerName: parsed?.payerName,
    subject,
    rawBody: body,
    status: parsed ? "unmatched" : "parse_failed",
    channel,
  });

  if (!parsed) {
    // A row with amount-like text is a TEMPLATE gap, not junk: keep it visible
    // as unmatched so the admin tab + seed-sync can act on it.
    const looksPayable =
      /rs\.?\s*[0-9]|inr\s*[0-9]|₹\s*[0-9]|credited|upi\s+ref/i.test(body);
    if (looksPayable) {
      // No template read it, but it may be the other-channel copy of a credit
      // that was already parsed (e.g. an SMS-confirmed payment whose bank email
      // has no template yet). Checked with a best-effort read; only a parsed
      // first arrival counts, so a template gap never blocks a later match.
      const text = channel === "email" ? normalizeEmailBody(body) : body;
      const probeAmount = extractAmountPaise(text);
      const gapRow = probeAmount ? await ctx.db.get(emailId) : null;
      if (gapRow && probeAmount) {
        const probeRef = extractUpiRef(text);
        const dup = await findChannelDuplicate(
          ctx,
          { ...gapRow, amountPaise: probeAmount, upiRef: probeRef },
          input.config.dedupeWindowMs,
        );
        if (dup) {
          await ctx.db.patch(emailId, {
            status: "duplicate",
            amountPaise: probeAmount,
            upiRef: probeRef,
            duplicateOfEmailId: dup.prior._id,
            matchedOrderId: dup.prior.matchedOrderId,
          });
          if (probeRef && !dup.prior.upiRef) await ctx.db.patch(dup.prior._id, { upiRef: probeRef });
          const r = { duplicate: true, emailId, priorEmailId: dup.prior._id, dedupe: dup.by };
          await recordProcessed(ctx, emailId, input, r);
          return r;
        }
      }
      await ctx.db.patch(emailId, { status: "unmatched" });
      const r = await matchEmailToOrder(ctx, emailId, orgId, {
        amountPaise: 0,
        upiRef: undefined,
        payerVpa: undefined,
        payerName: undefined,
      });
      await recordProcessed(ctx, emailId, input, r);
      return r;
    }
    // No amount could be extracted at all (e.g. marketing mail). Mark
    // separately so the admin Unmatched tab isn't flooded with promos.
    await ctx.db.patch(emailId, { status: "ignored" });
    const r = { parsed: false, emailId };
    await recordProcessed(ctx, emailId, input, r);
    return r;
  }

  // Same payment already received (by UPI ref, or by amount + time on the
  // other channel). Never matched or credited twice: the duplicate only links
  // to the first arrival.
  const self = await ctx.db.get(emailId);
  const dup = self ? await findChannelDuplicate(ctx, self, input.config.dedupeWindowMs) : null;
  if (dup) {
    await ctx.db.patch(emailId, {
      status: "duplicate",
      duplicateOfEmailId: dup.prior._id,
      matchedOrderId: dup.prior.matchedOrderId,
    });
    // Learn the ref on the first arrival when only this copy carried it.
    if (parsed.upiRef && !dup.prior.upiRef) await ctx.db.patch(dup.prior._id, { upiRef: parsed.upiRef });
    const r = {
      duplicate: true,
      emailId,
      priorEmailId: dup.prior._id,
      dedupe: dup.by,
      crossChannel: (dup.prior.channel ?? "email") !== channel,
    };
    await recordProcessed(ctx, emailId, input, r);
    return r;
  }

  // Try to match the credit to an order
  const r = await matchEmailToOrder(ctx, emailId, orgId, parsed);
  await recordProcessed(ctx, emailId, input, r);
  return r;
}

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

  // 0a) Customer-submitted UTR (paymentClaim): a bank message whose ref equals
  //     a UTR the customer claimed on a pending order confirms that order. The
  //     amount must still equal the order's fingerprint, so another payment
  //     that happens to carry the same ref cannot confirm it.
  if (upiRef) {
    const claimed = await ctx.db
      .query("orders")
      .withIndex("by_org_claim_utr", (q) =>
        q.eq("orgId", orgId).eq("paymentClaim.utr", upiRef),
      )
      .collect();
    const hit = claimed.find(
      (o) =>
        o.status === "pending" &&
        o.paymentClaim !== undefined &&
        o.paymentClaim.status !== "confirmed" &&
        o.finalAmountPaise === amountPaise,
    );
    if (hit && hit.paymentClaim) {
      await markOrderPaid(ctx, hit, emailId, "paid", { upiRef, payerVpa, payerName });
      return { matched: true, orderId: hit._id, via: "customer_claim" };
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
        note: `late payment for expired order${orderNumberRef(expired)}`,
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
    // The same payment on the other channel arriving after the dedupe window
    // (e.g. a late bank email for an SMS-confirmed order) is not a second
    // payment: link it, never credit the wallet for it.
    const confirming = recentPaid.bankEmailId ? await ctx.db.get(recentPaid.bankEmailId) : null;
    if (
      confirming &&
      confirming._id !== emailId &&
      (confirming.channel ?? "email") !== (email?.channel ?? "email") &&
      !(confirming.upiRef && upiRef && confirming.upiRef !== upiRef)
    ) {
      await ctx.db.patch(emailId, {
        status: "duplicate",
        duplicateOfEmailId: confirming._id,
        matchedOrderId: recentPaid._id,
      });
      return { matched: false, duplicate: true, dedupe: "late_other_channel", priorEmailId: confirming._id };
    }
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
      note: `duplicate for order${orderNumberRef(recentPaid)}${upiRef ? ` (ref ${upiRef})` : ""}`,
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

export async function markOrderPaid(
  ctx: MutationCtx,
  order: Doc<"orders">,
  emailId: Id<"bankEmails">,
  newStatus: "paid" | "late_paid",
  extras: { upiRef?: string; payerVpa?: string; payerName?: string },
) {
  const claim = order.paymentClaim;
  await ctx.db.patch(order._id, {
    status: newStatus,
    paidAt: Date.now(),
    verificationMethod: "email",
    bankEmailId: emailId,
    payerVpa: extras.payerVpa,
    payerName: extras.payerName,
    // A bank message paid the order: any open customer claim is confirmed.
    ...(claim && claim.status !== "confirmed"
      ? {
          paymentClaim: {
            utr: claim.utr,
            submittedAt: claim.submittedAt,
            status: "confirmed" as const,
            reviewedAt: Date.now(),
            confirmedVia: "auto" as const,
            ...(claim.bankMessage ? { bankMessage: claim.bankMessage } : {}),
          },
        }
      : {}),
  });
  await schedulePaidOrderPush(ctx, order._id);
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

  // Refer & earn: every email-matched payment (ingest + Gmail path) lands here.
  await rewardPaidReferral(ctx, { ...order, status: newStatus }, "system");

  await ctx.db.patch(emailId, {
    status: "matched",
    matchedOrderId: order._id,
  });
}


/**
 * Called when a customer submits a UTR. Looks for an earlier bank message in
 * this store with the same UPI ref that is not yet linked to an order.
 * Same amount as the order: confirm now (confirmedVia auto). Otherwise keep
 * the claim in review and link the message so the admin and super admin see it.
 */
export async function linkEarlierBankMessage(
  ctx: MutationCtx,
  orderId: Id<"orders">,
  utr: string,
): Promise<"confirmed" | "linked" | "none"> {
  const order = await ctx.db.get(orderId);
  if (!order || !order.paymentClaim || order.paymentClaim.status !== "review") return "none";
  const rows = await ctx.db
    .query("paymentMessages")
    .withIndex("by_org_upi_ref", (q) => q.eq("orgId", order.orgId).eq("upiRef", utr))
    .collect();
  const candidates = rows
    .filter(
      (r) =>
        r.orderId === undefined &&
        r.outcome !== "matched" &&
        r.outcome !== "duplicate" &&
        (r.amountPaise ?? 0) > 0,
    )
    .sort((a, b) => b.at - a.at);
  if (candidates.length === 0) return "none";

  const sameAmount = candidates.find(
    (r) => r.amountPaise === order.finalAmountPaise && r.bankEmailId !== undefined,
  );
  const pick = sameAmount ?? candidates[0];
  const bankMessage = { messageId: pick._id, amountPaise: pick.amountPaise!, at: pick.at };
  const claim = order.paymentClaim;

  if (sameAmount && sameAmount.bankEmailId && order.status === "pending") {
    const email = await ctx.db.get(sameAmount.bankEmailId);
    if (email && email.status !== "matched") {
      await ctx.db.patch(orderId, {
        paymentClaim: { utr: claim.utr, submittedAt: claim.submittedAt, status: "review", bankMessage },
      });
      const fresh = await ctx.db.get(orderId);
      if (fresh) await markOrderPaid(ctx, fresh, sameAmount.bankEmailId, "paid", { upiRef: utr });
      await ctx.db.patch(sameAmount._id, { outcome: "matched", orderId });
      return "confirmed";
    }
  }

  await ctx.db.patch(orderId, { paymentClaim: { ...claim, bankMessage } });
  return "linked";
}

// ---------- Admin: payment statement + matched emails ----------

type StatementKind = "order_credit" | "refund" | "fee";

interface StatementEntry {
  kind: StatementKind;
  key: string; // `${kind}:${id}`, stable and unique
  at: number;
  amountPaise: number;
  orderId: Id<"orders">;
  orderNumber: number | null;
  displayOrderId: string;
  status: string;
  senderEmail: string | null; // bank sender address for credits
  destination: "wallet" | "bank" | null; // refunds only; null = legacy/unknown
}

interface StatementCursor {
  at: number; // upper bound (inclusive) for the next page
  ids: string[]; // keys already returned at exactly `at`
}

const NO_UPPER = Number.MAX_SAFE_INTEGER;

function decodeStatementCursor(raw: string): StatementCursor {
  try {
    const c = JSON.parse(raw);
    if (
      typeof c?.at !== "number" ||
      !Array.isArray(c?.ids) ||
      !c.ids.every((x: unknown) => typeof x === "string")
    )
      throw new Error("bad shape");
    return c as StatementCursor;
  } catch {
    throw new ConvexError({ code: "INVALID_CURSOR" });
  }
}

/**
 * Store money statement, newest first.
 * - order_credit: orders credited by a bank email (verificationMethod "email"),
 *   at = paidAt, amountPaise = finalAmountPaise (late-paid orders included).
 * - refund: admin-refunded orders, at = terminalAt. destination says whether the
 *   money went back to the wallet or out of the bank (null = legacy refund).
 * - fee: reserved for platform fees; none are produced yet.
 *
 * `cursor` is opaque (returned as nextCursor). Totals cover the whole
 * from/to range, not just the page. refundedPaise counts bank-side refunds
 * (destination "bank" or unknown); wallet refunds are reported separately.
 */
export const listStatement = query({
  args: {
    orgId: v.id("organizations"),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    cursor: v.optional(v.string()),
    limit: v.number(),
  },
  handler: async (ctx, { orgId, from, to, cursor, limit }) => {
    await requireOrgAdmin(ctx, orgId);
    const pageSize = Math.min(Math.max(Math.floor(limit), 1), 100);
    const lower = from ?? 0;
    const upperRange = to ?? NO_UPPER;

    let upper = upperRange;
    let skip = new Set<string>();
    if (cursor) {
      const c = decodeStatementCursor(cursor);
      upper = Math.min(upper, c.at);
      skip = new Set(c.ids);
    }

    const take = pageSize + 1 + skip.size;
    const credits = await ctx.db
      .query("orders")
      .withIndex("by_org_method_paid", (q) =>
        q
          .eq("orgId", orgId)
          .eq("verificationMethod", "email")
          .gte("paidAt", lower)
          .lte("paidAt", upper),
      )
      .order("desc")
      .take(take);
    const refunds = await ctx.db
      .query("orders")
      .withIndex("by_org_status_terminal", (q) =>
        q
          .eq("orgId", orgId)
          .eq("status", "refunded")
          .gte("terminalAt", lower)
          .lte("terminalAt", upper),
      )
      .order("desc")
      .take(take);

    const creditEntries: StatementEntry[] = [];
    for (const o of credits) {
      if (o.paidAt === undefined) continue;
      const email = o.bankEmailId ? await ctx.db.get(o.bankEmailId) : null;
      creditEntries.push({
        kind: "order_credit",
        key: `order_credit:${o._id}`,
        at: o.paidAt,
        amountPaise: o.finalAmountPaise,
        orderId: o._id,
        orderNumber: o.orderNumber ?? null,
        displayOrderId: o.displayOrderId,
        status: o.status,
        senderEmail: email ? senderAddress(email.senderEmail) : null,
        destination: null,
      });
    }
    const refundEntries: StatementEntry[] = [];
    for (const o of refunds) {
      if (o.terminalAt === undefined) continue;
      refundEntries.push({
        kind: "refund",
        key: `refund:${o._id}`,
        at: o.terminalAt,
        amountPaise: o.finalAmountPaise,
        orderId: o._id,
        orderNumber: o.orderNumber ?? null,
        displayOrderId: o.displayOrderId,
        status: o.status,
        senderEmail: null,
        destination: o.refundDestination ?? null,
      });
    }

    const merged = [...creditEntries, ...refundEntries]
      .filter((e) => !skip.has(e.key))
      .sort((a, b) => b.at - a.at || (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));

    const entries = merged.slice(0, pageSize);
    const hasMore = merged.length > pageSize;

    let nextCursor: string | null = null;
    if (hasMore && entries.length > 0) {
      const lastAt = entries[entries.length - 1].at;
      const ids = new Set<string>(
        entries.filter((e) => e.at === lastAt).map((e) => e.key),
      );
      // Same-millisecond keys already returned on earlier pages must survive
      // into the next cursor, or the next query would return them again.
      if (cursor && lastAt === upper) {
        for (const id of skip) ids.add(id);
      }
      nextCursor = JSON.stringify({ at: lastAt, ids: [...ids] } satisfies StatementCursor);
    }

    // Range totals (independent of the page).
    const rangeCredits = await ctx.db
      .query("orders")
      .withIndex("by_org_method_paid", (q) =>
        q
          .eq("orgId", orgId)
          .eq("verificationMethod", "email")
          .gte("paidAt", lower)
          .lte("paidAt", upperRange),
      )
      .collect();
    const rangeRefunds = await ctx.db
      .query("orders")
      .withIndex("by_org_status_terminal", (q) =>
        q
          .eq("orgId", orgId)
          .eq("status", "refunded")
          .gte("terminalAt", lower)
          .lte("terminalAt", upperRange),
      )
      .collect();
    let creditedPaise = 0;
    for (const o of rangeCredits) creditedPaise += o.finalAmountPaise;
    let refundedPaise = 0; // bank-side refunds
    let walletRefundedPaise = 0;
    for (const o of rangeRefunds) {
      if (o.refundDestination === "wallet") walletRefundedPaise += o.finalAmountPaise;
      else refundedPaise += o.finalAmountPaise;
    }

    return {
      entries,
      nextCursor,
      isDone: !hasMore,
      totals: {
        creditedPaise,
        refundedPaise,
        walletRefundedPaise,
        feePaise: 0,
        netPaise: creditedPaise - refundedPaise,
      },
    };
  },
});

/**
 * Bank emails that matched an order, newest first, with the linked order number.
 */
export const listMatchedEmails = query({
  args: {
    orgId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { orgId, paginationOpts }) => {
    await requireOrgAdmin(ctx, orgId);
    const page = await ctx.db
      .query("bankEmails")
      .withIndex("by_org_status", (q) =>
        q.eq("orgId", orgId).eq("status", "matched"),
      )
      .order("desc")
      .paginate(paginationOpts);
    const rows = await Promise.all(
      page.page.map(async (e) => {
        const order = e.matchedOrderId ? await ctx.db.get(e.matchedOrderId) : null;
        return {
          _id: e._id,
          receivedAt: e.receivedAt,
          amountPaise: e.amountPaise,
          senderEmail: senderAddress(e.senderEmail),
          subject: e.subject ?? null,
          upiRef: e.upiRef ?? null,
          payerVpa: e.payerVpa ?? null,
          orderId: order?._id ?? null,
          orderNumber: order?.orderNumber ?? null,
          displayOrderId: order?.displayOrderId ?? null,
        };
      }),
    );
    return {
      page: rows,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});
