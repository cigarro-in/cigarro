import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireIdentity } from "./lib/auth";

// ---------- Wave 10: product reviews, Convex-native ----------
// GLOBAL table (no orgId), like catalog. Only approved rows are public.
// One review per user per product (submit upserts). Writes gated on
// owner/admin of ANY org for moderation; submit needs any identity.

async function requireReviewsAdmin(ctx: any) {
  const identity = await requireIdentity(ctx);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
    .filter((q: any) =>
      q.or(q.eq(q.field("role"), "owner"), q.eq(q.field("role"), "admin")),
    )
    .first();
  if (!membership) throw new ConvexError({ code: "NOT_REVIEWS_ADMIN" });
  return identity;
}

const reviewShape = (r: any) => ({
  _id: r._id,
  productSupabaseId: r.productSupabaseId,
  userName: r.userName ?? "A customer",
  rating: r.rating,
  title: r.title,
  comment: r.comment,
  createdAt: r.createdAt,
});

// Public: approved reviews + aggregate for a PDP.
export const listProductReviews = query({
  args: { productSupabaseId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { productSupabaseId, limit }) => {
    const rows = await ctx.db
      .query("productReviews")
      .withIndex("by_product", (q) => q.eq("productSupabaseId", productSupabaseId))
      .order("desc")
      .take(limit ?? 50);
    const approved = rows.filter((r) => r.isApproved);
    const count = approved.length;
    const average =
      count > 0 ? approved.reduce((s, r) => s + r.rating, 0) / count : 0;
    return {
      reviews: approved.map(reviewShape),
      count,
      average: Math.round(average * 10) / 10,
    };
  },
});

// My reviews (account page). Subject-scoped.
export const listMyReviews = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const rows = await ctx.db
      .query("productReviews")
      .withIndex("by_user_product", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(100);
    const products = await ctx.db.query("catalogProducts").collect();
    const bySupabaseId = new Map(products.map((p) => [p.supabaseId, p]));
    return rows.map((r) => {
      const p = bySupabaseId.get(r.productSupabaseId);
      return {
        ...reviewShape(r),
        isApproved: r.isApproved,
        product: p
          ? { name: p.name, slug: p.slug }
          : { name: "Product", slug: "" },
      };
    });
  },
});

// Submit (or update) my review. Starts unapproved — moderation keeps
// service-proof trustworthy (founder verdict: reviews-as-proof OK).
export const submitReview = mutation({
  args: {
    productSupabaseId: v.string(),
    rating: v.number(),
    title: v.optional(v.string()),
    comment: v.optional(v.string()),
    userName: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const identity = await requireIdentity(ctx);
    if (!Number.isFinite(a.rating) || a.rating < 1 || a.rating > 5)
      throw new ConvexError({ code: "BAD_RATING" });
    const existing = await ctx.db
      .query("productReviews")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", identity.subject).eq("productSupabaseId", a.productSupabaseId),
      )
      .unique();
    const now = Date.now();
    const patch = {
      rating: Math.round(a.rating),
      title: a.title?.trim() || undefined,
      comment: a.comment?.trim() || undefined,
      userName: a.userName?.trim() || undefined,
      updatedAt: now,
    };
    if (existing) {
      // Re-submits go back through moderation.
      await ctx.db.patch(existing._id, { ...patch, isApproved: false });
      return { id: existing._id, pending: true };
    }
    const id = await ctx.db.insert("productReviews", {
      productSupabaseId: a.productSupabaseId,
      userId: identity.subject,
      ...patch,
      isApproved: false,
      createdAt: now,
    });
    return { id, pending: true };
  },
});

// ---------- Admin moderation ----------

export const listReviewsForAdmin = query({
  args: { approved: v.optional(v.boolean()) },
  handler: async (ctx, { approved }) => {
    const rows = await ctx.db.query("productReviews").order("desc").take(500);
    const products = await ctx.db.query("catalogProducts").collect();
    const bySupabaseId = new Map(products.map((p) => [p.supabaseId, p]));
    return rows
      .filter((r) => (approved === undefined ? true : r.isApproved === approved))
      .map((r) => ({
        ...reviewShape(r),
        isApproved: r.isApproved,
        productName: bySupabaseId.get(r.productSupabaseId)?.name ?? r.productSupabaseId,
      }));
  },
});

export const setReviewApproved = mutation({
  args: { id: v.id("productReviews"), isApproved: v.boolean() },
  handler: async (ctx, { id, isApproved }) => {
    await requireReviewsAdmin(ctx);
    const row = await ctx.db.get(id);
    if (!row) throw new ConvexError({ code: "NOT_FOUND" });
    await ctx.db.patch(id, { isApproved, updatedAt: Date.now() });
    return { ok: true };
  },
});

export const deleteReview = mutation({
  args: { id: v.id("productReviews") },
  handler: async (ctx, { id }) => {
    await requireReviewsAdmin(ctx);
    await ctx.db.delete(id);
    return { deleted: true };
  },
});
