import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import {
  collectInOrg,
  inOrg,
  requireOrgAdminBySlug,
  resolveOrg,
} from "./lib/org";

// ---------- Wave 7: commercial discounts (Supabase -> Convex) ----------
// ORG-SCOPED (codes unique per org). Writes gated on owner/admin of THAT org.
// Public reads (active list, code lookup) filter by the slug-resolved org.
// Money in RUPEES; dates as ms timestamps. Field names stay snake_case to
// match the shape the admin UI and checkout already speak.

async function findDiscountByCode(ctx: any, org: any, code: string) {
  const want = code.trim().toUpperCase();
  const scoped = await ctx.db
    .query("discounts")
    .withIndex("by_org_code", (q: any) =>
      q.eq("orgId", org._id).eq("code", want),
    )
    .unique();
  if (scoped) return scoped;
  // Legacy rows predate UPPER normalization: case-insensitive scan in-org.
  const rows = await collectInOrg(ctx, "discounts", org);
  return rows.find((d: any) => (d.code ?? "").toUpperCase() === want) ?? null;
}

// Admin list: ALL of this org's discounts, newest first.
export const listDiscountsForAdmin = query({
  args: { orgSlug: v.string() },
  handler: async (ctx, args) => {
    const { org } = await requireOrgAdminBySlug(ctx, args.orgSlug);
    const rows = await collectInOrg(ctx, "discounts", org);
    rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    return rows;
  },
});

// Storefront: active + within date window (null bounds = open).
export const listActiveDiscounts = query({
  args: { orgSlug: v.string() },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const now = Date.now();
    const rows = await collectInOrg(ctx, "discounts", org);
    return rows.filter(
      (d) =>
        d.is_active &&
        (d.start_date == null || d.start_date <= now) &&
        (d.end_date == null || d.end_date >= now),
    );
  },
});

// Coupon lookup: case-insensitive (admin form stores UPPER; old Supabase
// path compared lower-vs-upper and never matched). Validity (dates, usage)
// stays client-side so messages match the checkout's existing copy.
export const getDiscountByCode = query({
  args: { orgSlug: v.string(), code: v.string() },
  handler: async (ctx, { orgSlug, code }) => {
    const org = await resolveOrg(ctx, orgSlug);
    const want = code.trim().toUpperCase();
    if (!want) return null;
    return await findDiscountByCode(ctx, org, want);
  },
});

export const getDiscountForEdit = query({
  args: { orgSlug: v.string(), id: v.id("discounts") },
  handler: async (ctx, { orgSlug, id }) => {
    const { org } = await requireOrgAdminBySlug(ctx, orgSlug);
    const row = await ctx.db.get(id);
    if (!row || !inOrg(row as any, org)) return null;
    return row;
  },
});

const discountFields = {
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
  is_active: v.boolean(),
};

export const saveDiscount = mutation({
  args: { orgSlug: v.string(), id: v.optional(v.id("discounts")), ...discountFields },
  handler: async (ctx, { orgSlug, id, ...d }) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    const code = d.code?.trim() ? d.code.trim().toUpperCase() : undefined;
    if (code) {
      const clash = await findDiscountByCode(ctx, org, code);
      if (clash && clash._id !== id)
        throw new ConvexError({ code: "CODE_TAKEN", value: code });
    }
    const now = Date.now();
    // ponytail: patch drops undefined values on the wire, so spreads are safe.
    if (id) {
      const row = await ctx.db.get(id);
      if (!row || !inOrg(row as any, org)) throw new ConvexError({ code: "NOT_FOUND" });
      await ctx.db.patch(id, { ...d, code, orgId, updatedAt: now });
      return { id };
    }
    const newId = await ctx.db.insert("discounts", {
      ...d,
      code,
      orgId,
      usage_count: 0,
      createdAt: now,
      updatedAt: now,
    });
    return { id: newId };
  },
});

export const deleteDiscount = mutation({
  args: { orgSlug: v.string(), id: v.id("discounts") },
  handler: async (ctx, { orgSlug, id }) => {
    const { org } = await requireOrgAdminBySlug(ctx, orgSlug);
    const row = await ctx.db.get(id);
    if (!row || !inOrg(row as any, org)) throw new ConvexError({ code: "NOT_FOUND" });
    await ctx.db.delete(id);
    return { deleted: true };
  },
});

export const setDiscountsStatus = mutation({
  args: {
    orgSlug: v.string(),
    ids: v.array(v.id("discounts")),
    isActive: v.boolean(),
  },
  handler: async (ctx, { orgSlug, ids, isActive }) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    const now = Date.now();
    for (const id of ids) {
      const row = await ctx.db.get(id);
      if (!row || !inOrg(row as any, org)) continue;
      await ctx.db.patch(id, { is_active: isActive, orgId, updatedAt: now });
    }
    return { updated: ids.length };
  },
});
