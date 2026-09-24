import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOrgAdmin } from "./lib/auth";
import { audit } from "./lib/audit";
import { changeInventory } from "./lib/inventory";
import { findOrgDocBySupabase, inOrg } from "./lib/org";

const paymentMethodV = v.union(
  v.literal("cash"),
  v.literal("upi"),
  v.literal("card"),
  v.literal("bank_transfer"),
  v.literal("other"),
);

const lineV = v.object({
  variantSupabaseId: v.string(),
  quantity: v.number(),
  unitPricePaise: v.number(),
});

const defaultSettings = (org: { name: string }) => ({
  prefix: "INV",
  nextNumber: 1,
  businessName: org.name,
  address: undefined,
  phone: undefined,
  email: undefined,
  gstin: undefined,
  terms: "Thank you for your business.",
  accentColor: "#9a4f2d",
});

export const getSettings = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireOrgAdmin(ctx, orgId);
    const [org, settings] = await Promise.all([
      ctx.db.get(orgId),
      ctx.db.query("invoiceSettings").withIndex("by_org", (q) => q.eq("orgId", orgId)).unique(),
    ]);
    if (!org) throw new ConvexError({ code: "ORG_NOT_FOUND" });
    return settings ?? defaultSettings(org);
  },
});

export const saveSettings = mutation({
  args: {
    orgId: v.id("organizations"),
    prefix: v.string(),
    businessName: v.string(),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    gstin: v.optional(v.string()),
    terms: v.optional(v.string()),
    accentColor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireOrgAdmin(ctx, args.orgId);
    const prefix = args.prefix.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12);
    if (!prefix || !args.businessName.trim())
      throw new ConvexError({ code: "INVOICE_SETTINGS_REQUIRED" });
    const current = await ctx.db
      .query("invoiceSettings")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .unique();
    const doc = {
      prefix,
      businessName: args.businessName.trim(),
      address: args.address?.trim() || undefined,
      phone: args.phone?.trim() || undefined,
      email: args.email?.trim() || undefined,
      gstin: args.gstin?.trim().toUpperCase() || undefined,
      terms: args.terms?.trim() || undefined,
      accentColor: args.accentColor || "#9a4f2d",
      updatedAt: Date.now(),
      updatedBy: identity.subject,
    };
    if (current) await ctx.db.patch(current._id, doc);
    else await ctx.db.insert("invoiceSettings", { orgId: args.orgId, nextNumber: 1, ...doc });
    return { saved: true };
  },
});

export const list = query({
  args: { orgId: v.id("organizations"), limit: v.optional(v.number()) },
  handler: async (ctx, { orgId, limit }) => {
    await requireOrgAdmin(ctx, orgId);
    return await ctx.db
      .query("invoices")
      .withIndex("by_org_created", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(Math.min(limit ?? 100, 300));
  },
});

export const get = query({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, { invoiceId }) => {
    const invoice = await ctx.db.get(invoiceId);
    if (!invoice) return null;
    await requireOrgAdmin(ctx, invoice.orgId);
    return invoice;
  },
});

