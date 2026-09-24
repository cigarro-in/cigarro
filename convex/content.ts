import { query } from "./_generated/server";
import { v } from "convex/values";
import { collectInOrg, inOrg, resolveOrg } from "./lib/org";

// ---------- Wave 2: content reads (Supabase -> Convex) ----------
// Content is ORG-SCOPED and public: every query takes the storefront orgSlug,
// resolves it via organizations by_slug, and returns only that org's rows.
// Pre-backfill rows (no orgId) read as the legacy smokeshop org's rows.

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

const byPublishedDesc = (a: any, b: any) =>
  (b.publishedAt ?? 0) - (a.publishedAt ?? 0);

async function orgPostsByStatus(
  ctx: any,
  org: any,
  status: string,
  limit: number,
): Promise<any[]> {
  const scoped = await ctx.db
    .query("blogPosts")
    .withIndex("by_org_status", (q: any) =>
      q.eq("orgId", org._id).eq("status", status),
    )
    .order("desc")
    .take(limit);
  if (org.slug !== "smokeshop") return scoped;
  const legacy = await ctx.db
    .query("blogPosts")
    .withIndex("by_status_published", (q: any) => q.eq("status", status))
    .order("desc")
    .take(limit);
  const seen = new Set(scoped.map((r: any) => r._id));
  return [
    ...scoped,
    ...legacy.filter((r: any) => r.orgId == null && !seen.has(r._id)),
  ]
    .sort(byPublishedDesc)
    .slice(0, limit);
}

export const listBlogPosts = query({
  args: { orgSlug: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const rows = await orgPostsByStatus(ctx, org, "published", args.limit ?? 50);
    const cats = await collectInOrg(ctx, "blogCategories", org);
    const catBySlug = new Map(cats.map((c) => [c.slug, c]));
    return rows.map((p) => ({
      ...postShape(p),
      categoryName: p.categorySlug ? (catBySlug.get(p.categorySlug)?.name ?? p.categorySlug) : null,
      categoryColor: p.categorySlug ? (catBySlug.get(p.categorySlug)?.color ?? null) : null,
    }));
  },
});

export const getBlogPostBySlug = query({
  args: { orgSlug: v.string(), slug: v.string() },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const row = await ctx.db
      .query("blogPosts")
      .withIndex("by_org_slug", (q) =>
        q.eq("orgId", org._id).eq("slug", args.slug),
      )
      .unique();
    const legacy =
      !row && org.slug === "smokeshop"
        ? (
            await ctx.db
              .query("blogPosts")
              .withIndex("by_slug", (q) => q.eq("slug", args.slug))
              .collect()
          ).find((r: any) => r.orgId == null) ?? null
        : null;
    const found = row ?? legacy;
    if (!found || found.status !== "published") return null;
    return postShape(found);
  },
});

export const listRelatedPosts = query({
  args: {
    orgSlug: v.string(),
    categorySlug: v.optional(v.string()),
    excludeSlug: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    // by_org_category is [orgId, categorySlug, status, publishedAt]: Convex
    // requires equality on the leading index fields, so the no-category
    // case must use by_org_status (never query an index without its leading
    // field — it throws and trips the app ErrorBoundary).
    const limit = (args.limit ?? 3) + 1;
    const scoped = args.categorySlug
      ? await ctx.db
          .query("blogPosts")
          .withIndex("by_org_category", (q) =>
            q
              .eq("orgId", org._id)
              .eq("categorySlug", args.categorySlug)
              .eq("status", "published"),
          )
          .order("desc")
          .take(limit)
      : await ctx.db
          .query("blogPosts")
          .withIndex("by_org_status", (q) =>
            q.eq("orgId", org._id).eq("status", "published"),
          )
          .order("desc")
          .take(limit);
    let rows = scoped;
    if (org.slug === "smokeshop") {
      const legacy = args.categorySlug
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
      const seen = new Set(scoped.map((r: any) => r._id));
      rows = [
        ...scoped,
        ...legacy.filter((r: any) => r.orgId == null && !seen.has(r._id)),
      ]
        .sort(byPublishedDesc)
        .slice(0, limit);
    }
    return rows
      .filter((r) => r.slug !== args.excludeSlug)
      .slice(0, args.limit ?? 3)
      .map(postShape);
  },
});

export const listBlogCategories = query({
  args: { orgSlug: v.string() },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const rows = (await collectInOrg(ctx, "blogCategories", org)).filter(
      (c: any) => c.isActive,
    );
    rows.sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
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
  args: { orgSlug: v.string() },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const rows = (await collectInOrg(ctx, "heroSlides", org)).filter(
      (s: any) => s.isActive,
    );
    rows.sort((a: any, b: any) => a.sortOrder - b.sortOrder);
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
  args: { orgSlug: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const row = await ctx.db
      .query("sectionConfigurations")
      .withIndex("by_org_name", (q) =>
        q.eq("orgId", org._id).eq("sectionName", args.name),
      )
      .unique();
    const legacy =
      !row && org.slug === "smokeshop"
        ? (
            await ctx.db
              .query("sectionConfigurations")
              .withIndex("by_name", (q) => q.eq("sectionName", args.name))
              .collect()
          ).find((r: any) => r.orgId == null) ?? null
        : null;
    const found = row ?? legacy;
    if (!found || !inOrg(found, org)) return null;
    return {
      sectionName: found.sectionName,
      title: found.title,
      subtitle: found.subtitle,
      description: found.description,
      backgroundImage: found.backgroundImage,
      buttonText: found.buttonText,
      buttonUrl: found.buttonUrl,
      config: found.config,
      maxItems: found.maxItems,
      isEnabled: found.isEnabled,
    };
  },
});

export const listHomepageComponents = query({
  args: { orgSlug: v.string() },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const rows = await collectInOrg(ctx, "homepageComponentConfig", org);
    rows.sort((a: any, b: any) => a.displayOrder - b.displayOrder);
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
  args: { orgSlug: v.string() },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const row = await ctx.db
      .query("siteSettings")
      .withIndex("by_org_key", (q) =>
        q.eq("orgId", org._id).eq("key", "main"),
      )
      .unique();
    const legacy =
      !row && org.slug === "smokeshop"
        ? (
            await ctx.db
              .query("siteSettings")
              .withIndex("by_key", (q) => q.eq("key", "main"))
              .collect()
          ).find((r: any) => r.orgId == null) ?? null
        : null;
    const found = row ?? legacy;
    if (!found) return null;
    return {
      siteName: found.siteName,
      metaTitle: found.metaTitle,
      metaDescription: found.metaDescription,
      faviconUrl: found.faviconUrl,
      activeTheme: found.activeTheme,
      upiId: found.upiId,
      shippingConfig: found.shippingConfig ?? null,
      updatedAt: found.updatedAt,
    };
  },
});

// Wave-2 verification passed on DEV and PROD (blogs + homepage read from
// Convex): the temporary backfill mutation is deleted. Queries above are
// the stable surface. NOTE: code auto-deploys to PROD on push, but DATA
// never syncs — backfills must run per deployment (drivers in Temp).
