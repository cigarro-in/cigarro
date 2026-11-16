// Platform fees, security deposit and store setup gate (PLATFORM_PLAN item 15).
//
// Merchant <-> platform account (platformLedger + platformAccounts):
//   - Security deposit: per-store terms (organizations.securityDepositRequired,
//     securityDepositPaise; absent amount = appConfig.securityDepositPaise or
//     DEFAULT_SECURITY_DEPOSIT_PAISE). Held as security; fees never come out of it.
//   - Marketplace fee: organizations.marketplaceFeeBps (default 800 = 8%) on the
//     UPI amount of each paid order (orders.finalAmountPaise; the wallet-paid part
//     is not charged). Accrued when the order becomes paid, reversed on refund or
//     void. One fee row per order, ever.
//   - Dues = fees - reversals - dues payments (+/- adjustments). Positive = owed.
//
// How merchants pay: the platform is an internal org (kind "platform", slug
// PLATFORM_ORG_SLUG) that uses the same payment machinery as stores. A deposit
// or dues payment is an order in that org (kind "deposit" | "dues",
// payerOrgId = the merchant store), so the paise-match amount, expiry, bank
// email/SMS matching (the platform org's Gmail / SMS relay), the UTR claim
// fallback and admin confirm all work unchanged. When such an order turns paid,
// onOrderPaid writes the merchant's ledger credit (idempotent per order).
// The super admin configures the platform org's UPI IDs, Gmail, SMS relay and
// reviews its claims through the store-level functions with `saToken`
// (lib/auth requirePaymentsAdmin). The platform org is never served on a host
// (lib/org resolveOrg, domains.resolveByHost) and has no store admins.
//
// Separate from payments.listStatement (the store's own sales statement, whose
// reserved kind "fee" stays unused): this is the store's account WITH the platform.
//
// Checkout gate: until setup is complete (auto payment confirmation, a UPI ID,
// the deposit when required), createOrder throws STORE_SETUP_INCOMPLETE, unless
// organizations.setupGate is "waived" (absent = waived, so stores that predate
// the gate keep selling; new stores are created "enforced").

import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireOrgAdmin, requireSaSession, requireSaWrite } from "./lib/auth";
import { audit } from "./lib/audit";
import { resolveOrg } from "./lib/org";
import { buildUpiUrl } from "./lib/upi";
import { buildOrderPollOffsets } from "./lib/pollSchedule";
import { genDisplayOrderId, orderNumberRef } from "./lib/ids";
import { pickUniqueBankAlias } from "./lib/bankAlias";
import {
  DEFAULT_MARKETPLACE_FEE_BPS,
  DEFAULT_SECURITY_DEPOSIT_PAISE,
  PLATFORM_ORG_SLUG,
} from "./lib/platformFeeDefaults";
import { setupGate } from "./schema";
import { insertOrganization } from "./organizations";
import { allocateOrderNumber, applyPaymentClaim, chooseUniqueLuckyPaise } from "./orders";
import { wakeOrderPolling } from "./gmail";

export { DEFAULT_MARKETPLACE_FEE_BPS, DEFAULT_SECURITY_DEPOSIT_PAISE, PLATFORM_ORG_SLUG };

type Ctx = QueryCtx | MutationCtx;
type LedgerKind = Doc<"platformLedger">["kind"];
type PaymentKind = "deposit" | "dues";

const MAX_FEE_BPS = 5_000;
const MAX_AMOUNT_PAISE = 1_000_000_000; // ₹1 crore
const CONFIG_KEY = "singleton";
const IST_OFFSET_MS = 19_800_000;

// ---------- small helpers ----------

export function feeBpsOf(org: Doc<"organizations">): number {
  return org.marketplaceFeeBps ?? DEFAULT_MARKETPLACE_FEE_BPS;
}

export function gateOf(org: Doc<"organizations">): "enforced" | "waived" {
  return org.setupGate ?? "waived";
}

export function feeForSale(salePaise: number, bps: number): number {
  return Math.round((salePaise * bps) / 10_000);
}

function bpsLabel(bps: number): string {
  return `${Number((bps / 100).toFixed(2))}%`;
}

