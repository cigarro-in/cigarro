import { query } from "./_generated/server";
import { v } from "convex/values";

// ---------- Wave 2: content reads (Supabase -> Convex) ----------
// Content is GLOBAL and public: no orgId, no requireMember. These queries
// back the blog, homepage heroes/config, and site settings. Catalog
// PRODUCTS stay on Supabase until Wave 3 (byte-diff gates).

const postShape = (p: any) => ({
  _id: p._id,
  slug: p.slug,
  title: p.title,
  excerpt: p.excerpt,
  content: p.content,
  featuredImage: p.featuredImage ?? null,
  status: p.status,
  authorName: p.authorName,
  categorySlug: p.categorySlug,
  readingTime: p.readingTime,
  metaTitle: p.metaTitle,
  metaDescription: p.metaDescription,
  ogTitle: p.ogTitle,
  ogDescription: p.ogDescription,
  ogImage: p.ogImage,
  canonicalUrl: p.canonicalUrl,
  isFeatured: p.isFeatured,
  isPinned: p.isPinned,
  likeCount: p.likeCount,
  viewCount: p.viewCount,
  publishedAt: p.publishedAt,
  updatedAt: p.updatedAt,
});

export const listBlogPosts = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("blogPosts")
      .withIndex("by_status_published", (q) =>
        q.eq("status", "published"),
      )
      .order("desc")
      .take(args.limit ?? 50);
    const cats = await ctx.db.query("blogCategories").collect();
    const catBySlug = new Map(cats.map((c) => [c.slug, c]));
    return rows.map((p) => ({
      ...postShape(p),
      categoryName: p.categorySlug ? (catBySlug.get(p.categorySlug)?.name ?? p.categorySlug) : null,
      categoryColor: p.categorySlug ? (catBySlug.get(p.categorySlug)?.color ?? null) : null,
    }));
  },
});

export const getBlogPostBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("blogPosts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!row || row.status !== "published") return null;
    return postShape(row);
  },
});

export const listRelatedPosts = query({
  args: {
    categorySlug: v.optional(v.string()),
    excludeSlug: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // by_category_status is [categorySlug, status, publishedAt]: Convex
    // requires equality on the leading index field, so the no-category
    // case must use by_status_published (never query an index without
    // its leading field — it throws and trips the app ErrorBoundary).
    const limit = (args.limit ?? 3) + 1;
    const rows = args.categorySlug
      ? await ctx.db
          .query("blogPosts")
          .withIndex("by_category_status", (q) =>
            q.eq("categorySlug", args.categorySlug).eq("status", "published"),
          )
          .order("desc")
          .take(limit)
      : await ctx.db
          .query("blogPosts")
          .withIndex("by_status_published", (q) =>
            q.eq("status", "published"),
          )
          .order("desc")
          .take(limit);
    return rows
      .filter((r) => r.slug !== args.excludeSlug)
      .slice(0, args.limit ?? 3)
      .map(postShape);
  },
});

export const listBlogCategories = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("blogCategories")
      .withIndex("by_active_sort", (q) => q.eq("isActive", true))
      .collect();
    return rows.map((c) => ({
      _id: c._id,
      slug: c.slug,
      name: c.name,
      color: c.color,
      description: c.description,
      sortOrder: c.sortOrder,
    }));
  },
});

export const listHeroSlides = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("heroSlides")
      .withIndex("by_active_sort", (q) => q.eq("isActive", true))
      .collect();
    return rows.map((s) => ({
      _id: s._id,
      title: s.title,
      subtitle: s.subtitle,
      suptitle: s.suptitle,
      description: s.description,
      buttonText: s.buttonText,
      buttonUrl: s.buttonUrl,
      buttonStyle: s.buttonStyle,
      imageUrl: s.imageUrl,
      mobileImageUrl: s.mobileImageUrl,
      productImageUrl: s.productImageUrl,
      productName: s.productName,
      productPrice: s.productPrice,
      smallImageUrl: s.smallImageUrl,
      overlayOpacity: s.overlayOpacity,
      textColor: s.textColor,
      textPosition: s.textPosition,
      sortOrder: s.sortOrder,
    }));
  },
});

export const getSectionConfig = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("sectionConfigurations")
      .withIndex("by_name", (q) => q.eq("sectionName", args.name))
      .unique();
    if (!row) return null;
    return {
      sectionName: row.sectionName,
      title: row.title,
      subtitle: row.subtitle,
      description: row.description,
      backgroundImage: row.backgroundImage,
      buttonText: row.buttonText,
      buttonUrl: row.buttonUrl,
      config: row.config,
      maxItems: row.maxItems,
      isEnabled: row.isEnabled,
    };
  },
});

export const listHomepageComponents = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("homepageComponentConfig")
      .withIndex("by_order")
      .collect();
    return rows.map((c) => ({
      componentName: c.componentName,
      config: c.config,
      isEnabled: c.isEnabled,
      displayOrder: c.displayOrder,
      sectionId: c.sectionId,
    }));
  },
});

export const getSiteSettings = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("siteSettings")
      .withIndex("by_key", (q) => q.eq("key", "main"))
      .unique();
    if (!row) return null;
    return {
      siteName: row.siteName,
      metaTitle: row.metaTitle,
      metaDescription: row.metaDescription,
      faviconUrl: row.faviconUrl,
      activeTheme: row.activeTheme,
      upiId: row.upiId,
      shippingConfig: row.shippingConfig ?? null,
      updatedAt: row.updatedAt,
    };
  },
});

// Wave-2 verification passed on DEV and PROD (blogs + homepage read from
// Convex): the temporary backfill mutation is deleted. Queries above are
// the stable surface. NOTE: code auto-deploys to PROD on push, but DATA
// never syncs — backfills must run per deployment (drivers in Temp).
