import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireOrgAdmin } from "./lib/auth";

// Normalize Indian mobile to wa.me digits: "9188XXXXXXXX".
// Accepts "+91-8892476825", "08892476825", "8892476825", "918892476825".
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  let d = digits;
  if (d.length === 12 && d.startsWith("91")) return d;
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10 && /^[6-9]/.test(d)) return `91${d}`;
  return null;
}

const contactV = v.object({
  phone: v.string(),
  name: v.optional(v.string()),
  city: v.optional(v.string()),
  email: v.optional(v.string()),
  totalOrders: v.optional(v.number()),
  totalSalesPaise: v.optional(v.number()),
});

// ---------- Contacts ----------

export const upsertContacts = mutation({
  args: {
    orgId: v.id("organizations"),
    source: v.optional(v.string()),
    contacts: v.array(contactV),
  },
  handler: async (ctx, { orgId, source, contacts }) => {
    const { identity } = await requireOrgAdmin(ctx, orgId);
    if (contacts.length > 500)
      throw new ConvexError({ code: "BATCH_TOO_LARGE", max: 500 });
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    for (const c of contacts) {
      const phone = normalizePhone(c.phone);
      if (!phone) {
        skipped++;
        continue;
      }
      const existing = await ctx.db
        .query("marketingContacts")
        .withIndex("by_org_phone", (q) => q.eq("orgId", orgId).eq("phone", phone))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          name: c.name ?? existing.name,
          city: c.city ?? existing.city,
          email: c.email ?? existing.email,
          source: source ?? existing.source,
          totalOrders: c.totalOrders ?? existing.totalOrders,
          totalSalesPaise: c.totalSalesPaise ?? existing.totalSalesPaise,
        });
        updated++;
      } else {
        await ctx.db.insert("marketingContacts", {
          orgId,
          phone,
          name: c.name,
          city: c.city,
          email: c.email,
          source,
          totalOrders: c.totalOrders,
          totalSalesPaise: c.totalSalesPaise,
          createdAt: Date.now(),
        });
        inserted++;
      }
    }
    void identity;
    return { inserted, updated, skipped };
  },
});

export const countContacts = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireOrgAdmin(ctx, orgId);
    const rows = await ctx.db
      .query("marketingContacts")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return rows.length;
  },
});

export const listContacts = query({
  args: {
    orgId: v.id("organizations"),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { orgId, search, limit }) => {
    await requireOrgAdmin(ctx, orgId);
    const rows = await ctx.db
      .query("marketingContacts")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(limit ?? 2000);
    const s = search?.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.phone.includes(s) ||
        r.name?.toLowerCase().includes(s) ||
        r.city?.toLowerCase().includes(s),
    );
  },
});

// ---------- Campaigns ----------

export const listCampaigns = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireOrgAdmin(ctx, orgId);
    return await ctx.db
      .query("marketingCampaigns")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .collect();
  },
});

export const createCampaign = mutation({
  args: {
    orgId: v.id("organizations"),
    name: v.string(),
    message: v.string(),
    templateId: v.optional(v.id("marketingTemplates")),
    couponCode: v.optional(v.string()),
    discountId: v.optional(v.id("discounts")),
  },
  handler: async (ctx, { orgId, name, message, templateId, couponCode, discountId }) => {
    const { identity } = await requireOrgAdmin(ctx, orgId);
    if (!name.trim() || !message.trim())
      throw new ConvexError({ code: "EMPTY_CAMPAIGN" });
    return await ctx.db.insert("marketingCampaigns", {
      orgId,
      name: name.trim(),
      message,
      templateId,
      couponCode: couponCode?.trim().toUpperCase() || undefined,
      discountId,
      createdAt: Date.now(),
      createdBy: identity.subject,
      sentCount: 0,
    });
  },
});

export const updateCampaign = mutation({
  args: {
    campaignId: v.id("marketingCampaigns"),
    name: v.string(),
    message: v.string(),
  },
  handler: async (ctx, { campaignId, name, message }) => {
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) throw new ConvexError({ code: "NOT_FOUND" });
    await requireOrgAdmin(ctx, campaign.orgId);
    await ctx.db.patch(campaignId, { name: name.trim(), message });
  },
});

// ---------- Sends (deeplink opens, idempotent per campaign+contact) ----------

