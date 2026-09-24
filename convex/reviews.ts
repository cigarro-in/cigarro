import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireIdentity } from "./lib/auth";
import {
  collectInOrg,
  findOrgDocBySupabase,
  inOrg,
  requireOrgAdminBySlug,
  resolveOrg,
} from "./lib/org";

// ---------- Wave 10: product reviews, Convex-native ----------
// ORG-SCOPED, like catalog. Only approved rows are public. One review per
// user per product per org (submit upserts). Writes gated on owner/admin of
// THAT org for moderation; submit needs any identity. Products resolve inside
// the same org — never another tenant's catalog row.

const reviewShape = (r: any) => ({
  _id: r._id,
  productSupabaseId: r.productSupabaseId,
  userName: r.userName ?? "A customer",
  rating: r.rating,
  title: r.title,
  comment: r.comment,
  createdAt: r.createdAt,
});

async function orgReviewsByProduct(
  ctx: any,
  org: any,
  productSupabaseId: string,
): Promise<any[]> {
  const scoped = await ctx.db
    .query("productReviews")
    .withIndex("by_org_product", (q: any) =>
      q.eq("orgId", org._id).eq("productSupabaseId", productSupabaseId),
    )
    .order("desc")
    .collect();
  if (org.slug !== "smokeshop") return scoped;
  const legacy = await ctx.db
    .query("productReviews")
    .withIndex("by_product", (q: any) =>
      q.eq("productSupabaseId", productSupabaseId),
    )
    .order("desc")
    .collect();
  const seen = new Set(scoped.map((r: any) => r._id));
  return [
    ...scoped,
    ...legacy.filter((r: any) => r.orgId == null && !seen.has(r._id)),
  ].sort((a: any, b: any) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

async function orgReviewsByUser(
  ctx: any,
  org: any,
  userId: string,
): Promise<any[]> {
  const scoped = await ctx.db
    .query("productReviews")
    .withIndex("by_org_user_product", (q: any) =>
      q.eq("orgId", org._id).eq("userId", userId),
    )
    .order("desc")
    .take(100);
  if (org.slug !== "smokeshop") return scoped;
  const legacy = await ctx.db
    .query("productReviews")
    .withIndex("by_user_product", (q: any) => q.eq("userId", userId))
    .order("desc")
    .take(100);
  const seen = new Set(scoped.map((r: any) => r._id));
  return [...scoped, ...legacy.filter((r: any) => r.orgId == null && !seen.has(r._id))]
    .sort((a: any, b: any) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .slice(0, 100);
}

// Public: approved reviews + aggregate for a PDP.
export const listProductReviews = query({
  args: {
    orgSlug: v.string(),
    productSupabaseId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { orgSlug, productSupabaseId, limit }) => {
    const org = await resolveOrg(ctx, orgSlug);
    const rows = (await orgReviewsByProduct(ctx, org, productSupabaseId)).slice(
      0,
      limit ?? 50,
    );
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

// My reviews (account page). Subject-scoped + org-scoped.
export const listMyReviews = query({
  args: { orgSlug: v.string() },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const identity = await requireIdentity(ctx);
    const rows = await orgReviewsByUser(ctx, org, identity.subject);
    const products = await collectInOrg(ctx, "catalogProducts", org);
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
    orgSlug: v.string(),
    productSupabaseId: v.string(),
    rating: v.number(),
    title: v.optional(v.string()),
    comment: v.optional(v.string()),
    userName: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const org = await resolveOrg(ctx, a.orgSlug);
    const identity = await requireIdentity(ctx);
    if (!Number.isFinite(a.rating) || a.rating < 1 || a.rating > 5)
      throw new ConvexError({ code: "BAD_RATING" });
    const product = await findOrgDocBySupabase(
      ctx,
      "catalogProducts",
      org,
      a.productSupabaseId,
    );
    if (!product || !inOrg(product, org))
      throw new ConvexError({ code: "PRODUCT_NOT_FOUND" });
    const existing = await ctx.db
      .query("productReviews")
      .withIndex("by_org_user_product", (q) =>
        q
          .eq("orgId", org._id)
          .eq("userId", identity.subject)
          .eq("productSupabaseId", a.productSupabaseId),
      )
      .unique();
    const legacy =
      !existing && org.slug === "smokeshop"
        ? await ctx.db
            .query("productReviews")
            .withIndex("by_user_product", (q) =>
              q
                .eq("userId", identity.subject)
                .eq("productSupabaseId", a.productSupabaseId),
            )
            .unique()
        : null;
    const found =
      existing ?? (legacy && legacy.orgId == null ? legacy : null);
    const now = Date.now();
    const patch = {
      rating: Math.round(a.rating),
      title: a.title?.trim() || undefined,
      comment: a.comment?.trim() || undefined,
      userName: a.userName?.trim() || undefined,
      updatedAt: now,
    };
    if (found) {
      // Re-submits go back through moderation.
      await ctx.db.patch(found._id, {
        ...patch,
        orgId: org._id,
        isApproved: false,
      });
      return { id: found._id, pending: true };
    }
    const id = await ctx.db.insert("productReviews", {
      orgId: org._id,
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

// Owner-composed review (e.g. transcribing phone/WhatsApp feedback).
// Goes live immediately — the author IS the moderator. userName defaults
// to "Cigarro Team": attribute honestly, never as a fake customer.
export const createReview = mutation({
  args: {
    orgSlug: v.string(),
    productSupabaseId: v.string(),
    rating: v.number(),
    title: v.optional(v.string()),
    comment: v.optional(v.string()),
    userName: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const { org, identity } = await requireOrgAdminBySlug(ctx, a.orgSlug);
    if (!Number.isFinite(a.rating) || a.rating < 1 || a.rating > 5)
      throw new ConvexError({ code: "BAD_RATING" });
    const product = await findOrgDocBySupabase(
      ctx,
      "catalogProducts",
      org,
      a.productSupabaseId,
    );
    if (!product || !inOrg(product, org))
      throw new ConvexError({ code: "PRODUCT_NOT_FOUND" });
    const now = Date.now();
    const id = await ctx.db.insert("productReviews", {
      orgId: org._id,
      productSupabaseId: a.productSupabaseId,
      userId: identity.subject,
      rating: Math.round(a.rating),
      title: a.title?.trim() || undefined,
      comment: a.comment?.trim() || undefined,
      userName: a.userName?.trim() || "Cigarro Team",
      isApproved: true,
      createdAt: now,
      updatedAt: now,
    });
    await syncProductAggregate(ctx, org, a.productSupabaseId);
    return { id };
  },
});

export const listReviewsForAdmin = query({
  args: { orgSlug: v.string(), approved: v.optional(v.boolean()) },
  handler: async (ctx, { orgSlug, approved }) => {
    const { org } = await requireOrgAdminBySlug(ctx, orgSlug);
    const rows = await collectInOrg(ctx, "productReviews", org);
    rows.sort((a: any, b: any) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    const products = await collectInOrg(ctx, "catalogProducts", org);
    const bySupabaseId = new Map(products.map((p) => [p.supabaseId, p]));
    return rows
      .filter((r) => (approved === undefined ? true : r.isApproved === approved))
      .slice(0, 500)
      .map((r) => ({
        ...reviewShape(r),
        isApproved: r.isApproved,
        productName: bySupabaseId.get(r.productSupabaseId)?.name ?? r.productSupabaseId,
      }));
  },
});

// Bot prerender + GSC read ratingValue/reviewCount off the catalog row
// (not the reviews table), so every moderation write re-syncs them.
// Zero approved = count 0, and aggregateRating stays omitted.
async function syncProductAggregate(ctx: any, org: any, productSupabaseId: string) {
  const rows = await orgReviewsByProduct(ctx, org, productSupabaseId);
  const approved = rows.filter((r: any) => r.isApproved);
  const product = await findOrgDocBySupabase(
    ctx,
    "catalogProducts",
    org,
    productSupabaseId,
  );
  if (!product || !inOrg(product, org)) return;
  await ctx.db.patch(product._id, {
    reviewCount: approved.length,
    ratingValue:
      approved.length > 0
        ? Math.round((approved.reduce((s: number, r: any) => s + r.rating, 0) / approved.length) * 10) / 10
        : undefined,
    orgId: org._id,
    updatedAt: Date.now(),
  });
}

export const setReviewApproved = mutation({
  args: { orgSlug: v.string(), id: v.id("productReviews"), isApproved: v.boolean() },
  handler: async (ctx, { orgSlug, id, isApproved }) => {
    const { org } = await requireOrgAdminBySlug(ctx, orgSlug);
    const row = await ctx.db.get(id);
    if (!row || !inOrg(row as any, org)) throw new ConvexError({ code: "NOT_FOUND" });
    await ctx.db.patch(id, { isApproved, orgId: org._id, updatedAt: Date.now() });
    await syncProductAggregate(ctx, org, row.productSupabaseId);
    return { ok: true };
  },
});

export const deleteReview = mutation({
  args: { orgSlug: v.string(), id: v.id("productReviews") },
  handler: async (ctx, { orgSlug, id }) => {
    const { org } = await requireOrgAdminBySlug(ctx, orgSlug);
    const row = await ctx.db.get(id);
    if (!row || !inOrg(row as any, org)) throw new ConvexError({ code: "NOT_FOUND" });
    await ctx.db.delete(id);
    await syncProductAggregate(ctx, org, row.productSupabaseId);
    return { ok: true };
  },
});
