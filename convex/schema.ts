import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const orderStatus = v.union(
  v.literal("pending"),
  v.literal("paid"),
  v.literal("expired"),
  v.literal("cancelled"),
  v.literal("late_paid"),
  v.literal("refunded"),
  v.literal("voided"),
);

export const orderKind = v.union(
  v.literal("purchase"),
  v.literal("wallet_load"),
);

export const slotState = v.union(
  v.literal("free"),
  v.literal("held"),
  v.literal("quarantined"),
);

export const role = v.union(
  v.literal("customer"),
  v.literal("staff"),
  v.literal("admin"),
  v.literal("owner"),
);

export const ledgerReason = v.union(
  v.literal("order_debit"),
  v.literal("order_expired_refund"),
  v.literal("order_cancelled_refund"),
  v.literal("order_refund_admin"),
  v.literal("wallet_load_credit"),
  v.literal("admin_credit"),
  v.literal("late_payment_credit"),
  v.literal("duplicate_payment_credit"),
);

export const bankEmailStatus = v.union(
  v.literal("unmatched"),
  v.literal("matched"),
  v.literal("quarantine_late"),
  v.literal("no_match"),
  v.literal("parse_failed"),
  v.literal("duplicate"),
);

export const latePaymentStatus = v.union(
  v.literal("pending_review"),
  v.literal("applied_to_order"),
  v.literal("credited_to_wallet"),
  v.literal("flagged_for_refund"),
);

export const verificationMethod = v.union(
  v.literal("email"),
  v.literal("admin_manual"),
  v.literal("wallet_only"),
);

export const shippingStatus = v.union(
  v.literal("awaiting"),
  v.literal("processing"),
  v.literal("shipped"),
  v.literal("delivered"),
  v.literal("returned"),
);

export const addressV = v.object({
  line1: v.string(),
  line2: v.optional(v.string()),
  city: v.string(),
  state: v.string(),
  pincode: v.string(),
  name: v.string(),
  phone: v.string(),
});

export const orderItemV = v.object({
  productId: v.string(),
  variantId: v.optional(v.string()),
  name: v.string(),
  qty: v.number(),
  unitPricePaise: v.number(),
});

