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
});

export default defineSchema({
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
    bankSenders: v.optional(v.array(v.string())), // e.g. ["@hdfcbank.bank.in", "@icicibank.com"]
    // Gmail OAuth poller (the payment-verification feed). Secrets live in
    // Convex env (GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN), never here.
    gmailPollEnabled: v.optional(v.boolean()),
    gmailQuery: v.optional(v.string()),
    gmailOrgId: v.optional(v.id("organizations")),
    gmailLastPollAt: v.optional(v.number()),
    gmailLastError: v.optional(v.string()),
    // One-click Google connect: refresh token + connected inbox, stored
    // server-side so nobody pastes tokens. Env GMAIL_REFRESH_TOKEN still
    // works as fallback when this is unset.
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

  adminAuditLog: defineTable({
    orgId: v.id("organizations"),
    adminUserId: v.string(),
    action: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    payload: v.any(),
    createdAt: v.number(),
  }).index("by_org_time", ["orgId", "createdAt"]),

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

  // ---- Phase 1: user state (migrated off Supabase) ----
  // userId = Supabase auth.users.id during Phase 1 (bridge unchanged).
  // Phase 2 keeps these exact strings as the stable identity when the
  // issuer changes (Convex users table maps phone -> legacy userId).
  users: defineTable({
    // Stable identity, shared across auth providers. Today: Supabase sub.
    userId: v.string(),
    phone: v.optional(v.string()), // E.164, e.g. +919876543210
    name: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_phone", ["phone"]),

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

  // ---- Wave 2: content tables (Supabase -> Convex) ----
  // Content is GLOBAL (no orgId): one catalog, one blog, one homepage.
  // Tenant scoping applies to user/order/wallet data only; if a second
  // tenant ever needs its own catalog, add orgId here + backfill.
  blogCategories: defineTable({
    slug: v.string(),
    name: v.string(),
    color: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.boolean(),
    sortOrder: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_active_sort", ["isActive", "sortOrder"]),

  blogPosts: defineTable({
    slug: v.string(),
    title: v.string(),
    excerpt: v.optional(v.string()),
    content: v.string(),
    featuredImage: v.optional(v.string()),
    status: v.string(), // published | draft
    // Plain string — no profiles join (Supabase author rows not migrated).
    authorName: v.string(),
    categorySlug: v.optional(v.string()),
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
    .index("by_category_status", ["categorySlug", "status", "publishedAt"]),

  heroSlides: defineTable({
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
  }).index("by_active_sort", ["isActive", "sortOrder"]),

  sectionConfigurations: defineTable({
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
  }).index("by_name", ["sectionName"]),

  homepageComponentConfig: defineTable({
    componentName: v.string(),
    config: v.optional(v.any()),
    isEnabled: v.boolean(),
    displayOrder: v.number(),
    sectionId: v.optional(v.string()),
  })
    .index("by_order", ["displayOrder"])
    .index("by_component", ["componentName"]),

  siteSettings: defineTable({
    key: v.string(), // singleton: key = "main"
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
    updatedAt: v.optional(v.number()),
    updatedBy: v.optional(v.string()),
  }).index("by_key", ["key"]),

  // ---- Wave 3: catalog (migrating off Supabase) ----
  // Authorship moves to Convex; Supabase stays a read replica during soak.
  // Money in catalog tables is RUPEES (numbers, as in Supabase); integer
  // PAISE applies only at the order/wallet boundary (rupeesToPaise).
  // supabaseId preserves the original UUID for idempotent backfill + join
  // rebuild; slugs keep uniqueness via indexes (enforced in mutations).
  catalogBrands: defineTable({
    supabaseId: v.string(),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    countryOfOrigin: v.optional(v.string()),
    heritage: v.optional(v.any()), // JSON object in Supabase (founder, year, …)
    isActive: v.boolean(),
    sortOrder: v.optional(v.number()),
    metaTitle: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_supabase", ["supabaseId"])
    .index("by_active_sort", ["isActive", "sortOrder"]),

  catalogCategories: defineTable({
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
    .index("by_supabase", ["supabaseId"]),

  catalogProducts: defineTable({
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
    .index("by_active_created", ["isActive", "createdAt"]),

  catalogVariants: defineTable({
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
    .index("by_product_slug", ["productSupabaseId", "variantSlug"]),

  catalogProductCategories: defineTable({
    productSupabaseId: v.string(),
    categorySupabaseId: v.string(),
    order: v.optional(v.number()),
  })
    .index("by_product", ["productSupabaseId"])
    .index("by_category", ["categorySupabaseId"]),

  catalogCollections: defineTable({
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
    .index("by_supabase", ["supabaseId"]),

  catalogCollectionProducts: defineTable({
    collectionSupabaseId: v.string(),
    productSupabaseId: v.string(),
    sortOrder: v.optional(v.number()),
  })
    .index("by_collection", ["collectionSupabaseId"])
    .index("by_product", ["productSupabaseId"]),

  catalogCombos: defineTable({
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
    .index("by_supabase", ["supabaseId"]),

  catalogComboItems: defineTable({
    comboSupabaseId: v.string(),
    variantSupabaseId: v.string(),
    quantity: v.number(),
    sortOrder: v.optional(v.number()),
  }).index("by_combo", ["comboSupabaseId"]),

  // ---------- Wave 7: commercial discounts (Supabase -> Convex) ----------
  // GLOBAL (no orgId), like catalog. Money in RUPEES (cart totals are
  // rupees); paise only at the order boundary. Dates as ms timestamps.
  // Field names stay snake_case to match the Supabase shape the admin
  // UI and checkout already speak.
  discounts: defineTable({
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
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  }).index("by_code", ["code"]),

  // ---------- Wave 7: referrals, minimal (Supabase -> Convex) ----------
  // GLOBAL (no orgId). userId = stable identity (Supabase sub, same as users
  // table). Codes are shareable by design; validation stays public, personal
  // reads enforce subject match. Money in RUPEES; dates as ms timestamps.
  // Field names stay snake_case to match the shape the app already speaks.
  referrals: defineTable({
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
    .index("by_referrer", ["referredByUserId"]),

  // ---------- Marketing: WhatsApp deeplink blasts (admin) ----------
  // Contacts are org-scoped, deduped by normalized phone (digits only,
  // e.g. "9188XXXXXXXX"). Sends are click-to-chat deeplinks
  // (https://wa.me/<phone>?text=...), recorded per open â€” no BSP involved.
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
    // Snapshot of the template at send time â€” later template edits don't
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
  // Never existed in Supabase in usable form (product_reviews dropped by
  // migration 076), so no backfill: rows start here. GLOBAL, like catalog.
  // userId = stable identity. Only approved rows are public.
  productReviews: defineTable({
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
    .index("by_user_product", ["userId", "productSupabaseId"]),
});