export const recordSend = mutation({
  args: {
    campaignId: v.id("marketingCampaigns"),
    contactId: v.id("marketingContacts"),
  },
  handler: async (ctx, { campaignId, contactId }) => {
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) throw new ConvexError({ code: "NOT_FOUND" });
    const { identity } = await requireOrgAdmin(ctx, campaign.orgId);
    const contact = await ctx.db.get(contactId);
    if (!contact || contact.orgId !== campaign.orgId)
      throw new ConvexError({ code: "CONTACT_NOT_FOUND" });
    const existing = await ctx.db
      .query("marketingSends")
      .withIndex("by_campaign_contact", (q) =>
        q.eq("campaignId", campaignId).eq("contactId", contactId),
      )
      .unique();
    if (existing) return { deduped: true };
    await ctx.db.insert("marketingSends", {
      orgId: campaign.orgId,
      campaignId,
      contactId,
      phone: contact.phone,
      sentAt: Date.now(),
      sentBy: identity.subject,
    });
    await ctx.db.patch(campaignId, { sentCount: campaign.sentCount + 1 });
    return { deduped: false };
  },
});

export const sentContactIds = query({
  args: { campaignId: v.id("marketingCampaigns") },
  handler: async (ctx, { campaignId }) => {
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) throw new ConvexError({ code: "NOT_FOUND" });
    await requireOrgAdmin(ctx, campaign.orgId);
    const rows = await ctx.db
      .query("marketingSends")
      .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
      .collect();
    return rows.map((r) => r.contactId);
  },
});

// ---------- Templates (reusable copy) ----------

export const listTemplates = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireOrgAdmin(ctx, orgId);
    return await ctx.db
      .query("marketingTemplates")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .collect();
  },
});

export const createTemplate = mutation({
  args: { orgId: v.id("organizations"), name: v.string(), message: v.string() },
  handler: async (ctx, { orgId, name, message }) => {
    const { identity } = await requireOrgAdmin(ctx, orgId);
    if (!name.trim() || !message.trim())
      throw new ConvexError({ code: "EMPTY_TEMPLATE" });
    return await ctx.db.insert("marketingTemplates", {
      orgId,
      name: name.trim(),
      message,
      createdAt: Date.now(),
      createdBy: identity.subject,
    });
  },
});

export const updateTemplate = mutation({
  args: { templateId: v.id("marketingTemplates"), name: v.string(), message: v.string() },
  handler: async (ctx, { templateId, name, message }) => {
    const t = await ctx.db.get(templateId);
    if (!t) throw new ConvexError({ code: "NOT_FOUND" });
    await requireOrgAdmin(ctx, t.orgId);
    await ctx.db.patch(templateId, { name: name.trim(), message });
  },
});

export const deleteTemplate = mutation({
  args: { templateId: v.id("marketingTemplates") },
  handler: async (ctx, { templateId }) => {
    const t = await ctx.db.get(templateId);
    if (!t) throw new ConvexError({ code: "NOT_FOUND" });
    await requireOrgAdmin(ctx, t.orgId);
    await ctx.db.delete(templateId);
  },
});

// ---------- Stats: sent · clicks · orders · revenue ----------

export const campaignStats = query({
  args: { campaignId: v.id("marketingCampaigns") },
  handler: async (ctx, { campaignId }) => {
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) throw new ConvexError({ code: "NOT_FOUND" });
    await requireOrgAdmin(ctx, campaign.orgId);
    const clicks = await ctx.db
      .query("marketingClicks")
      .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
      .collect();
    let orders = 0;
    let revenuePaise = 0;
    if (campaign.discountId) {
      // Bounded scan of paid orders; volume is small (hundreds).
      for (const status of ["paid", "late_paid"] as const) {
        const rows = await ctx.db
          .query("orders")
          .withIndex("by_org_status", (q) =>
            q.eq("orgId", campaign.orgId).eq("status", status),
          )
          .take(5000);
        for (const o of rows) {
          if (o.discountId === campaign.discountId) {
            orders++;
            revenuePaise += o.cartTotalPaise;
          }
        }
      }
    }
    return {
      sent: campaign.sentCount,
      clicks: clicks.length,
      uniqueClicks: new Set(clicks.map((c) => String(c.contactId))).size,
      orders,
      revenuePaise,
    };
  },
});

// ---------- Click logging (called by the public /m redirect, no auth —
// the campaign+contact id pair is the unguessable capability) ----------

export const logClick = internalMutation({
  args: {
    campaignId: v.id("marketingCampaigns"),
    contactId: v.id("marketingContacts"),
  },
  handler: async (ctx, { campaignId, contactId }) => {
    const campaign = await ctx.db.get(campaignId);
    const contact = await ctx.db.get(contactId);
    if (!campaign || !contact || contact.orgId !== campaign.orgId) return null;
    await ctx.db.insert("marketingClicks", {
      orgId: campaign.orgId,
      campaignId,
      contactId,
      clickedAt: Date.now(),
    });
    return { orgId: campaign.orgId, campaignName: campaign.name };
  },
});
