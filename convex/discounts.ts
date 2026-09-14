import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireIdentity } from "./lib/auth";

// ---------- Wave 7: commercial discounts (Supabase -> Convex) ----------
// GLOBAL table (no orgId), like catalog. Writes gated on owner/admin of ANY
// org. Reads stay public (Supabase RLS likewise allowed public reads).
// Money in RUPEES; dates as ms timestamps. Field names stay snake_case to
// match the shape the admin UI and checkout already speak.

async function requireDiscountAdmin(ctx: any) {
  const identity = await requireIdentity(ctx);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
    .filter((q: any) =>
      q.or(q.eq(q.field("role"), "owner"), q.eq(q.field("role"), "admin")),
    )
    .first();
  if (!membership) throw new ConvexError({ code: "NOT_DISCOUNT_ADMIN" });
  return identity;
}

// Admin list: ALL discounts, newest first.
export const listDiscountsForAdmin = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("discounts").collect();
    rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    return rows;
  },
});

// Storefront: active + within date window (null bounds = open).
export const listActiveDiscounts = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db.query("discounts").collect();
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
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const want = code.trim().toUpperCase();
    if (!want) return null;
    const rows = await ctx.db.query("discounts").collect();
    return rows.find((d) => (d.code ?? "").toUpperCase() === want) ?? null;
  },
});

export const getDiscountForEdit = query({
  args: { id: v.id("discounts") },
  handler: async (ctx, { id }) => ctx.db.get(id),
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
  args: { id: v.optional(v.id("discounts")), ...discountFields },
  handler: async (ctx, { id, ...d }) => {
    await requireDiscountAdmin(ctx);
    const code = d.code?.trim() ? d.code.trim().toUpperCase() : undefined;
    if (code) {
      const clash = await ctx.db
        .query("discounts")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique();
      if (clash && clash._id !== id) throw new ConvexError({ code: "CODE_TAKEN", value: code });
    }
    const now = Date.now();
    // ponytail: patch drops undefined values on the wire, so spreads are safe.
    if (id) {
      const row = await ctx.db.get(id);
      if (!row) throw new ConvexError({ code: "NOT_FOUND" });
      await ctx.db.patch(id, { ...d, code, updatedAt: now });
      return { id };
    }
    const newId = await ctx.db.insert("discounts", {
      ...d,
      code,
      usage_count: 0,
      createdAt: now,
      updatedAt: now,
    });
    return { id: newId };
  },
});

export const deleteDiscount = mutation({
  args: { id: v.id("discounts") },
  handler: async (ctx, { id }) => {
    await requireDiscountAdmin(ctx);
    await ctx.db.delete(id);
    return { deleted: true };
  },
});

export const setDiscountsStatus = mutation({
  args: { ids: v.array(v.id("discounts")), isActive: v.boolean() },
  handler: async (ctx, { ids, isActive }) => {
    await requireDiscountAdmin(ctx);
    const now = Date.now();
    for (const id of ids) {
      const row = await ctx.db.get(id);
      if (!row) continue;
      await ctx.db.patch(id, { is_active: isActive, updatedAt: now });
    }
    return { updated: ids.length };
  },
});

// Coupon accounting, best-effort fire-and-forget from checkout. (The old
// Supabase path called supabase.raw — which doesn't exist — so usage_count
// never moved; anything here is strictly better.)
export const registerUse = mutation({
  args: { id: v.id("discounts") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (!row) return { ok: false };
    await ctx.db.patch(id, {
      usage_count: row.usage_count + 1,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});
