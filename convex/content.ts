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
    return rows.map(postShape);
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
    const rows = await ctx.db
      .query("blogPosts")
      .withIndex("by_category_status", (q) =>
        args.categorySlug
          ? q
              .eq("categorySlug", args.categorySlug)
              .eq("status", "published")
          : q.eq("status", "published" as never),
      )
      .order("desc")
      .take((args.limit ?? 3) + 1);
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
      updatedAt: row.updatedAt,
    };
  },
});

// ---------- TEMPORARY backfill (delete after Wave 2) ----------
// Bootstrap is DONE (convex import). This mutation stays only until the
// Wave-2 verification passes, then DELETE it (keep the file — queries stay).
import { mutation } from "./_generated/server";

const optStr = (v: any) => (v === null || v === undefined ? undefined : v);
const optNum = (v: any) =>
  v === null || v === undefined || !Number.isFinite(Number(v))
    ? undefined
    : Number(v);
const optBool = (v: any) => (v === null || v === undefined ? undefined : !!v);

export const backfillContent = mutation({
  args: {
    categories: v.optional(v.array(v.any())),
    posts: v.optional(v.array(v.any())),
    heroes: v.optional(v.array(v.any())),
    sections: v.optional(v.array(v.any())),
    components: v.optional(v.array(v.any())),
    site: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const counts: Record<string, number> = {};
    for (const c of args.categories ?? []) {
      const ex = await ctx.db
        .query("blogCategories")
        .withIndex("by_slug", (q) => q.eq("slug", c.slug))
        .unique();
      const doc = {
        slug: c.slug,
        name: c.name,
        color: optStr(c.color),
        description: optStr(c.description),
        isActive: c.isActive !== false,
        sortOrder: optNum(c.sortOrder),
      };
      if (ex) await ctx.db.patch(ex._id, doc);
      else await ctx.db.insert("blogCategories", doc);
      counts.categories = (counts.categories ?? 0) + 1;
    }
    for (const p of args.posts ?? []) {
      const ex = await ctx.db
        .query("blogPosts")
        .withIndex("by_slug", (q) => q.eq("slug", p.slug))
        .unique();
      const doc = {
        slug: p.slug,
        title: p.title,
        excerpt: optStr(p.excerpt),
        content: p.content ?? "",
        featuredImage: optStr(p.featuredImage),
        status: p.status ?? "draft",
        authorName: p.authorName ?? "Cigarro",
        categorySlug: optStr(p.categorySlug),
        readingTime: optNum(p.readingTime),
        metaTitle: optStr(p.metaTitle),
        metaDescription: optStr(p.metaDescription),
        ogTitle: optStr(p.ogTitle),
        ogDescription: optStr(p.ogDescription),
        ogImage: optStr(p.ogImage),
        canonicalUrl: optStr(p.canonicalUrl),
        isFeatured: optBool(p.isFeatured),
        isPinned: optBool(p.isPinned),
        likeCount: optNum(p.likeCount),
        viewCount: optNum(p.viewCount),
        sortOrder: optNum(p.sortOrder),
        publishedAt: optNum(p.publishedAt),
        updatedAt: optNum(p.updatedAt),
      };
      if (ex) await ctx.db.patch(ex._id, doc);
      else await ctx.db.insert("blogPosts", doc);
      counts.posts = (counts.posts ?? 0) + 1;
    }
    for (const h of args.heroes ?? []) {
      await ctx.db.insert("heroSlides", {
        title: optStr(h.title),
        subtitle: optStr(h.subtitle),
        suptitle: optStr(h.suptitle),
        description: optStr(h.description),
        buttonText: optStr(h.buttonText),
        buttonUrl: optStr(h.buttonUrl),
        buttonStyle: optStr(h.buttonStyle),
        imageUrl: optStr(h.imageUrl),
        mobileImageUrl: optStr(h.mobileImageUrl),
        productImageUrl: optStr(h.productImageUrl),
        productName: optStr(h.productName),
        productPrice: optNum(h.productPrice),
        smallImageUrl: optStr(h.smallImageUrl),
        overlayOpacity: optNum(h.overlayOpacity),
        textColor: optStr(h.textColor),
        textPosition: optStr(h.textPosition),
        sortOrder: Number(h.sortOrder ?? 0),
        isActive: !!h.isActive,
      });
      counts.heroes = (counts.heroes ?? 0) + 1;
    }
    for (const s of args.sections ?? []) {
      const ex = await ctx.db
        .query("sectionConfigurations")
        .withIndex("by_name", (q) => q.eq("sectionName", s.sectionName))
        .unique();
      const doc = {
        sectionName: s.sectionName,
        title: optStr(s.title),
        subtitle: optStr(s.subtitle),
        description: optStr(s.description),
        backgroundImage: optStr(s.backgroundImage),
        buttonText: optStr(s.buttonText),
        buttonUrl: optStr(s.buttonUrl),
        config: s.config ?? undefined,
        maxItems: optNum(s.maxItems),
        isEnabled: optBool(s.isEnabled) ?? true,
      };
      if (ex) await ctx.db.patch(ex._id, doc);
      else await ctx.db.insert("sectionConfigurations", doc);
      counts.sections = (counts.sections ?? 0) + 1;
    }
    for (const c of args.components ?? []) {
      await ctx.db.insert("homepageComponentConfig", {
        componentName: c.componentName,
        config: c.config ?? undefined,
        isEnabled: !!c.isEnabled,
        displayOrder: Number(c.displayOrder ?? 0),
        sectionId: optStr(c.sectionId),
      });
      counts.components = (counts.components ?? 0) + 1;
    }
    if (args.site) {
      const s = args.site;
      const ex = await ctx.db
        .query("siteSettings")
        .withIndex("by_key", (q) => q.eq("key", "main"))
        .unique();
      const doc = {
        key: "main",
        siteName: optStr(s.siteName),
        metaTitle: optStr(s.metaTitle),
        metaDescription: optStr(s.metaDescription),
        faviconUrl: optStr(s.faviconUrl),
        activeTheme: optStr(s.activeTheme),
        upiId: optStr(s.upiId),
        updatedAt: optNum(s.updatedAt),
        updatedBy: optStr(s.updatedBy),
      };
      if (ex) await ctx.db.patch(ex._id, doc);
      else await ctx.db.insert("siteSettings", doc);
      counts.site = 1;
    }
    return counts;
  },
});