export default defineSchema({
  organizations: defineTable({
    slug: v.string(),
    name: v.string(),
    upiVpa: v.string(),
    bankEmailAlias: v.string(),
    walletEnabled: v.boolean(),
    slotTimeoutMs: v.number(),
    quarantineMs: v.number(),
    slotsPerBase: v.number(),
    active: v.boolean(),
    createdAt: v.number(),

    // Per-tenant GAS webhook for on-demand email polling.
    // If set, Convex will POST {orgId, orderId, amountPaise, bankKey?} to
    // gasWebhookUrl with `Authorization: Bearer <gasWebhookSecret>`.
    gasWebhookUrl: v.optional(v.string()),
    gasWebhookSecret: v.optional(v.string()),
  })
    .index("by_slug", ["slug"])
    .index("by_alias", ["bankEmailAlias"]),

  memberships: defineTable({
    orgId: v.id("organizations"),
    userId: v.string(),
    role,
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_org_user", ["orgId", "userId"])
    .index("by_org_role", ["orgId", "role"]),

  orders: defineTable({
    orgId: v.id("organizations"),
    userId: v.string(),
    displayOrderId: v.string(),
    kind: orderKind,
    retryOfOrderId: v.optional(v.id("orders")),

    items: v.array(orderItemV),
    address: v.optional(addressV),

    cartTotalPaise: v.number(),
    walletDebitPaise: v.number(),
    baseAmountPaise: v.number(),
    slotOffsetPaise: v.number(),
    finalAmountPaise: v.number(),

    slotId: v.optional(v.id("paymentSlots")),
    upiUrl: v.string(),

    status: orderStatus,
    verificationMethod: v.optional(verificationMethod),
    bankEmailId: v.optional(v.id("bankEmails")),

    createdAt: v.number(),
    paidAt: v.optional(v.number()),
    terminalAt: v.optional(v.number()),
    walletRefundedAt: v.optional(v.number()),

    shippingStatus: v.optional(shippingStatus),
    trackingCarrier: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
    trackingUrl: v.optional(v.string()),
    shippedAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    shippingNotes: v.optional(v.string()),

    // Payment routing + reconciliation
    payingVpa: v.optional(v.string()),       // which org VPA was embedded in the deep link
    payerVpa: v.optional(v.string()),        // customer VPA, captured when email matched
    payerName: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),  // client-provided; prevents double-create on retry
    extraCreditsPaise: v.optional(v.number()), // sum of duplicate/over-payments credited beyond this order
    lastWakeAt: v.optional(v.number()),      // throttle for /wakeOrder pokes
  })
    .index("by_org_user", ["orgId", "userId", "createdAt"])
    .index("by_org_final_status", ["orgId", "finalAmountPaise", "status"])
    .index("by_display_id", ["displayOrderId"])
    .index("by_retry_of", ["retryOfOrderId"])
    .index("by_org_status", ["orgId", "status", "createdAt"])
    .index("by_org_user_idem", ["orgId", "userId", "idempotencyKey"]),

  paymentSlots: defineTable({
    orgId: v.id("organizations"),
    baseAmountPaise: v.number(),
    slot: v.number(),
    state: slotState,
    orderId: v.optional(v.id("orders")),
    heldAt: v.optional(v.number()),
    quarantinedAt: v.optional(v.number()),
  })
    .index("by_org_base_state", ["orgId", "baseAmountPaise", "state"])
    .index("by_org_base_slot", ["orgId", "baseAmountPaise", "slot"])
    .index("by_order", ["orderId"]),

  bankEmails: defineTable({
    orgId: v.id("organizations"),
    gmailMessageId: v.string(),
    receivedAt: v.number(),
    amountPaise: v.number(),
    senderEmail: v.string(),
    toAlias: v.optional(v.string()),        // inbox alias that received it
    bankKey: v.optional(v.string()),        // which bank template matched
    templateId: v.optional(v.id("bankEmailTemplates")),
    upiRef: v.optional(v.string()),
    payerVpa: v.optional(v.string()),       // customer UPI (for refunds)
    payerName: v.optional(v.string()),
    subject: v.optional(v.string()),
    rawBody: v.string(),
    status: bankEmailStatus,
    matchedOrderId: v.optional(v.id("orders")),
    duplicateOfEmailId: v.optional(v.id("bankEmails")),
    adminNote: v.optional(v.string()),
  })
    .index("by_message_id", ["gmailMessageId"])
    .index("by_org_amount_status", ["orgId", "amountPaise", "status"])
    .index("by_org_status", ["orgId", "status", "receivedAt"])
    .index("by_matched_order", ["matchedOrderId"])
    .index("by_upi_ref", ["upiRef"]),

  // Multiple UPI VPAs per org for rotation / failover.
  paymentVpas: defineTable({
    orgId: v.id("organizations"),
    vpa: v.string(),                        // e.g. "smokeshop@ybl"
    label: v.optional(v.string()),          // e.g. "HDFC primary"
    active: v.boolean(),
    priority: v.number(),                   // lower = preferred
    lastUsedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_org_active", ["orgId", "active", "priority"])
    .index("by_vpa", ["vpa"]),

  // Multiple inbound email aliases per org (for multi-bank or rotation).
  bankInboxes: defineTable({
    orgId: v.id("organizations"),
    alias: v.string(),                      // e.g. "bank-smokeshop@cigarro.in"
    label: v.optional(v.string()),          // e.g. "HDFC personal"
    bankKey: v.optional(v.string()),        // hint to template selector
    active: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_alias", ["alias"])
    .index("by_org_active", ["orgId", "active"]),

  // Pluggable parser templates per bank. orgId=null = system-wide default.
  bankEmailTemplates: defineTable({
    bankKey: v.string(),                    // "hdfc", "sbi", "icici", ...
    label: v.string(),                      // "HDFC credit alert v1"
    orgId: v.optional(v.id("organizations")),
    active: v.boolean(),
    priority: v.number(),                   // lower tried first
    senderRegex: v.string(),                // regex source, JS flavor
    subjectRegex: v.optional(v.string()),
    amountRegex: v.string(),                // group 1 captures amount
    refRegex: v.string(),                   // group 1 captures UPI ref
    payerVpaRegex: v.optional(v.string()),
    payerNameRegex: v.optional(v.string()),
    creditOnly: v.boolean(),                // if false, a debit regex must also match
    debitGuardRegex: v.optional(v.string()),// reject if matches (avoids confusing debit alerts)
    createdAt: v.number(),
  })
    .index("by_bank_active", ["bankKey", "active", "priority"])
    .index("by_org", ["orgId"]),

  latePayments: defineTable({
    orgId: v.id("organizations"),
    bankEmailId: v.id("bankEmails"),
    suspectedOrderId: v.id("orders"),
    amountPaise: v.number(),
    status: latePaymentStatus,
    adminNote: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.string()),
  })
    .index("by_org_status", ["orgId", "status"])
    .index("by_suspected_order", ["suspectedOrderId"]),

  walletAccounts: defineTable({
    orgId: v.id("organizations"),
    userId: v.string(),
    balancePaise: v.number(),
    updatedAt: v.number(),
  }).index("by_org_user", ["orgId", "userId"]),

  walletLedger: defineTable({
    orgId: v.id("organizations"),
    userId: v.string(),
    entryType: v.union(v.literal("credit"), v.literal("debit")),
    amountPaise: v.number(),
    balanceAfterPaise: v.number(),
    reason: ledgerReason,
    relatedOrderId: v.optional(v.id("orders")),
    createdAt: v.number(),
    createdBy: v.string(),
    note: v.optional(v.string()),
  })
    .index("by_org_user_time", ["orgId", "userId", "createdAt"])
    .index("by_org_order", ["orgId", "relatedOrderId"]),

  // Platform-wide singleton config. One row expected; use `key = "singleton"`.
  appConfig: defineTable({
    key: v.string(),
    gasTemplateUrl: v.optional(v.string()),
    bankSenders: v.optional(v.array(v.string())), // e.g. ["@hdfcbank.bank.in", "@icicibank.com"]
    updatedAt: v.number(),
    updatedBy: v.optional(v.string()),
  }).index("by_key", ["key"]),

  adminAuditLog: defineTable({
    orgId: v.id("organizations"),
    adminUserId: v.string(),
    action: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    payload: v.any(),
    createdAt: v.number(),
  }).index("by_org_time", ["orgId", "createdAt"]),
});
