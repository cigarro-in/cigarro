import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { crashSource } from './lib/crashLog';
import { storeAgeGateV, storeBrandV, storeBusinessV, storeReferralV, storeSeoV, storeSocialsV } from './lib/siteSettings';

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
  v.literal("referral_reward"),
);

export const bankEmailStatus = v.union(
  v.literal("unmatched"),
  v.literal("matched"),
  v.literal("quarantine_late"),
  v.literal("no_match"),
  v.literal("parse_failed"),
  v.literal("duplicate"),
  // Parseable amount but matched nothing AND no pending order was within
  // ₹2 at ingest (diagnostic aid: usually wrong amount paid, stale order,
  // or slot math drift — not a parser problem).
  v.literal("no_candidate"),
  // Nothing payable in the mail at all (statements, promos, mixed-mail
  // digests). Excluded from the admin Unmatched tab by design.
  v.literal("ignored"),
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

export const inventoryMovementType = v.union(
  v.literal("opening_balance"),
  v.literal("manual_adjustment"),
  v.literal("stock_received"),
  v.literal("online_reservation"),
  v.literal("reservation_release"),
  v.literal("online_sale"),
  v.literal("offline_sale"),
  v.literal("sale_reversal"),
  v.literal("return"),
);

export const invoiceStatus = v.union(
  v.literal("paid"),
  v.literal("due"),
  v.literal("voided"),
);

export const invoicePaymentMethod = v.union(
  v.literal("cash"),
  v.literal("upi"),
  v.literal("card"),
  v.literal("bank_transfer"),
  v.literal("other"),
);

export const addressV = v.object({
  line1: v.string(),
  line2: v.optional(v.string()),
  city: v.string(),
  state: v.string(),
  pincode: v.string(),
  name: v.string(),
  phone: v.string(),
  // GPS capture (checkout autofill). Optional: absent on older rows.
  latitude: v.optional(v.number()),
  longitude: v.optional(v.number()),
  userProvidedAddress: v.optional(v.string()),
});

export const orderItemV = v.object({
  productId: v.string(),
  variantId: v.optional(v.string()),
  name: v.string(),
  qty: v.number(),
  unitPricePaise: v.number(),
  // Image snapshot at order creation (variant/product image key). Optional
  // for legacy rows; views fall back to the catalog via useMyOrders.
  image: v.optional(v.string()),
});

export default defineSchema({
  crashLogs: defineTable({
    orgId: v.id('organizations'), reporter: v.string(), createdAt: v.number(),
    source: crashSource, message: v.string(), stack: v.string(),
    componentStack: v.string(), path: v.string(), userAgent: v.string(),
    build: v.string(), operation: v.string(), requestId: v.string(),
    status: v.optional(v.number()),
  }).index('by_org_created', ['orgId', 'createdAt'])
    .index('by_org_source_created', ['orgId', 'source', 'createdAt'])
    .index('by_reporter_created', ['reporter', 'createdAt'])
    .index('by_created', ['createdAt']),
  organizations: defineTable({
    slug: v.string(),
    name: v.string(),
    upiVpa: v.string(),
    bankEmailAlias: v.string(),
    walletEnabled: v.boolean(),
    // Lucky 1–99p discount doubles as the payment fingerprint (exact-amount
    // email matching). Only needed at high traffic (pending orders sharing a
    // rupee total); off = exact rupee totals, no per-order giveaway.
    // Optional so existing org rows validate; absent = enabled.
    luckyEnabled: v.optional(v.boolean()),
    slotTimeoutMs: v.number(),
    quarantineMs: v.number(),
    slotsPerBase: v.number(),
    active: v.boolean(),
    createdAt: v.number(),

    // Dormant: pre-Gmail-poller Apps Script config. Nothing reads these;
    // kept optional so existing org rows still validate. Do not reuse.
    gasWebhookUrl: v.optional(v.string()),
    gasWebhookSecret: v.optional(v.string()),

    // Bank/UPI alert senders whose emails count as payment confirmations.
    // Empty or absent = no filter. See convex/lib/bankSenders.ts.
    allowedBankSenders: v.optional(v.array(v.string())),
  })
    .index("by_slug", ["slug"])
    .index("by_alias", ["bankEmailAlias"]),

  // Hostname → org routing. hostname is lowercase, no port, no trailing dot.
  orgDomains: defineTable({
    orgId: v.id("organizations"),
    hostname: v.string(),
    kind: v.union(v.literal("primary"), v.literal("alias")),
    // Derived from Cloudflare only (convex/lib/domainStatus.ts), never set by
    // hand. "disabled" is a legacy value from manual status control; it is
    // overwritten on the next Cloudflare check.
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("disabled"),
      v.literal("error"),
    ),
    // True for the platform-generated <slug>.<PLATFORM_ROOT_DOMAIN> row.
    managed: v.optional(v.boolean()),
    cfHostnameId: v.optional(v.string()),
    // Cloudflare Pages domain status (initializing/pending/active/...) and
    // the DNS records the merchant must add. Written by convex/domains.ts.
    cfStatus: v.optional(v.string()),
    cfError: v.optional(v.string()),
    cfCheckedAt: v.optional(v.number()),
    lastActiveAt: v.optional(v.number()),
    // Last 5 status changes, newest last.
    statusHistory: v.optional(
      v.array(
        v.object({
          status: v.union(
            v.literal("pending"),
            v.literal("active"),
            v.literal("disabled"),
            v.literal("error"),
          ),
          at: v.number(),
          cfStatus: v.optional(v.string()),
        }),
      ),
    ),
    dnsInstructions: v.optional(
      v.object({
        cnameTarget: v.string(),
        txtRecords: v.array(v.object({ name: v.string(), value: v.string() })),
      }),
    ),
    createdAt: v.number(),
    verifiedAt: v.optional(v.number()),
  })
    .index("by_hostname", ["hostname"])
    .index("by_org", ["orgId"]),

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
    // Customer-facing five-digit order number; legacy rows may omit it.
    orderNumber: v.optional(v.number()),
    kind: orderKind,
    retryOfOrderId: v.optional(v.id("orders")),

    items: v.array(orderItemV),
    address: v.optional(addressV),

    cartTotalPaise: v.number(),
    // Discounts applied at checkout (lucky + server-validated coupon).
    // Subtracted BEFORE wallet/slot math, so base/final (UPI deeplink,
    // /transaction amount, bank-email match) all see the discounted total.
    discountPaise: v.optional(v.number()),
    discountId: v.optional(v.id("discounts")),
    discountLabel: v.optional(v.string()),
    walletDebitPaise: v.number(),
    // Server-resolved delivery charge included in the UPI fingerprint amount.
    // The client may request a method, but never sets this money value.
    shippingMethod: v.optional(v.string()),
    shippingPricePaise: v.optional(v.number()),
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
    lastWakeAt: v.optional(v.number()),      // throttle for customer wake/refresh polls
    pollGeneration: v.optional(v.number()), // epoch for scheduled inbox checks; wake bumps it so stale chains exit
    // Set when an admin refunds a paid order: where the money went back.
    // Absent on legacy refunds (destination unknown).
    refundDestination: v.optional(v.union(v.literal("wallet"), v.literal("bank"))),
    // Inventory is reserved while payment is pending, committed when paid,
    // and released when an unpaid order terminates. Optional for legacy rows.
    inventoryState: v.optional(v.union(
      v.literal("reserved"),
      v.literal("committed"),
      v.literal("released"),
      v.literal("returned"),
    )),
  })
    .index("by_org_user", ["orgId", "userId", "createdAt"])
    .index("by_org_final_status", ["orgId", "finalAmountPaise", "status"])
    .index("by_display_id", ["displayOrderId"])
    .index("by_org_order_number", ["orgId", "orderNumber"])
    .index("by_retry_of", ["retryOfOrderId"])
    .index("by_org_status", ["orgId", "status", "createdAt"])
    .index("by_org_user_idem", ["orgId", "userId", "idempotencyKey"])
    // Payment statement: email-matched credits by paid time, refunds by refund time.
    .index("by_org_method_paid", ["orgId", "verificationMethod", "paidAt"])
    .index("by_org_status_terminal", ["orgId", "status", "terminalAt"]),

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
    vpa: v.string(),                        // e.g. "store@ybl"
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
    alias: v.string(),                      // e.g. "bank-store@cigarro.in"
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
    expiresAt: v.optional(v.number()), // referral credits: when the reward lapses
  })
    .index("by_org_user_time", ["orgId", "userId", "createdAt"])
    .index("by_org_order", ["orgId", "relatedOrderId"]),

  // App-wide Nominatim upstream reservation (public max: absolute 1
  // req/sec for the whole application). One row (key = "nominatim") holds
  // the last reservation timestamp; the internal mutation in
  // convex/geocode.ts reads + writes it atomically, so concurrent actions
  // serialize on this row. Kept separate from appConfig so unrelated admin
  // writes never contend with geocode reservations.
  geocodeUpstreamSlots: defineTable({
    key: v.string(),
    lastReservedAt: v.number(),
  }).index("by_key", ["key"]),

  // Platform-wide singleton config. One row expected; use `key = "singleton"`.
  appConfig: defineTable({
    key: v.string(),
    bankSenders: v.optional(v.array(v.string())), // e.g. ["@hdfcbank.bank.in", "@icicibank.com"]
    // Gmail: DORMANT legacy single-slot fields. Connections are per store now
    // (gmailConnections). gmailRefreshToken is no longer read (its one-time
    // migration was removed); the other gmail* fields are kept (optional)
    // so old rows validate. Platform bank-sender allowlist (bankSenders) stays live.
    gmailPollEnabled: v.optional(v.boolean()),
    gmailQuery: v.optional(v.string()),
    gmailOrgId: v.optional(v.id("organizations")),
    gmailLastPollAt: v.optional(v.number()),
    gmailLastError: v.optional(v.string()),
    // Legacy plaintext refresh token. No longer read; kept so old rows validate.
    gmailRefreshToken: v.optional(v.string()),
    gmailAccountEmail: v.optional(v.string()),
    // Pending OAuth handshake (single-use, 10-min expiry).
    pendingOAuthState: v.optional(v.string()),
    pendingOAuthBy: v.optional(v.string()),
    pendingOAuthUri: v.optional(v.string()),
    pendingOAuthReturnTo: v.optional(v.string()),
    pendingOAuthAt: v.optional(v.number()),
    updatedAt: v.number(),
    updatedBy: v.optional(v.string()),
  }).index("by_key", ["key"]),

  // Per-store Gmail connection (one row per org). The refresh token is
  // AES-GCM encrypted with GMAIL_TOKEN_KEY (convex/lib/crypto.ts); plaintext
  // never lands in the DB. Replaces the single appConfig.gmailRefreshToken slot.
  gmailConnections: defineTable({
    orgId: v.id("organizations"),
    accountEmail: v.string(),
    refreshTokenEnc: v.optional(v.string()), // base64(iv || ciphertext); cleared on disconnect
    status: v.union(
      v.literal("active"),
      v.literal("needs_reconnect"),
      v.literal("disconnected"),
    ),
    lastPollAt: v.optional(v.number()),
    lastSuccessAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    lastErrorAt: v.optional(v.number()),
    connectedBy: v.string(), // userId of the admin who connected
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_org", ["orgId"]),

  // Single-use OAuth handshake rows (10-minute expiry), one per Connect click.
  gmailOAuthStates: defineTable({
    state: v.string(),
    orgId: v.id("organizations"),
    userId: v.string(),
    returnTo: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_state", ["state"]),

  adminAuditLog: defineTable({
    // Optional: platform (super-admin) writes are not scoped to a store.
    orgId: v.optional(v.id("organizations")),
    adminUserId: v.string(),
    // Optional: rows written before Citadel super-admin SSO have no actor type.
    actorType: v.optional(v.union(v.literal("store_admin"), v.literal("super_admin"))),
    actorId: v.optional(v.string()),
    action: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    payload: v.any(),
    createdAt: v.number(),
  }).index("by_org_time", ["orgId", "createdAt"]),

  // Citadel super-admin sessions. Only the SHA-256 of the opaque bearer token
  // is stored; the raw token exists only in the browser's sessionStorage.
  saSessions: defineTable({
    tokenHash: v.string(),
    adminId: v.string(), // Citadel `sub`
    citadelSid: v.string(),
    write: v.boolean(),
    writeExpiresAt: v.optional(v.number()),
    createdAt: v.number(),
    lastSeenAt: v.number(), // idle timeout clock (10 min)
    expiresAt: v.number(), // createdAt + 1 h hard cap
    revokedAt: v.optional(v.number()),
  }).index("by_tokenHash", ["tokenHash"]),

  // Launch-token jti replay guard. Rows are swept once `exp` has passed.
  saExchangedJtis: defineTable({
    jti: v.string(),
    exp: v.number(), // seconds, from the JWT
  })
    .index("by_jti", ["jti"])
    .index("by_exp", ["exp"]),

  inventoryBalances: defineTable({
    orgId: v.id("organizations"),
    variantSupabaseId: v.string(),
    onHand: v.number(),
    reserved: v.number(),
    reorderPoint: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org_variant", ["orgId", "variantSupabaseId"])
    .index("by_org", ["orgId"]),

  inventoryMovements: defineTable({
    orgId: v.id("organizations"),
    variantSupabaseId: v.string(),
    productSupabaseId: v.string(),
    type: inventoryMovementType,
    quantityDelta: v.number(),
    reservedDelta: v.number(),
    onHandBefore: v.number(),
    onHandAfter: v.number(),
    reservedBefore: v.number(),
    reservedAfter: v.number(),
    referenceType: v.optional(v.string()),
    referenceId: v.optional(v.string()),
    note: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
  })
    .index("by_org_time", ["orgId", "createdAt"])
    .index("by_org_variant_time", ["orgId", "variantSupabaseId", "createdAt"])
    .index("by_reference", ["referenceType", "referenceId"]),

  invoiceSettings: defineTable({
    orgId: v.id("organizations"),
    prefix: v.string(),
    nextNumber: v.number(),
    businessName: v.string(),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    gstin: v.optional(v.string()),
    terms: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    updatedAt: v.number(),
    updatedBy: v.string(),
  }).index("by_org", ["orgId"]),

  invoices: defineTable({
    orgId: v.id("organizations"),
    invoiceNumber: v.string(),
    status: invoiceStatus,
    paymentMethod: invoicePaymentMethod,
    paymentReference: v.optional(v.string()),
    customerName: v.string(),
    customerPhone: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    customerAddress: v.optional(v.string()),
    seller: v.object({
      businessName: v.string(),
      address: v.optional(v.string()),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
      gstin: v.optional(v.string()),
      terms: v.optional(v.string()),
      accentColor: v.optional(v.string()),
    }),
    items: v.array(v.object({
      productSupabaseId: v.string(),
      variantSupabaseId: v.string(),
      productName: v.string(),
      variantName: v.string(),
      quantity: v.number(),
      unitPricePaise: v.number(),
      lineTotalPaise: v.number(),
    })),
    subtotalPaise: v.number(),
    discountPaise: v.number(),
    taxRateBps: v.number(),
    taxPaise: v.number(),
    totalPaise: v.number(),
    notes: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.string(),
    voidedAt: v.optional(v.number()),
    voidedBy: v.optional(v.string()),
    voidReason: v.optional(v.string()),
  })
    .index("by_org_created", ["orgId", "createdAt"])
    .index("by_org_number", ["orgId", "invoiceNumber"])
    .index("by_org_idempotency", ["orgId", "idempotencyKey"]),

  // ---- Phase 1: user state ----
  // userId is the stable user identity.
  // Phase 2 keeps these exact strings as the stable identity when the
  // issuer changes (Convex users table maps phone -> legacy userId).
  users: defineTable({
    // Stable identity, shared across auth providers. Unique per (store, phone):
    // the same phone shopping two stores gets two rows with two userIds.
    userId: v.string(),
    // Owning store. Optional: legacy rows created before per-store accounts
    // have no orgId and belong to the legacy org.
    orgId: v.optional(v.id("organizations")),
    phone: v.optional(v.string()), // E.164, e.g. +919876543210
    name: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_phone", ["phone"])
    .index("by_org_phone", ["orgId", "phone"]),

  carts: defineTable({
    orgId: v.id("organizations"),
    userId: v.string(),
    variantId: v.optional(v.string()),
    productId: v.string(),
    comboId: v.optional(v.string()),
    name: v.string(),
    variantName: v.optional(v.string()),
    // Snapshot of the unit price in rupees at add-to-cart time; the
    // checkout always re-prices from the catalog before creating an order.
    unitPriceRupees: v.number(),
    qty: v.number(),
    imageUrl: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_org_user", ["orgId", "userId"])
    .index("by_org_user_variant", ["orgId", "userId", "variantId"]),

  wishlists: defineTable({
    orgId: v.id("organizations"),
    userId: v.string(),
    productId: v.string(),
    createdAt: v.number(),
  })
    .index("by_org_user", ["orgId", "userId"])
    .index("by_org_user_product", ["orgId", "userId", "productId"]),

  savedAddresses: defineTable({
    orgId: v.id("organizations"),
    userId: v.string(),
    label: v.optional(v.string()),
    address: addressV,
    isDefault: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_org_user", ["orgId", "userId"]),

  // ---- Content tables ----
  // ORG-SCOPED content: every row carries the owning orgId (optional until
  // the org backfill runs; new writes always set it). Public reads filter by
  // the slug-resolved org; admin writes require that org's admin.
  blogCategories: defineTable({
    orgId: v.optional(v.id("organizations")),
    slug: v.string(),
    name: v.string(),
    color: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.boolean(),
    sortOrder: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_active_sort", ["isActive", "sortOrder"])
    .index("by_org", ["orgId"])
    .index("by_org_slug", ["orgId", "slug"]),

  blogPosts: defineTable({
    orgId: v.optional(v.id("organizations")),
    slug: v.string(),
    title: v.string(),
    excerpt: v.optional(v.string()),
    content: v.string(),
    featuredImage: v.optional(v.string()),
    status: v.string(), // published | draft
    // Plain string — no profiles join.
    authorName: v.string(),
    categorySlug: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    readingTime: v.optional(v.number()),
    metaTitle: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    ogTitle: v.optional(v.string()),
    ogDescription: v.optional(v.string()),
    ogImage: v.optional(v.string()),
    canonicalUrl: v.optional(v.string()),
    isFeatured: v.optional(v.boolean()),
    isPinned: v.optional(v.boolean()),
    likeCount: v.optional(v.number()),
    viewCount: v.optional(v.number()),
    sortOrder: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_status_published", ["status", "publishedAt"])
    .index("by_category_status", ["categorySlug", "status", "publishedAt"])
    .index("by_org", ["orgId"])
    .index("by_org_slug", ["orgId", "slug"])
    .index("by_org_status", ["orgId", "status", "publishedAt"])
    .index("by_org_category", ["orgId", "categorySlug", "status", "publishedAt"]),

  // Store pages (About, Contact, policies): one row per org + slug. Unpublished
  // or missing rows fall back to the built-in storefront page.
  storePages: defineTable({
    orgId: v.id("organizations"),
    slug: v.string(),
    title: v.string(),
    body: v.string(),
    published: v.boolean(),
    metaTitle: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_slug", ["orgId", "slug"]),

  heroSlides: defineTable({
    orgId: v.optional(v.id("organizations")),
    title: v.optional(v.string()),
    subtitle: v.optional(v.string()),
    suptitle: v.optional(v.string()),
    description: v.optional(v.string()),
    buttonText: v.optional(v.string()),
    buttonUrl: v.optional(v.string()),
    buttonStyle: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    mobileImageUrl: v.optional(v.string()),
    productImageUrl: v.optional(v.string()),
    productName: v.optional(v.string()),
    productPrice: v.optional(v.number()),
    smallImageUrl: v.optional(v.string()),
    overlayOpacity: v.optional(v.number()),
    textColor: v.optional(v.string()),
    textPosition: v.optional(v.string()),
    sortOrder: v.number(),
    isActive: v.boolean(),
  })
    .index("by_active_sort", ["isActive", "sortOrder"])
    .index("by_org", ["orgId"]),

  sectionConfigurations: defineTable({
    orgId: v.optional(v.id("organizations")),
    sectionName: v.string(),
    title: v.optional(v.string()),
    subtitle: v.optional(v.string()),
    description: v.optional(v.string()),
    backgroundImage: v.optional(v.string()),
    buttonText: v.optional(v.string()),
    buttonUrl: v.optional(v.string()),
    config: v.optional(v.any()),
    maxItems: v.optional(v.number()),
    isEnabled: v.optional(v.boolean()),
  })
    .index("by_name", ["sectionName"])
    .index("by_org", ["orgId"])
    .index("by_org_name", ["orgId", "sectionName"]),

  homepageComponentConfig: defineTable({
    orgId: v.optional(v.id("organizations")),
    componentName: v.string(),
    config: v.optional(v.any()),
    isEnabled: v.boolean(),
    displayOrder: v.number(),
    sectionId: v.optional(v.string()),
  })
    .index("by_order", ["displayOrder"])
    .index("by_component", ["componentName"])
    .index("by_org", ["orgId"])
    .index("by_org_component", ["orgId", "componentName"]),

  siteSettings: defineTable({
    orgId: v.optional(v.id("organizations")),
    key: v.string(), // per-org singleton: key = "main"
    siteName: v.optional(v.string()),
    metaTitle: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    faviconUrl: v.optional(v.string()),
    activeTheme: v.optional(v.string()),
    upiId: v.optional(v.string()),
    // Shipping methods config (admin-edited). Shape:
    // { standard?: {enabled, priceRupees, label, eta}, express?: {...}, priority?: {...} }
    // Absent keys fall back to DEFAULT_SHIPPING_METHODS in src/lib/shipping.ts.
    shippingConfig: v.optional(v.any()),
    // Per-store settings (all optional; defaults live in src/config/site.ts).
    brand: v.optional(storeBrandV),
    business: v.optional(storeBusinessV),
    ageGate: v.optional(storeAgeGateV),
    referralRewardPaise: v.optional(v.number()), // integer paise (legacy flat reward; see `referral`)
    referral: v.optional(storeReferralV), // Refer & earn program rules
    seo: v.optional(storeSeoV),
    socials: v.optional(storeSocialsV),
    updatedAt: v.optional(v.number()),
    updatedBy: v.optional(v.string()),
  })
    .index("by_key", ["key"])
    .index("by_org", ["orgId"])
    .index("by_org_key", ["orgId", "key"]),

  // ---- Wave 3: catalog ----
  // Authorship lives in Convex.
  // Money in catalog tables is RUPEES (numbers); integer
  // PAISE applies only at the order/wallet boundary (rupeesToPaise).
  // supabaseId preserves the original UUID for idempotent backfill + join
  // rebuild; slugs keep uniqueness PER ORG via by_org_slug (enforced in
  // mutations). orgId optional until the org backfill runs; new writes set it.
  catalogBrands: defineTable({
    orgId: v.optional(v.id("organizations")),
    supabaseId: v.string(),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    countryOfOrigin: v.optional(v.string()),
    heritage: v.optional(v.any()), // JSON object (founder, year, …)
    isActive: v.boolean(),
    sortOrder: v.optional(v.number()),
    metaTitle: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_supabase", ["supabaseId"])
    .index("by_active_sort", ["isActive", "sortOrder"])
    .index("by_org", ["orgId"])
    .index("by_org_slug", ["orgId", "slug"])
    .index("by_org_supabase", ["orgId", "supabaseId"]),

  catalogCategories: defineTable({
    orgId: v.optional(v.id("organizations")),
    supabaseId: v.string(),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    image: v.optional(v.string()),
    imageAltText: v.optional(v.string()),
    metaTitle: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    // Optional: predates the Convex authorship cutover; absent = active.
    isActive: v.optional(v.boolean()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_supabase", ["supabaseId"])
    .index("by_org", ["orgId"])
    .index("by_org_slug", ["orgId", "slug"])
    .index("by_org_supabase", ["orgId", "supabaseId"]),

  catalogProducts: defineTable({
    orgId: v.optional(v.id("organizations")),
    supabaseId: v.string(),
    name: v.string(),
    slug: v.string(),
    brandSupabaseId: v.optional(v.string()),
    description: v.optional(v.string()),
    shortDescription: v.optional(v.string()),
    origin: v.optional(v.string()),
    specifications: v.optional(v.any()),
    isActive: v.boolean(),
    metaTitle: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    canonicalUrl: v.optional(v.string()),
    ratingValue: v.optional(v.number()),
    reviewCount: v.optional(v.number()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_supabase", ["supabaseId"])
    .index("by_brand_active", ["brandSupabaseId", "isActive"])
    .index("by_active_created", ["isActive", "createdAt"])
    .index("by_org", ["orgId"])
    .index("by_org_slug", ["orgId", "slug"])
    .index("by_org_supabase", ["orgId", "supabaseId"])
    .index("by_org_brand_active", ["orgId", "brandSupabaseId", "isActive"])
    .index("by_org_active", ["orgId", "isActive", "createdAt"]),

  catalogVariants: defineTable({
    orgId: v.optional(v.id("organizations")),
    supabaseId: v.string(),
    productSupabaseId: v.string(),
    variantName: v.string(),
    variantSlug: v.string(),
    variantType: v.optional(v.string()),
    unitsContained: v.optional(v.number()),
    unit: v.optional(v.string()),
    images: v.optional(v.array(v.string())),
    imageAltText: v.optional(v.string()),
    priceRupees: v.number(),
    compareAtPriceRupees: v.optional(v.number()),
    costPriceRupees: v.optional(v.number()),
    stock: v.optional(v.number()),
    trackInventory: v.optional(v.boolean()),
    isDefault: v.optional(v.boolean()),
    isActive: v.boolean(),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_supabase", ["supabaseId"])
    .index("by_product", ["productSupabaseId"])
    .index("by_product_slug", ["productSupabaseId", "variantSlug"])
    .index("by_org", ["orgId"])
    .index("by_org_supabase", ["orgId", "supabaseId"])
    .index("by_org_product", ["orgId", "productSupabaseId"])
    .index("by_org_product_slug", ["orgId", "productSupabaseId", "variantSlug"]),

  catalogProductCategories: defineTable({
    orgId: v.optional(v.id("organizations")),
    productSupabaseId: v.string(),
    categorySupabaseId: v.string(),
    order: v.optional(v.number()),
  })
    .index("by_product", ["productSupabaseId"])
    .index("by_category", ["categorySupabaseId"])
    .index("by_org", ["orgId"])
    .index("by_org_product", ["orgId", "productSupabaseId"])
    .index("by_org_category", ["orgId", "categorySupabaseId"]),

  catalogCollections: defineTable({
    orgId: v.optional(v.id("organizations")),
    supabaseId: v.string(),
    title: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    type: v.optional(v.string()),
    rules: v.optional(v.any()),
    sortOrder: v.optional(v.number()),
    isActive: v.boolean(),
    seoTitle: v.optional(v.string()),
    seoDescription: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_supabase", ["supabaseId"])
    .index("by_org", ["orgId"])
    .index("by_org_slug", ["orgId", "slug"])
    .index("by_org_supabase", ["orgId", "supabaseId"]),

  catalogCollectionProducts: defineTable({
    orgId: v.optional(v.id("organizations")),
    collectionSupabaseId: v.string(),
    productSupabaseId: v.string(),
    sortOrder: v.optional(v.number()),
  })
    .index("by_collection", ["collectionSupabaseId"])
    .index("by_product", ["productSupabaseId"])
    .index("by_org", ["orgId"])
    .index("by_org_collection", ["orgId", "collectionSupabaseId"])
    .index("by_org_product", ["orgId", "productSupabaseId"]),

  catalogCombos: defineTable({
    orgId: v.optional(v.id("organizations")),
    supabaseId: v.string(),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    comboPriceRupees: v.number(),
    originalPriceRupees: v.optional(v.number()),
    discountPercentage: v.optional(v.number()),
    image: v.optional(v.string()),
    galleryImages: v.optional(v.array(v.string())),
    isActive: v.boolean(),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_supabase", ["supabaseId"])
    .index("by_org", ["orgId"])
    .index("by_org_slug", ["orgId", "slug"])
    .index("by_org_supabase", ["orgId", "supabaseId"]),

  catalogComboItems: defineTable({
    orgId: v.optional(v.id("organizations")),
    comboSupabaseId: v.string(),
    variantSupabaseId: v.string(),
    quantity: v.number(),
    sortOrder: v.optional(v.number()),
  })
    .index("by_combo", ["comboSupabaseId"])
    .index("by_org", ["orgId"])
    .index("by_org_combo", ["orgId", "comboSupabaseId"]),

  // ---------- Wave 7: commercial discounts ----------
  // ORG-SCOPED (codes unique per org). Money in RUPEES (cart totals are
  // rupees); paise only at the order boundary. Dates as ms timestamps.
  // Field names stay snake_case to match the shape the admin UI and
  // checkout already speak.
  discounts: defineTable({
    orgId: v.optional(v.id("organizations")),
    name: v.string(),
    code: v.optional(v.string()),
    description: v.optional(v.string()),
    type: v.string(),
    value: v.number(),
    min_cart_value: v.optional(v.number()),
    max_discount_amount: v.optional(v.number()),
    applicable_to: v.string(),
    product_ids: v.optional(v.array(v.string())),
    combo_ids: v.optional(v.array(v.string())),
    variant_ids: v.optional(v.array(v.string())),
    start_date: v.optional(v.number()),
    end_date: v.optional(v.number()),
    usage_limit: v.optional(v.number()),
    usage_count: v.number(),
    is_active: v.boolean(),
    // Customer-specific: user ids allowed to use it. Empty or absent = everyone.
    allowed_user_ids: v.optional(v.array(v.string())),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_org", ["orgId"])
    .index("by_org_code", ["orgId", "code"]),

  // ---------- Wave 7: referrals, minimal ----------
  // ORG-SCOPED: one row per user per org. userId = stable identity (same as
  // users table). Codes are shareable by design; validation stays
  // public (scoped by orgSlug), personal reads enforce subject match. Money in
  // RUPEES; dates as ms timestamps. Field names stay snake_case to match the
  // shape the app already speaks.
  referrals: defineTable({
    orgId: v.optional(v.id("organizations")),
    userId: v.string(),
    referralCode: v.string(),
    totalReferrals: v.number(),
    successfulReferrals: v.number(),
    totalRewardsEarned: v.number(),
    referredByUserId: v.optional(v.string()),
    referredByCode: v.optional(v.string()),
    referralRewardAmount: v.number(),
    firstOrderCompleted: v.boolean(),
    firstOrderId: v.optional(v.string()),
    firstOrderDate: v.optional(v.number()),
    ownRewardPaid: v.boolean(),
    ownRewardPaidAt: v.optional(v.number()),
    signupSource: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_code", ["referralCode"])
    .index("by_referrer", ["referredByUserId"])
    .index("by_org", ["orgId"])
    .index("by_org_user", ["orgId", "userId"])
    .index("by_org_code", ["orgId", "referralCode"])
    .index("by_org_referrer", ["orgId", "referredByUserId"]),

  // ---------- Marketing: WhatsApp deeplink blasts (admin) ----------
  // Contacts are org-scoped, deduped by normalized phone (digits only,
  // e.g. "9188XXXXXXXX"). Sends are click-to-chat deeplinks
  // (https://wa.me/<phone>?text=...), recorded per open — no BSP involved.
  marketingContacts: defineTable({
    orgId: v.id("organizations"),
    phone: v.string(),
    name: v.optional(v.string()),
    city: v.optional(v.string()),
    email: v.optional(v.string()),
    source: v.optional(v.string()),
    totalOrders: v.optional(v.number()),
    totalSalesPaise: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_org_phone", ["orgId", "phone"])
    .index("by_org", ["orgId"]),

  marketingCampaigns: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    // Supports {{name}} {{firstname}} {{city}} {{phone}} {{code}} {{link}}.
    // Snapshot of the template at send time — later template edits don't
    // rewrite history.
    message: v.string(),
    templateId: v.optional(v.id("marketingTemplates")),
    // Optional coupon driving order attribution (orders carry discountId).
    couponCode: v.optional(v.string()),
    discountId: v.optional(v.id("discounts")),
    createdAt: v.number(),
    createdBy: v.string(),
    sentCount: v.number(),
  }).index("by_org", ["orgId"]),

  // Reusable copy blocks campaigns snapshot from.
  marketingTemplates: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    message: v.string(),
    createdAt: v.number(),
    createdBy: v.string(),
  }).index("by_org", ["orgId"]),

  // One row per tap on the {{link}} short URL (see http.ts /m route).
  marketingClicks: defineTable({
    orgId: v.id("organizations"),
    campaignId: v.id("marketingCampaigns"),
    contactId: v.id("marketingContacts"),
    clickedAt: v.number(),
  }).index("by_campaign", ["campaignId"]),

  marketingSends: defineTable({
    orgId: v.id("organizations"),
    campaignId: v.id("marketingCampaigns"),
    contactId: v.id("marketingContacts"),
    phone: v.string(),
    sentAt: v.number(),
    sentBy: v.string(),
  })
    .index("by_campaign", ["campaignId"])
    .index("by_campaign_contact", ["campaignId", "contactId"])
    .index("by_org", ["orgId"]),

  // ---------- Wave 10: product reviews, Convex-native ----------
  // No backfill: rows start here. ORG-SCOPED, like catalog.
  // userId = stable identity. Only approved rows are public.
  productReviews: defineTable({
    orgId: v.optional(v.id("organizations")),
    productSupabaseId: v.string(),
    userId: v.string(),
    userName: v.optional(v.string()),
    rating: v.number(), // 1..5
    title: v.optional(v.string()),
    comment: v.optional(v.string()),
    isApproved: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_product", ["productSupabaseId"])
    .index("by_user_product", ["userId", "productSupabaseId"])
    .index("by_org", ["orgId"])
    .index("by_org_product", ["orgId", "productSupabaseId"])
    .index("by_org_user_product", ["orgId", "userId", "productSupabaseId"]),

  // ---------- Per-store 301/302/410 redirects ----------
  // fromPath: normalized (lowercase, no query, no trailing slash except "/").
  // toPath: normalized path or https URL; "" for 410. Invariant maintained by
  // convex/redirects.ts: no toPath is itself a fromPath of the same org
  // (chains are collapsed) and no redirect loops.
  orgRedirects: defineTable({
    orgId: v.id("organizations"),
    fromPath: v.string(),
    toPath: v.string(),
    status: v.union(v.literal(301), v.literal(302), v.literal(410)),
    source: v.union(
      v.literal("manual"),
      v.literal("import"),
      v.literal("slug_change"),
    ),
    hits: v.number(),
    lastHitAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org_from", ["orgId", "fromPath"])
    .index("by_org", ["orgId"]),

  // One row per one-time data migration (convex/migrations.ts). "done" rows are
  // never re-run; "failed" rows are retried until runs reaches the cap.
  migrations: defineTable({
    name: v.string(),
    status: v.union(v.literal("done"), v.literal("failed")),
    result: v.optional(v.string()),
    runs: v.number(),
    updatedAt: v.number(),
  }).index("by_name", ["name"]),
});