export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    customerName: v.string(),
    customerPhone: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    customerAddress: v.optional(v.string()),
    items: v.array(lineV),
    discountPaise: v.number(),
    taxRateBps: v.number(),
    status: v.union(v.literal("paid"), v.literal("due")),
    paymentMethod: paymentMethodV,
    paymentReference: v.optional(v.string()),
    notes: v.optional(v.string()),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireOrgAdmin(ctx, args.orgId);
    const org = await ctx.db.get(args.orgId);
    if (!org) throw new ConvexError({ code: "ORG_NOT_FOUND" });
    const prior = await ctx.db
      .query("invoices")
      .withIndex("by_org_idempotency", (q) =>
        q.eq("orgId", args.orgId).eq("idempotencyKey", args.idempotencyKey),
      )
      .unique();
    if (prior) return { invoiceId: prior._id, invoiceNumber: prior.invoiceNumber, reused: true };
    if (!args.customerName.trim()) throw new ConvexError({ code: "CUSTOMER_NAME_REQUIRED" });
    if (args.items.length === 0 || args.items.length > 100)
      throw new ConvexError({ code: "INVALID_INVOICE_ITEMS" });
    if (!Number.isSafeInteger(args.discountPaise) || args.discountPaise < 0)
      throw new ConvexError({ code: "INVALID_DISCOUNT" });
    if (!Number.isSafeInteger(args.taxRateBps) || args.taxRateBps < 0 || args.taxRateBps > 10000)
      throw new ConvexError({ code: "INVALID_TAX_RATE" });

    const resolved = [];
    let subtotalPaise = 0;
    for (const line of args.items) {
      if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0 || line.quantity > 100000 ||
          !Number.isSafeInteger(line.unitPricePaise) || line.unitPricePaise < 0 || line.unitPricePaise > 1000000000) {
        throw new ConvexError({ code: "INVALID_INVOICE_LINE" });
      }
      const variant = await findOrgDocBySupabase(ctx, "catalogVariants", org, line.variantSupabaseId);
      if (!variant || !inOrg(variant, org) || !variant.isActive)
        throw new ConvexError({ code: "VARIANT_NOT_FOUND" });
      const product = await findOrgDocBySupabase(ctx, "catalogProducts", org, variant.productSupabaseId);
      if (!product || !inOrg(product, org)) throw new ConvexError({ code: "PRODUCT_NOT_FOUND" });
      const lineTotalPaise = line.quantity * line.unitPricePaise;
      subtotalPaise += lineTotalPaise;
      if (!Number.isSafeInteger(subtotalPaise))
        throw new ConvexError({ code: "INVOICE_TOTAL_TOO_LARGE" });
      resolved.push({ line, variant, product, lineTotalPaise });
    }
    if (args.discountPaise > subtotalPaise)
      throw new ConvexError({ code: "DISCOUNT_EXCEEDS_SUBTOTAL" });
    const taxablePaise = subtotalPaise - args.discountPaise;
    const taxPaise = Math.round((taxablePaise * args.taxRateBps) / 10000);
    const totalPaise = taxablePaise + taxPaise;

    let settings = await ctx.db
      .query("invoiceSettings")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .unique();
    if (!settings) {
      const defaults = defaultSettings(org);
      const settingsId = await ctx.db.insert("invoiceSettings", {
        orgId: args.orgId,
        ...defaults,
        updatedAt: Date.now(),
        updatedBy: identity.subject,
      });
      settings = (await ctx.db.get(settingsId))!;
    }
    const year = new Date().getFullYear();
    const invoiceNumber = `${settings.prefix}-${year}-${String(settings.nextNumber).padStart(4, "0")}`;
    await ctx.db.patch(settings._id, { nextNumber: settings.nextNumber + 1, updatedAt: Date.now() });

    const invoiceId = await ctx.db.insert("invoices", {
      orgId: args.orgId,
      invoiceNumber,
      status: args.status,
      paymentMethod: args.paymentMethod,
      paymentReference: args.paymentReference?.trim() || undefined,
      customerName: args.customerName.trim(),
      customerPhone: args.customerPhone?.trim() || undefined,
      customerEmail: args.customerEmail?.trim() || undefined,
      customerAddress: args.customerAddress?.trim() || undefined,
      seller: {
        businessName: settings.businessName,
        address: settings.address,
        phone: settings.phone,
        email: settings.email,
        gstin: settings.gstin,
        terms: settings.terms,
        accentColor: settings.accentColor,
      },
      items: resolved.map(({ line, variant, product, lineTotalPaise }) => ({
        productSupabaseId: product.supabaseId,
        variantSupabaseId: variant.supabaseId,
        productName: product.name,
        variantName: variant.variantName,
        quantity: line.quantity,
        unitPricePaise: line.unitPricePaise,
        lineTotalPaise,
      })),
      subtotalPaise,
      discountPaise: args.discountPaise,
      taxRateBps: args.taxRateBps,
      taxPaise,
      totalPaise,
      notes: args.notes?.trim() || undefined,
      idempotencyKey: args.idempotencyKey,
      createdAt: Date.now(),
      createdBy: identity.subject,
    });

    for (const { line, variant } of resolved) {
      if (variant.trackInventory === false) continue;
      await changeInventory(ctx, {
        orgId: args.orgId,
        variant,
        onHandDelta: -line.quantity,
        type: "offline_sale",
        actor: `admin:${identity.subject}`,
        reference: { type: "invoice", id: invoiceId },
      });
    }
    await audit(ctx, {
      orgId: args.orgId,
      adminUserId: identity.subject,
      action: "invoice.create",
      targetType: "invoice",
      targetId: invoiceId,
      payload: { invoiceNumber, totalPaise, itemCount: resolved.length },
    });
    return { invoiceId, invoiceNumber, reused: false };
  },
});

export const voidInvoice = mutation({
  args: { invoiceId: v.id("invoices"), reason: v.string() },
  handler: async (ctx, { invoiceId, reason }) => {
    const invoice = await ctx.db.get(invoiceId);
    if (!invoice) throw new ConvexError({ code: "NOT_FOUND" });
    const { identity } = await requireOrgAdmin(ctx, invoice.orgId);
    if (invoice.status === "voided") return { voided: true };
    if (!reason.trim()) throw new ConvexError({ code: "VOID_REASON_REQUIRED" });
    const org = await ctx.db.get(invoice.orgId);
    if (!org) throw new ConvexError({ code: "ORG_NOT_FOUND" });
    for (const item of invoice.items) {
      const variant = await findOrgDocBySupabase(ctx, "catalogVariants", org, item.variantSupabaseId);
      if (!variant || !inOrg(variant, org) || variant.trackInventory === false) continue;
      await changeInventory(ctx, {
        orgId: invoice.orgId,
        variant,
        onHandDelta: item.quantity,
        type: "sale_reversal",
        actor: `admin:${identity.subject}`,
        reference: { type: "invoice", id: invoiceId, note: reason.trim() },
      });
    }
    await ctx.db.patch(invoiceId, {
      status: "voided",
      voidedAt: Date.now(),
      voidedBy: identity.subject,
      voidReason: reason.trim(),
    });
    await audit(ctx, {
      orgId: invoice.orgId,
      adminUserId: identity.subject,
      action: "invoice.void",
      targetType: "invoice",
      targetId: invoiceId,
      payload: { reason: reason.trim() },
    });
    return { voided: true };
  },
});