export function formatRupees(paise: number): string {
  const neg = paise < 0;
  const abs = Math.abs(Math.round(paise));
  const rupees = Math.floor(abs / 100);
  const p = String(abs % 100).padStart(2, "0");
  const s = String(rupees);
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}₹${rest ? `${rest},${last3}` : last3}.${p}`;
}

function istMonthStart(now: number): number {
  const d = new Date(now + IST_OFFSET_MS);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - IST_OFFSET_MS;
}

function assertAmount(n: number, code = "INVALID_AMOUNT") {
  if (!Number.isInteger(n) || n <= 0 || n > MAX_AMOUNT_PAISE)
    throw new ConvexError({ code });
}

export function assertDepositAmount(n: number) {
  assertAmount(n, "INVALID_DEPOSIT_AMOUNT");
}

export function assertFeeBps(bps: number) {
  if (!Number.isInteger(bps) || bps < 0 || bps > MAX_FEE_BPS)
    throw new ConvexError({ code: "INVALID_FEE_BPS" });
}

function isPlatformPaymentKind(kind: Doc<"orders">["kind"]): kind is PaymentKind {
  return kind === "deposit" || kind === "dues";
}

// Ledger wording: "order 12345", or just "order" for legacy rows without a
// number. Never the internal ORD- display id.
function orderRef(order: Doc<"orders">): string {
  return order.orderNumber !== undefined ? `order ${order.orderNumber}` : "order";
}

async function requireOrg(ctx: Ctx, orgId: Id<"organizations">) {
  const org = await ctx.db.get(orgId);
  if (!org) throw new ConvexError({ code: "ORG_NOT_FOUND" });
  return org;
}

// Merchant-side calls: a real store, the caller its owner/admin.
async function requireMerchant(ctx: Ctx, orgId: Id<"organizations">) {
  const { userId } = await requireOrgAdmin(ctx, orgId);
  const org = await requireOrg(ctx, orgId);
  if (org.kind === "platform") throw new ConvexError({ code: "FORBIDDEN" });
  return { userId, org };
}

// ---------- platform config + platform org ----------

async function configRow(ctx: Ctx) {
  return await ctx.db
    .query("appConfig")
    .withIndex("by_key", (q) => q.eq("key", CONFIG_KEY))
    .unique();
}

export async function platformDefaultDepositPaise(ctx: Ctx): Promise<number> {
  return (await configRow(ctx))?.securityDepositPaise ?? DEFAULT_SECURITY_DEPOSIT_PAISE;
}

export async function getPlatformOrg(ctx: Ctx): Promise<Doc<"organizations"> | null> {
  const org = await ctx.db
    .query("organizations")
    .withIndex("by_slug", (q) => q.eq("slug", PLATFORM_ORG_SLUG))
    .unique();
  return org && org.kind === "platform" ? org : null;
}

/** Idempotent: returns the platform org, creating it the first time. */
export async function ensurePlatformOrg(ctx: MutationCtx): Promise<Id<"organizations">> {
  const existing = await ctx.db
    .query("organizations")
    .withIndex("by_slug", (q) => q.eq("slug", PLATFORM_ORG_SLUG))
    .unique();
  if (existing) {
    if (existing.kind !== "platform") throw new ConvexError({ code: "PLATFORM_SLUG_TAKEN" });
    return existing._id;
  }
  return await insertOrganization(ctx, {
    slug: PLATFORM_ORG_SLUG,
    name: "Cigarro",
    upiVpa: "",
    bankEmailAlias: await pickUniqueBankAlias(ctx, PLATFORM_ORG_SLUG),
    walletEnabled: false,
    kind: "platform",
    // Exact rupee amounts; a 1-99p match offset only on a collision.
    luckyEnabled: false,
    marketplaceFeeBps: 0,
    setupGate: "waived",
    securityDepositRequired: false,
  });
}

// Store's deposit terms: per-store amount, else the platform default.
async function depositTerms(ctx: Ctx, org: Doc<"organizations">) {
  return {
    required: org.securityDepositRequired ?? true,
    amountPaise: org.securityDepositPaise ?? (await platformDefaultDepositPaise(ctx)),
    usesPlatformDefault: org.securityDepositPaise === undefined,
  };
}

// The VPA new orders of an org embed (null = no UPI ID configured).
async function payingVpaOf(ctx: Ctx, org: Doc<"organizations">) {
  const active = await ctx.db
    .query("paymentVpas")
    .withIndex("by_org_active", (q) => q.eq("orgId", org._id).eq("active", true))
    .first();
  const vpa = active?.vpa ?? (org.upiVpa.trim() || null);
  return { vpa, activeVpa: active };
}

// Auto payment confirmation: an active Gmail connection or a claimed SMS relay.
async function autoConfirmOf(ctx: Ctx, orgId: Id<"organizations">) {
  const gmailRows = await ctx.db
    .query("gmailConnections")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const gmail = gmailRows.some((g) => g.status === "active");
  const relays = await ctx.db
    .query("smsRelays")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  // Claimed = setup code used (rows without a claim code are claimed).
  const smsRelay = relays.some((r) => r.active && !r.claimCodeHash);
  return { done: gmail || smsRelay, gmail, smsRelay };
}

// ---------- account + ledger ----------

async function accountOf(ctx: Ctx, orgId: Id<"organizations">) {
  return await ctx.db
    .query("platformAccounts")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .first();
}

async function balancesOf(ctx: Ctx, orgId: Id<"organizations">) {
  const a = await accountOf(ctx, orgId);
  return { duesPaise: a?.duesPaise ?? 0, depositHeldPaise: a?.depositHeldPaise ?? 0 };
}

async function appendLedger(
  ctx: MutationCtx,
  row: {
    orgId: Id<"organizations">;
    kind: LedgerKind;
    debitPaise: number;
    creditPaise: number;
    duesDelta: number; // + = merchant owes more
    depositDelta: number;
    orderId?: Id<"orders">;
    orderNumber?: number;
    saleAmountPaise?: number;
    feeBps?: number;
    utr?: string;
    paymentOrderId?: Id<"orders">;
    note: string;
    createdBy: string;
  },
) {
  const now = Date.now();
  const acct = await accountOf(ctx, row.orgId);
  const duesAfterPaise = (acct?.duesPaise ?? 0) + row.duesDelta;
  const depositAfterPaise = (acct?.depositHeldPaise ?? 0) + row.depositDelta;
  if (acct) {
    await ctx.db.patch(acct._id, {
      duesPaise: duesAfterPaise,
      depositHeldPaise: depositAfterPaise,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("platformAccounts", {
      orgId: row.orgId,
      duesPaise: duesAfterPaise,
      depositHeldPaise: depositAfterPaise,
      updatedAt: now,
    });
  }
  const { duesDelta: _d, depositDelta: _p, ...rest } = row;
  return await ctx.db.insert("platformLedger", {
    ...rest,
    duesAfterPaise,
    depositAfterPaise,
    createdAt: now,
  });
}

async function orderLedgerRows(ctx: Ctx, orderId: Id<"orders">) {
  return await ctx.db
    .query("platformLedger")
    .withIndex("by_order", (q) => q.eq("orderId", orderId))
    .collect();
}

async function paymentOrderRows(ctx: Ctx, paymentOrderId: Id<"orders">) {
  return await ctx.db
    .query("platformLedger")
    .withIndex("by_payment_order", (q) => q.eq("paymentOrderId", paymentOrderId))
    .collect();
}

// ---------- paid / refund hooks ----------

// Marketplace fee for a paid store order. One fee row per order, ever.
async function accrueOrderFee(ctx: MutationCtx, order: Doc<"orders">) {
  if (order.status !== "paid" && order.status !== "late_paid") return;
  if (isPlatformPaymentKind(order.kind)) return;
  const sale = order.finalAmountPaise;
  if (sale <= 0) return; // wallet-only orders: no UPI received
  const org = await ctx.db.get(order.orgId);
  if (!org || org.kind === "platform") return;
  const rows = await orderLedgerRows(ctx, order._id);
  if (rows.some((r) => r.kind === "fee")) return;
  const bps = feeBpsOf(org);
  const fee = feeForSale(sale, bps);
  if (fee <= 0) return;
  await appendLedger(ctx, {
    orgId: order.orgId,
    kind: "fee",
    debitPaise: fee,
    creditPaise: 0,
    duesDelta: fee,
    depositDelta: 0,
    orderId: order._id,
    orderNumber: order.orderNumber,
    saleAmountPaise: sale,
    feeBps: bps,
    note: `Marketplace fee ${bpsLabel(bps)} on ${orderRef(order)} (${formatRupees(sale)})`,
    createdBy: "system",
  });
}

// A platform-org deposit/dues order was paid: credit the merchant with the
// nominal amount (cartTotalPaise). A paise-match offset taken off the UPI amount
// is the platform's to absorb, as stores absorb it for customers. Idempotent.
async function creditPlatformPayment(ctx: MutationCtx, order: Doc<"orders">) {
  if (order.status !== "paid" && order.status !== "late_paid") return;
  if (!isPlatformPaymentKind(order.kind) || !order.payerOrgId) return;
  const rows = await paymentOrderRows(ctx, order._id);
  if (rows.some((r) => r.kind === "deposit" || r.kind === "dues_payment")) return;
  const amount = order.cartTotalPaise;
  const received =
    order.finalAmountPaise !== amount ? `, received ${formatRupees(order.finalAmountPaise)}` : "";
  const ref = `${orderRef(order)}${received}`;
  const isDeposit = order.kind === "deposit";
  await appendLedger(ctx, {
    orgId: order.payerOrgId,
    kind: isDeposit ? "deposit" : "dues_payment",
    debitPaise: 0,
    creditPaise: amount,
    duesDelta: isDeposit ? 0 : -amount,
    depositDelta: isDeposit ? amount : 0,
    utr: order.paymentClaim?.utr,
    paymentOrderId: order._id,
    note: isDeposit ? `Security deposit received (${ref})` : `Dues paid (${ref})`,
    createdBy: "system",
  });
}

/**
 * Single hook for "an order just became paid". payments.markOrderPaid (bank
 * email/SMS match, late_paid, claim auto-confirm) and admin.markPaidByAdmin
 * (markPaid, confirmPaymentClaim) call it after patching the order. Store
 * orders accrue the marketplace fee; platform deposit/dues orders credit the
 * merchant. Idempotent.
 */
export async function onOrderPaid(ctx: MutationCtx, orderId: Id<"orders">) {
  const order = await ctx.db.get(orderId);
  if (!order) return;
  if (isPlatformPaymentKind(order.kind)) await creditPlatformPayment(ctx, order);
  else await accrueOrderFee(ctx, order);
}

/**
 * Hook for admin.refundOrder / admin.voidOrder. Store orders get their fee
 * reversed; a refunded platform deposit/dues order takes its credit back.
 * Idempotent; no-op when nothing was charged/credited.
 */
export async function onOrderReversed(
  ctx: MutationCtx,
  orderId: Id<"orders">,
  why: "refunded" | "voided",
  createdBy: string,
) {
  const order = await ctx.db.get(orderId);
  if (!order) return;
  if (isPlatformPaymentKind(order.kind)) {
    const rows = await paymentOrderRows(ctx, orderId);
    const credit = rows.find((r) => r.kind === "deposit" || r.kind === "dues_payment");
    if (!credit) return;
    const isDeposit = credit.kind === "deposit";
    const undoKind: LedgerKind = isDeposit ? "deposit_refund" : "adjustment";
    if (rows.some((r) => r.kind === undoKind)) return;
    await appendLedger(ctx, {
      orgId: credit.orgId,
      kind: undoKind,
      debitPaise: credit.creditPaise,
      creditPaise: 0,
      duesDelta: isDeposit ? 0 : credit.creditPaise,
      depositDelta: isDeposit ? -credit.creditPaise : 0,
      paymentOrderId: orderId,
      note: `${isDeposit ? "Security deposit" : "Dues"} payment ${orderRef(order)} ${why}`,
      createdBy,
    });
    return;
  }
  const rows = await orderLedgerRows(ctx, orderId);
  const fee = rows.find((r) => r.kind === "fee");
  if (!fee || rows.some((r) => r.kind === "fee_reversal")) return;
  await appendLedger(ctx, {
    orgId: fee.orgId,
    kind: "fee_reversal",
    debitPaise: 0,
    creditPaise: fee.debitPaise,
    duesDelta: -fee.debitPaise,
    depositDelta: 0,
    orderId,
    orderNumber: fee.orderNumber,
    saleAmountPaise: fee.saleAmountPaise,
    feeBps: fee.feeBps,
    note: `Fee reversed: ${orderRef(order)} ${why}`,
    createdBy,
  });
}

// ---------- setup status + checkout gate ----------

async function openPlatformOrders(ctx: Ctx, payerOrgId: Id<"organizations">) {
  const rows = await ctx.db
    .query("orders")
    .withIndex("by_payer_org", (q) => q.eq("payerOrgId", payerOrgId))
    .order("desc")
    .take(50);
  return rows.filter((o) => o.status === "pending");
}

export async function computeSetupStatus(ctx: Ctx, org: Doc<"organizations">) {
  const autoConfirm = await autoConfirmOf(ctx, org._id);
  const upi = !!(await payingVpaOf(ctx, org)).vpa;

  const terms = await depositTerms(ctx, org);
  const { depositHeldPaise } = await balancesOf(ctx, org._id);
  const depositDone = !terms.required || depositHeldPaise >= terms.amountPaise;
  const pendingDeposit = depositDone
    ? null
    : ((await openPlatformOrders(ctx, org._id)).find((o) => o.kind === "deposit") ?? null);

  const complete = autoConfirm.done && upi && depositDone;
  const gate = gateOf(org);
  return {
    steps: {
      autoConfirm,
      upi: { done: upi },
      deposit: {
        done: depositDone,
        required: terms.required,
        amountPaise: terms.amountPaise,
        heldPaise: depositHeldPaise,
        dueNowPaise: terms.required ? Math.max(terms.amountPaise - depositHeldPaise, 0) : 0,
        // Open deposit payment (resume its QR page) and whether its UTR is in review.
        pendingOrderId: pendingDeposit?._id ?? null,
        inReview: pendingDeposit?.paymentClaim?.status === "review",
      },
    },
    complete,
    gate,
    checkoutOpen: complete || gate === "waived",
    cardDismissedAt: org.setupCardDismissedAt ?? null,
    cardVisible: !complete && org.setupCardDismissedAt === undefined,
  };
}

/** createOrder gate. Throws STORE_SETUP_INCOMPLETE for enforced, unfinished stores. */
export async function assertCheckoutOpen(ctx: Ctx, org: Doc<"organizations">) {
  if (gateOf(org) === "waived") return;
  const s = await computeSetupStatus(ctx, org);
  if (!s.complete) throw new ConvexError({ code: "STORE_SETUP_INCOMPLETE" });
}

// ---------- statement + summary ----------

async function statementPage(
  ctx: Ctx,
  orgId: Id<"organizations">,
  cursor: string | null | undefined,
  limit: number,
) {
  const numItems = Math.min(Math.max(Math.floor(limit), 1), 100);
  const page = await ctx.db
    .query("platformLedger")
    .withIndex("by_org_created", (q) => q.eq("orgId", orgId))
    .order("desc")
    .paginate({ cursor: cursor ?? null, numItems });
  const rows = page.page.map((r) => ({
    id: r._id,
    date: r.createdAt,
    kind: r.kind,
    particulars: r.note,
    creditPaise: r.creditPaise,
    debitPaise: r.debitPaise,
    // Running dues after this row (positive = merchant owes).
    balancePaise: r.duesAfterPaise,
    depositAfterPaise: r.depositAfterPaise,
    // Deposit rows move the held deposit, not dues.
    affectsDues: r.kind !== "deposit" && r.kind !== "deposit_refund",
    orderId: r.orderId ?? null,
    orderNumber: r.orderNumber ?? null,
    saleAmountPaise: r.saleAmountPaise ?? null,
    feeBps: r.feeBps ?? null,
    utr: r.utr ?? null,
    paymentOrderId: r.paymentOrderId ?? null,
  }));
  return { rows, nextCursor: page.isDone ? null : page.continueCursor };
}

async function accountSummary(ctx: Ctx, org: Doc<"organizations">) {
  const { duesPaise, depositHeldPaise } = await balancesOf(ctx, org._id);
  const monthStart = istMonthStart(Date.now());
  let feesThisMonthPaise = 0;
  for (const kind of ["fee", "fee_reversal"] as const) {
    const rows = await ctx.db
      .query("platformLedger")
      .withIndex("by_org_kind_created", (q) =>
        q.eq("orgId", org._id).eq("kind", kind).gte("createdAt", monthStart),
      )
      .collect();
    for (const r of rows) feesThisMonthPaise += r.debitPaise - r.creditPaise;
  }
  const terms = await depositTerms(ctx, org);
  const platform = await getPlatformOrg(ctx);
  const platformVpa = platform ? (await payingVpaOf(ctx, platform)).vpa : null;
  return {
    duesPaise,
    depositHeldPaise,
    feesThisMonthPaise,
    feeBps: feeBpsOf(org),
    depositRequired: terms.required,
    depositAmountPaise: terms.amountPaise,
    depositDuePaise: terms.required ? Math.max(terms.amountPaise - depositHeldPaise, 0) : 0,
    // False until the super admin sets up the platform org's UPI ID;
    // createPlatformPayment then refuses with PLATFORM_PAYMENTS_NOT_CONFIGURED.
    platformPaymentsReady: !!platform?.active && !!platformVpa,
  };
}

function orderFeeView(rows: Doc<"platformLedger">[]) {
  const fee = rows.find((r) => r.kind === "fee");
  if (!fee) return null;
  const reversal = rows.find((r) => r.kind === "fee_reversal");
  return {
    feePaise: fee.debitPaise,
    feeBps: fee.feeBps ?? null,
    saleAmountPaise: fee.saleAmountPaise ?? null,
    chargedAt: fee.createdAt,
    reversed: !!reversal,
    reversedAt: reversal?.createdAt ?? null,
    netPaise: fee.debitPaise - (reversal?.creditPaise ?? 0),
  };
}

// Payment view for the merchant: the order doc (same shape the customer
// payment page reads from orders.getMine) plus payee name and expiry time.
async function platformPaymentView(ctx: Ctx, order: Doc<"orders">) {
  const platform = await ctx.db.get(order.orgId);
  return {
    ...order,
    payeeName: platform?.name ?? "Cigarro",
    expiresAt: order.createdAt + (platform?.slotTimeoutMs ?? 0),
  };
}

// ======================================================================
// Storefront (public)
// ======================================================================

/** Whether checkout is open for a store. Lets the storefront explain the gate. */
export const checkoutAvailability = query({
  args: { orgSlug: v.string() },
  handler: async (ctx, { orgSlug }) => {
    const org = await resolveOrg(ctx, orgSlug);
    if (gateOf(org) === "waived") return { open: true };
    const s = await computeSetupStatus(ctx, org);
    return { open: s.complete };
  },
});

// ======================================================================
// Merchant (store admin)
// ======================================================================

export const getSetupStatus = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const { org } = await requireMerchant(ctx, orgId);
    return await computeSetupStatus(ctx, org);
  },
});

export const getAccountSummary = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const { org } = await requireMerchant(ctx, orgId);
    return await accountSummary(ctx, org);
  },
});

export const listStatement = query({
  args: {
    orgId: v.id("organizations"),
    cursor: v.optional(v.union(v.string(), v.null())),
    limit: v.number(),
  },
  handler: async (ctx, { orgId, cursor, limit }) => {
    const { org } = await requireMerchant(ctx, orgId);
    const page = await statementPage(ctx, orgId, cursor, limit);
    const s = await accountSummary(ctx, org);
    return {
      ...page,
      depositHeldPaise: s.depositHeldPaise,
      duesPaise: s.duesPaise,
      feesThisMonthPaise: s.feesThisMonthPaise,
    };
  },
});

/** Fee on one order (null = no fee charged, e.g. unpaid or wallet-only). */
export const getOrderFee = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get(orderId);
    if (!order) throw new ConvexError({ code: "NOT_FOUND" });
    await requireOrgAdmin(ctx, order.orgId);
    return orderFeeView(await orderLedgerRows(ctx, orderId));
  },
});

/** Batch form for order lists: { [orderId]: fee view | null }. Max 200 ids. */
export const getOrderFees = query({
  args: { orgId: v.id("organizations"), orderIds: v.array(v.id("orders")) },
  handler: async (ctx, { orgId, orderIds }) => {
    await requireOrgAdmin(ctx, orgId);
    if (orderIds.length > 200) throw new ConvexError({ code: "TOO_MANY_IDS" });
    const out: Record<string, ReturnType<typeof orderFeeView>> = {};
    for (const id of orderIds) {
      const rows = (await orderLedgerRows(ctx, id)).filter((r) => r.orgId === orgId);
      out[id] = orderFeeView(rows);
    }
    return out;
  },
});

/**
 * Start (or resume) a deposit or dues payment. Creates a pending order in the
 * platform org with the paise-match amount, its UPI deep link, expiry and inbox
 * checks, exactly like a customer order. An open payment of the same kind and
 * amount is returned instead of creating another.
 * kind "deposit": amount = deposit still due (no amountPaise).
 * kind "dues": amountPaise, or all outstanding dues when omitted.
 */
export const createPlatformPayment = mutation({
  args: {
    orgId: v.id("organizations"),
    kind: v.union(v.literal("deposit"), v.literal("dues")),
    amountPaise: v.optional(v.number()),
  },
  handler: async (ctx, { orgId, kind, amountPaise }) => {
    const { userId, org } = await requireMerchant(ctx, orgId);
    const platform = await getPlatformOrg(ctx);
    if (!platform || !platform.active)
      throw new ConvexError({ code: "PLATFORM_PAYMENTS_NOT_CONFIGURED" });
    const { vpa, activeVpa } = await payingVpaOf(ctx, platform);
    if (!vpa) throw new ConvexError({ code: "PLATFORM_PAYMENTS_NOT_CONFIGURED" });

    let amount: number;
    if (kind === "deposit") {
      if (amountPaise !== undefined) throw new ConvexError({ code: "AMOUNT_NOT_ALLOWED" });
      const terms = await depositTerms(ctx, org);
      if (!terms.required) throw new ConvexError({ code: "DEPOSIT_NOT_REQUIRED" });
      const { depositHeldPaise } = await balancesOf(ctx, orgId);
      amount = terms.amountPaise - depositHeldPaise;
      if (amount <= 0) throw new ConvexError({ code: "DEPOSIT_ALREADY_HELD" });
    } else {
      const { duesPaise } = await balancesOf(ctx, orgId);
      if (amountPaise === undefined && duesPaise <= 0) throw new ConvexError({ code: "NO_DUES" });
      amount = amountPaise ?? duesPaise;
    }
    assertAmount(amount);

    const open = (await openPlatformOrders(ctx, orgId)).find(
      (o) => o.kind === kind && o.cartTotalPaise === amount,
    );
    if (open) {
      return {
        orderId: open._id,
        orderNumber: open.orderNumber ?? null,
        amountPaise: open.cartTotalPaise,
        finalAmountPaise: open.finalAmountPaise,
        matchOffsetPaise: open.matchOffsetPaise ?? 0,
        upiUrl: open.upiUrl,
        reused: true,
      };
    }

    // Same fingerprinting as customer orders (orders.createOrder).
    const fingerprint = await chooseUniqueLuckyPaise(
      ctx,
      platform._id,
      amount,
      0,
      0,
      undefined,
      platform.luckyEnabled ?? false,
      platform.quarantineMs,
    );
    const offset = fingerprint.luckyPaise;
    const finalAmount = amount - offset;
    const orderNumber = await allocateOrderNumber(ctx, platform._id);
    const upiUrl = buildUpiUrl({
      vpa,
      payeeName: platform.name,
      amountPaise: finalAmount,
      orderNumber,
      // Bank alerts echo tn; the matcher keys on the five-digit number in it.
      note: `Order${orderNumberRef({ orderNumber })}`,
    });
    const label = kind === "deposit" ? "Security deposit" : "Platform fee dues";
    const now = Date.now();
    const orderId = await ctx.db.insert("orders", {
      orgId: platform._id,
      userId,
      payerOrgId: orgId,
      displayOrderId: genDisplayOrderId(),
      orderNumber,
      kind,
      items: [{ productId: kind, name: `${label} · ${org.name}`, qty: 1, unitPricePaise: amount }],
      cartTotalPaise: amount,
      walletDebitPaise: 0,
      discountPaise: offset,
      matchOffsetPaise: offset > 0 ? offset : undefined,
      baseAmountPaise: finalAmount,
      slotOffsetPaise: 0,
      finalAmountPaise: finalAmount,
      upiUrl,
      status: "pending",
      createdAt: now,
      payingVpa: vpa,
    });
    if (activeVpa) await ctx.db.patch(activeVpa._id, { lastUsedAt: now });

    await ctx.scheduler.runAfter(platform.slotTimeoutMs, internal.payments.expireHeldSlot, {
      orderId,
    });
    for (const ms of buildOrderPollOffsets(platform.slotTimeoutMs)) {
      await ctx.scheduler.runAfter(ms, internal.gmail.pollInbox, {
        orgId: platform._id,
        orderId,
        reason: "scheduled",
        generation: 0,
      });
    }
    await audit(ctx, {
      orgId,
      adminUserId: userId,
      action: `platform.${kind}.start`,
      targetType: "order",
      targetId: orderId,
      payload: { amountPaise: amount, finalAmountPaise: finalAmount },
    });
    return {
      orderId,
      orderNumber,
      amountPaise: amount,
      finalAmountPaise: finalAmount,
      matchOffsetPaise: offset,
      upiUrl,
      reused: false,
    };
  },
});

async function merchantPaymentOrder(
  ctx: Ctx,
  orgId: Id<"organizations">,
  orderId: Id<"orders">,
) {
  const order = await ctx.db.get(orderId);
  if (!order || order.payerOrgId !== orgId || !isPlatformPaymentKind(order.kind))
    throw new ConvexError({ code: "NOT_FOUND" });
  return order;
}

/** One deposit/dues payment (null when not this store's). Reactive: status flips to paid. */
export const getPlatformPayment = query({
  args: { orgId: v.id("organizations"), orderId: v.id("orders") },
  handler: async (ctx, { orgId, orderId }) => {
    await requireMerchant(ctx, orgId);
    const order = await ctx.db.get(orderId);
    if (!order || order.payerOrgId !== orgId || !isPlatformPaymentKind(order.kind)) return null;
    return await platformPaymentView(ctx, order);
  },
});

/** This store's deposit/dues payments, newest first. */
export const listPlatformPayments = query({
  args: { orgId: v.id("organizations"), limit: v.optional(v.number()) },
  handler: async (ctx, { orgId, limit }) => {
    await requireMerchant(ctx, orgId);
    const rows = await ctx.db
      .query("orders")
      .withIndex("by_payer_org", (q) => q.eq("payerOrgId", orgId))
      .order("desc")
      .take(Math.min(Math.max(limit ?? 20, 1), 100));
    return await Promise.all(rows.map((o) => platformPaymentView(ctx, o)));
  },
});

/** Fallback when auto-confirmation misses: merchant submits the 12-digit UTR. */
export const submitPlatformPaymentClaim = mutation({
  args: { orgId: v.id("organizations"), orderId: v.id("orders"), utr: v.string() },
  handler: async (ctx, { orgId, orderId, utr }) => {
    const { userId } = await requireMerchant(ctx, orgId);
    const order = await merchantPaymentOrder(ctx, orgId, orderId);
    return await applyPaymentClaim(ctx, order, utr, `admin:${userId}`);
  },
});

/** "I've paid" / refresh on the payment page: throttled inbox check. */
export const wakePlatformPayment = mutation({
  args: {
    orgId: v.id("organizations"),
    orderId: v.id("orders"),
    source: v.union(v.literal("wake"), v.literal("refresh")),
  },
  handler: async (ctx, { orgId, orderId, source }) => {
    await requireMerchant(ctx, orgId);
    const order = await merchantPaymentOrder(ctx, orgId, orderId);
    return await wakeOrderPolling(ctx, order, source);
  },
});

export const dismissSetupCard = mutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const { org } = await requireMerchant(ctx, orgId);
    if (org.setupCardDismissedAt === undefined)
      await ctx.db.patch(orgId, { setupCardDismissedAt: Date.now() });
    return null;
  },
});

// ======================================================================
// Super admin (Citadel session)
// ======================================================================

/** Creates the platform org if missing (the migration also does this). */
export const saEnsurePlatformOrg = mutation({
  args: { saToken: v.string() },
  handler: async (ctx, { saToken }) => {
    const sa = await requireSaWrite(ctx, saToken);
    const before = await getPlatformOrg(ctx);
    const orgId = await ensurePlatformOrg(ctx);
    if (!before)
      await audit(ctx, {
        adminUserId: sa.adminId,
        actorType: "super_admin",
        action: "platform.platformOrg.create",
        targetType: "organization",
        targetId: orgId,
      });
    return orgId;
  },
});

/**
 * Platform payment settings page. platformOrgId is what the SA UI passes (with
 * saToken) to the reused store functions: email.listVpas/upsertVpa/deleteVpa,
 * gmail.getGmailStatus/getOAuthUrl/disconnectGmail, smsRelay.getStatus/
 * connectPhone/revokeToken, pipeline.getStoreConfig/setStoreConfig,
 * admin.listPaymentClaims/confirmPaymentClaim/rejectPaymentClaim/markPaid.
 */
export const saGetPlatformPaymentSettings = query({
  args: { saToken: v.string() },
  handler: async (ctx, { saToken }) => {
    await requireSaSession(ctx, saToken);
    const platform = await getPlatformOrg(ctx);
    const defaultDepositPaise = await platformDefaultDepositPaise(ctx);
    if (!platform) return { platformOrgId: null, defaultDepositPaise };
    const autoConfirm = await autoConfirmOf(ctx, platform._id);
    const { vpa } = await payingVpaOf(ctx, platform);
    const claims = await ctx.db
      .query("orders")
      .withIndex("by_org_claim_status", (q) =>
        q.eq("orgId", platform._id).eq("paymentClaim.status", "review"),
      )
      .take(100);
    return {
      platformOrgId: platform._id,
      payeeName: platform.name,
      payingVpa: vpa,
      slotTimeoutMs: platform.slotTimeoutMs,
      bankEmailAlias: platform.bankEmailAlias,
      autoConfirm,
      ready: !!vpa,
      claimsInReview: claims.length,
      defaultDepositPaise,
    };
  },
});

/** Platform-wide: default deposit amount and the payee name shown in UPI apps. */
export const saSetPlatformPaymentConfig = mutation({
  args: {
    saToken: v.string(),
    defaultDepositPaise: v.optional(v.number()),
    payeeName: v.optional(v.string()),
  },
  handler: async (ctx, { saToken, defaultDepositPaise, payeeName }) => {
    const sa = await requireSaWrite(ctx, saToken);
    const now = Date.now();
    if (defaultDepositPaise !== undefined) {
      assertDepositAmount(defaultDepositPaise);
      const row = await configRow(ctx);
      if (row)
        await ctx.db.patch(row._id, {
          securityDepositPaise: defaultDepositPaise,
          updatedAt: now,
          updatedBy: sa.adminId,
        });
      else
        await ctx.db.insert("appConfig", {
          key: CONFIG_KEY,
          securityDepositPaise: defaultDepositPaise,
          updatedAt: now,
          updatedBy: sa.adminId,
        });
    }
    if (payeeName !== undefined) {
      const name = payeeName.trim();
      if (!name || name.length > 80) throw new ConvexError({ code: "INVALID_NAME" });
      await ctx.db.patch(await ensurePlatformOrg(ctx), { name });
    }
    await audit(ctx, {
      adminUserId: sa.adminId,
      actorType: "super_admin",
      action: "platform.paymentConfig.set",
      targetType: "appConfig",
      targetId: CONFIG_KEY,
      payload: { defaultDepositPaise, payeeName },
    });
    return null;
  },
});

/** Deposit/dues payments across stores (or one store), newest first, with the payer store. */
export const saListPlatformPaymentOrders = query({
  args: {
    saToken: v.string(),
    payerOrgId: v.optional(v.id("organizations")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { saToken, payerOrgId, limit }) => {
    await requireSaSession(ctx, saToken);
    const n = Math.min(Math.max(limit ?? 50, 1), 200);
    let rows: Doc<"orders">[] = [];
    if (payerOrgId) {
      rows = await ctx.db
        .query("orders")
        .withIndex("by_payer_org", (q) => q.eq("payerOrgId", payerOrgId))
        .order("desc")
        .take(n);
    } else {
      const platform = await getPlatformOrg(ctx);
      if (platform)
        rows = await ctx.db
          .query("orders")
          .withIndex("by_org_created", (q) => q.eq("orgId", platform._id))
          .order("desc")
          .take(n);
    }
    const stores = new Map<string, { slug: string; name: string } | null>();
    const out = [];
    for (const o of rows) {
      const key = o.payerOrgId ?? "";
      if (!stores.has(key)) {
        const s = o.payerOrgId ? await ctx.db.get(o.payerOrgId) : null;
        stores.set(key, s ? { slug: s.slug, name: s.name } : null);
      }
      out.push({ ...o, payerStore: stores.get(key) ?? null });
    }
    return out;
  },
});

/** Everything the SA store page needs: fee, gate, deposit terms, setup, account. */
export const saGetStoreBilling = query({
  args: { saToken: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, { saToken, orgId }) => {
    await requireSaSession(ctx, saToken);
    const org = await requireOrg(ctx, orgId);
    const terms = await depositTerms(ctx, org);
    return {
      marketplaceFeeBps: feeBpsOf(org),
      setupGate: gateOf(org),
      securityDepositRequired: terms.required,
      securityDepositPaise: org.securityDepositPaise ?? null, // null = platform default
      effectiveSecurityDepositPaise: terms.amountPaise,
      setup: await computeSetupStatus(ctx, org),
      account: await accountSummary(ctx, org),
    };
  },
});

export const saListStatement = query({
  args: {
    saToken: v.string(),
    orgId: v.id("organizations"),
    cursor: v.optional(v.union(v.string(), v.null())),
    limit: v.number(),
  },
  handler: async (ctx, { saToken, orgId, cursor, limit }) => {
    await requireSaSession(ctx, saToken);
    const org = await requireOrg(ctx, orgId);
    const page = await statementPage(ctx, orgId, cursor, limit);
    const s = await accountSummary(ctx, org);
    return {
      ...page,
      depositHeldPaise: s.depositHeldPaise,
      duesPaise: s.duesPaise,
      feesThisMonthPaise: s.feesThisMonthPaise,
    };
  },
});

async function saOrgWrite(
  ctx: MutationCtx,
  saToken: string,
  orgId: Id<"organizations">,
  action: string,
  patch: Partial<Doc<"organizations">>,
  payload: Record<string, unknown>,
) {
  const sa = await requireSaWrite(ctx, saToken);
  const org = await requireOrg(ctx, orgId);
  if (org.kind === "platform") throw new ConvexError({ code: "FORBIDDEN" });
  await ctx.db.patch(orgId, patch);
  await audit(ctx, {
    adminUserId: sa.adminId,
    actorType: "super_admin",
    action,
    targetType: "organization",
    targetId: orgId,
    payload: { slug: org.slug, ...payload },
  });
  return null;
}

export const saSetMarketplaceFee = mutation({
  args: { saToken: v.string(), orgId: v.id("organizations"), feeBps: v.number() },
  handler: async (ctx, { saToken, orgId, feeBps }) => {
    assertFeeBps(feeBps);
    return await saOrgWrite(ctx, saToken, orgId, "platform.store.setFee", { marketplaceFeeBps: feeBps }, { feeBps });
  },
});

export const saSetSetupGate = mutation({
  args: { saToken: v.string(), orgId: v.id("organizations"), gate: setupGate },
  handler: async (ctx, { saToken, orgId, gate }) =>
    await saOrgWrite(ctx, saToken, orgId, "platform.store.setSetupGate", { setupGate: gate }, { gate }),
});

/** Per-store deposit terms. securityDepositPaise null = use the platform default. */
export const saSetSecurityDeposit = mutation({
  args: {
    saToken: v.string(),
    orgId: v.id("organizations"),
    required: v.boolean(),
    securityDepositPaise: v.union(v.number(), v.null()),
  },
  handler: async (ctx, { saToken, orgId, required, securityDepositPaise }) => {
    if (securityDepositPaise !== null) assertDepositAmount(securityDepositPaise);
    return await saOrgWrite(
      ctx,
      saToken,
      orgId,
      "platform.store.setDeposit",
      { securityDepositRequired: required, securityDepositPaise: securityDepositPaise ?? undefined },
      { required, securityDepositPaise },
    );
  },
});

export const saReshowSetupCard = mutation({
  args: { saToken: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, { saToken, orgId }) =>
    await saOrgWrite(ctx, saToken, orgId, "platform.store.reshowSetupCard", { setupCardDismissedAt: undefined }, {}),
});

/** Record a deposit paid back to the merchant (money sent outside the app). */
export const saRefundDeposit = mutation({
  args: { saToken: v.string(), orgId: v.id("organizations"), amountPaise: v.number(), note: v.string() },
  handler: async (ctx, { saToken, orgId, amountPaise, note }) => {
    const sa = await requireSaWrite(ctx, saToken);
    await requireOrg(ctx, orgId);
    assertAmount(amountPaise);
    const { depositHeldPaise } = await balancesOf(ctx, orgId);
    if (amountPaise > depositHeldPaise) throw new ConvexError({ code: "EXCEEDS_DEPOSIT_HELD" });
    const text = note.trim().slice(0, 200);
    await appendLedger(ctx, {
      orgId,
      kind: "deposit_refund",
      debitPaise: amountPaise,
      creditPaise: 0,
      duesDelta: 0,
      depositDelta: -amountPaise,
      note: text ? `Security deposit refunded: ${text}` : "Security deposit refunded",
      createdBy: `sa:${sa.adminId}`,
    });
    await audit(ctx, {
      orgId,
      adminUserId: sa.adminId,
      actorType: "super_admin",
      action: "platform.deposit.refund",
      targetType: "organization",
      targetId: orgId,
      payload: { amountPaise, note: text },
    });
    return null;
  },
});

/** Manual correction to dues. duesDeltaPaise > 0 = merchant owes more; < 0 = credit. */
export const saRecordAdjustment = mutation({
  args: { saToken: v.string(), orgId: v.id("organizations"), duesDeltaPaise: v.number(), note: v.string() },
  handler: async (ctx, { saToken, orgId, duesDeltaPaise, note }) => {
    const sa = await requireSaWrite(ctx, saToken);
    await requireOrg(ctx, orgId);
    if (duesDeltaPaise === 0) throw new ConvexError({ code: "INVALID_AMOUNT" });
    assertAmount(Math.abs(duesDeltaPaise));
    const text = note.trim().slice(0, 200);
    if (!text) throw new ConvexError({ code: "NOTE_REQUIRED" });
    await appendLedger(ctx, {
      orgId,
      kind: "adjustment",
      debitPaise: duesDeltaPaise > 0 ? duesDeltaPaise : 0,
      creditPaise: duesDeltaPaise < 0 ? -duesDeltaPaise : 0,
      duesDelta: duesDeltaPaise,
      depositDelta: 0,
      note: `Adjustment: ${text}`,
      createdBy: `sa:${sa.adminId}`,
    });
    await audit(ctx, {
      orgId,
      adminUserId: sa.adminId,
      actorType: "super_admin",
      action: "platform.dues.adjust",
      targetType: "organization",
      targetId: orgId,
      payload: { duesDeltaPaise, note: text },
    });
    return null;
  },
});

// ---------- migration step (convex/migrations.ts, platformFees-v1) ----------

// Existing stores: fee 800 bps, gate waived (they keep selling), deposit
// required at the platform default (moot while waived). Stores the default
// deposit in appConfig and creates the platform org. Idempotent.
export const backfillPlatformFees = internalMutation({
  args: {},
  handler: async (ctx) => {
    let patched = 0;
    for (const org of await ctx.db.query("organizations").collect()) {
      if (org.kind === "platform") continue;
      const patch: Partial<Doc<"organizations">> = {};
      if (org.marketplaceFeeBps === undefined) patch.marketplaceFeeBps = DEFAULT_MARKETPLACE_FEE_BPS;
      if (org.setupGate === undefined) patch.setupGate = "waived";
      if (org.securityDepositRequired === undefined) patch.securityDepositRequired = true;
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(org._id, patch);
        patched++;
      }
    }
    const row = await configRow(ctx);
    if (!row)
      await ctx.db.insert("appConfig", {
        key: CONFIG_KEY,
        securityDepositPaise: DEFAULT_SECURITY_DEPOSIT_PAISE,
        updatedAt: Date.now(),
      });
    else if (row.securityDepositPaise === undefined)
      await ctx.db.patch(row._id, { securityDepositPaise: DEFAULT_SECURITY_DEPOSIT_PAISE });
    const platformOrgId = await ensurePlatformOrg(ctx);
    return { patched, platformOrgId };
  },
});
