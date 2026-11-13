import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation } from "./_generated/server";
import { requireSaWrite } from "./lib/auth";
import { audit } from "./lib/audit";
import { storeBrandV, storeBusinessV, storeSeoV, storeSocialsV } from "./lib/siteSettings";

// Super-admin import of a migrated storefront (see src/lib/storeImport/dukaan.ts
// for the transform that builds these payloads). Every mutation is:
//  - gated by requireSaWrite (SA session with an open write window),
//  - idempotent: rows are keyed by `sourceKey` (stored in supabaseId for catalog
//    tables, so re-running the import updates in place and never duplicates),
//  - org-scoped: every row carries orgId.
// Catalog money is RUPEES (schema contract); no paise conversion here.
//
// Batches are small (<= 50 items) so one mutation stays well inside Convex limits;
// the UI drives the batches sequentially and reports per-entity counts.

const MAX_BATCH = 50;

const imageUrlV = v.string();

const categoryItemV = v.object({
  sourceKey: v.string(),
  slug: v.string(),
  name: v.string(),
  description: v.optional(v.string()),
  image: v.optional(v.string()),
  metaTitle: v.optional(v.string()),
  metaDescription: v.optional(v.string()),
  isActive: v.boolean(),
});

const variantItemV = v.object({
  sourceKey: v.string(),
  name: v.string(),
  slug: v.string(),
  unit: v.optional(v.string()),
  unitsContained: v.optional(v.number()),
  images: v.array(imageUrlV),
  priceRupees: v.number(),
  compareAtPriceRupees: v.optional(v.number()),
  stock: v.optional(v.number()),
  isDefault: v.boolean(),
  isActive: v.boolean(),
});

const productItemV = v.object({
  sourceKey: v.string(),
  slug: v.string(),
  name: v.string(),
  description: v.optional(v.string()),
  shortDescription: v.optional(v.string()),
  metaTitle: v.optional(v.string()),
  metaDescription: v.optional(v.string()),
  ratingValue: v.optional(v.number()),
  reviewCount: v.optional(v.number()),
  isActive: v.boolean(),
  variants: v.array(variantItemV),
  categorySourceKeys: v.array(v.string()),
});

const heroSlideV = v.object({
  title: v.optional(v.string()),
  subtitle: v.optional(v.string()),
  suptitle: v.optional(v.string()),
  description: v.optional(v.string()),
  buttonText: v.optional(v.string()),
  buttonUrl: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  mobileImageUrl: v.optional(v.string()),
  sortOrder: v.number(),
  isActive: v.boolean(),
});

const blogItemV = v.object({
  slug: v.string(),
  title: v.string(),
  excerpt: v.optional(v.string()),
  content: v.string(),
  featuredImage: v.optional(v.string()),
  status: v.string(),
  authorName: v.string(),
  categorySlug: v.optional(v.string()),
  metaTitle: v.optional(v.string()),
  metaDescription: v.optional(v.string()),
  ogImage: v.optional(v.string()),
  publishedAt: v.optional(v.number()),
});

type Counts = { created: number; updated: number };

async function assertOrg(ctx: MutationCtx, orgId: Id<"organizations">) {
  const org = await ctx.db.get(orgId);
  if (!org) throw new ConvexError({ code: "ORG_NOT_FOUND" });
  return org;
}

function assertBatch(n: number) {
  if (n > MAX_BATCH) throw new ConvexError({ code: "BATCH_TOO_LARGE" });
}

// ---------- categories ----------

export const importCategories = mutation({
  args: {
    saToken: v.string(),
    orgId: v.id("organizations"),
    items: v.array(categoryItemV),
  },
  handler: async (ctx, { saToken, orgId, items }) => {
    const sa = await requireSaWrite(ctx, saToken);
    await assertOrg(ctx, orgId);
    assertBatch(items.length);
    const counts: Counts = { created: 0, updated: 0 };
    const now = Date.now();
    for (const it of items) {
      const existing = await ctx.db
        .query("catalogCategories")
        .withIndex("by_org_supabase", (q) => q.eq("orgId", orgId).eq("supabaseId", it.sourceKey))
        .unique();
      const row = {
        orgId,
        supabaseId: it.sourceKey,
        name: it.name,
        slug: it.slug,
        description: it.description,
        image: it.image,
        metaTitle: it.metaTitle,
        metaDescription: it.metaDescription,
        isActive: it.isActive,
        updatedAt: now,
      };
      if (existing) {
        await ctx.db.patch(existing._id, row);
        counts.updated++;
      } else {
        await ctx.db.insert("catalogCategories", { ...row, createdAt: now });
        counts.created++;
      }
    }
    await audit(ctx, {
      adminUserId: sa.adminId,
      actorType: "super_admin",
      orgId,
      action: "platform.import.categories",
      targetType: "organization",
      targetId: orgId,
      payload: { ...counts, count: items.length },
    });
    return counts;
  },
});

// ---------- products (with variants and category links) ----------

export const importProducts = mutation({
  args: {
    saToken: v.string(),
    orgId: v.id("organizations"),
    items: v.array(productItemV),
  },
  handler: async (ctx, { saToken, orgId, items }) => {
    const sa = await requireSaWrite(ctx, saToken);
    await assertOrg(ctx, orgId);
    assertBatch(items.length);
    const counts = { products: { created: 0, updated: 0 }, variants: { created: 0, updated: 0 }, links: 0 };
    const now = Date.now();
    for (const it of items) {
      const existing = await ctx.db
        .query("catalogProducts")
        .withIndex("by_org_supabase", (q) => q.eq("orgId", orgId).eq("supabaseId", it.sourceKey))
        .unique();
      const row = {
        orgId,
        supabaseId: it.sourceKey,
        name: it.name,
        slug: it.slug,
        description: it.description,
        shortDescription: it.shortDescription,
        isActive: it.isActive,
        metaTitle: it.metaTitle,
        metaDescription: it.metaDescription,
        ratingValue: it.ratingValue,
        reviewCount: it.reviewCount,
        updatedAt: now,
      };
      let productId: string;
      if (existing) {
        await ctx.db.patch(existing._id, row);
        counts.products.updated++;
      } else {
        await ctx.db.insert("catalogProducts", { ...row, createdAt: now });
        counts.products.created++;
      }
      productId = it.sourceKey;

      for (const vr of it.variants) {
        const ex = await ctx.db
          .query("catalogVariants")
          .withIndex("by_org_supabase", (q) => q.eq("orgId", orgId).eq("supabaseId", vr.sourceKey))
          .unique();
        const vrow = {
          orgId,
          supabaseId: vr.sourceKey,
          productSupabaseId: productId,
          variantName: vr.name,
          variantSlug: vr.slug,
          unit: vr.unit,
          unitsContained: vr.unitsContained,
          images: vr.images,
          priceRupees: vr.priceRupees,
          compareAtPriceRupees: vr.compareAtPriceRupees,
          stock: vr.stock,
          trackInventory: vr.stock !== undefined,
          isDefault: vr.isDefault,
          isActive: vr.isActive,
          updatedAt: now,
        };
        if (ex) {
          await ctx.db.patch(ex._id, vrow);
          counts.variants.updated++;
        } else {
          await ctx.db.insert("catalogVariants", { ...vrow, createdAt: now });
          counts.variants.created++;
        }
      }

      // Category links: replace the product's set so re-runs converge.
      const oldLinks = await ctx.db
        .query("catalogProductCategories")
        .withIndex("by_org_product", (q) => q.eq("orgId", orgId).eq("productSupabaseId", productId))
        .collect();
      for (const l of oldLinks) await ctx.db.delete(l._id);
      let order = 0;
      for (const cat of it.categorySourceKeys) {
        await ctx.db.insert("catalogProductCategories", {
          orgId,
          productSupabaseId: productId,
          categorySupabaseId: cat,
          order: order++,
        });
        counts.links++;
      }
    }
    await audit(ctx, {
      adminUserId: sa.adminId,
      actorType: "super_admin",
      orgId,
      action: "platform.import.products",
      targetType: "organization",
      targetId: orgId,
      payload: { count: items.length, ...counts },
    });
    return counts;
  },
});

// ---------- hero slides (replace-all: the source has no stable slide id) ----------

export const importHeroSlides = mutation({
  args: { saToken: v.string(), orgId: v.id("organizations"), items: v.array(heroSlideV) },
  handler: async (ctx, { saToken, orgId, items }) => {
    const sa = await requireSaWrite(ctx, saToken);
    await assertOrg(ctx, orgId);
    assertBatch(items.length);
    const old = await ctx.db
      .query("heroSlides")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    for (const o of old) await ctx.db.delete(o._id);
    for (const it of items) await ctx.db.insert("heroSlides", { orgId, ...it });
    await audit(ctx, {
      adminUserId: sa.adminId,
      actorType: "super_admin",
      orgId,
      action: "platform.import.heroSlides",
      targetType: "organization",
      targetId: orgId,
      payload: { replaced: old.length, count: items.length },
    });
    return { replaced: old.length, created: items.length };
  },
});

// ---------- blog posts + static pages (keyed by slug per org) ----------

export const importBlogPosts = mutation({
  args: { saToken: v.string(), orgId: v.id("organizations"), items: v.array(blogItemV) },
  handler: async (ctx, { saToken, orgId, items }) => {
    const sa = await requireSaWrite(ctx, saToken);
    await assertOrg(ctx, orgId);
    assertBatch(items.length);
    const counts: Counts = { created: 0, updated: 0 };
    const now = Date.now();
    for (const it of items) {
      const existing = await ctx.db
        .query("blogPosts")
        .withIndex("by_org_slug", (q) => q.eq("orgId", orgId).eq("slug", it.slug))
        .unique();
      const row = { ...it, orgId, updatedAt: now };
      if (existing) {
        await ctx.db.patch(existing._id, row);
        counts.updated++;
      } else {
        await ctx.db.insert("blogPosts", {
          ...row,
          isFeatured: false,
          isPinned: false,
          likeCount: 0,
          viewCount: 0,
          sortOrder: 0,
          readingTime: undefined,
        });
        counts.created++;
      }
    }
    await audit(ctx, {
      adminUserId: sa.adminId,
      actorType: "super_admin",
      orgId,
      action: "platform.import.blogPosts",
      targetType: "organization",
      targetId: orgId,
      payload: { ...counts, count: items.length },
    });
    return counts;
  },
});

// ---------- site settings (brand, business, SEO, socials, theme) ----------

export const importSiteSettings = mutation({
  args: {
    saToken: v.string(),
    orgId: v.id("organizations"),
    siteName: v.optional(v.string()),
    metaTitle: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    activeTheme: v.optional(v.string()),
    brand: v.optional(storeBrandV),
    business: v.optional(storeBusinessV),
    seo: v.optional(storeSeoV),
    socials: v.optional(storeSocialsV),
  },
  handler: async (ctx, { saToken, orgId, ...patch }) => {
    const sa = await requireSaWrite(ctx, saToken);
    await assertOrg(ctx, orgId);
    const existing: Doc<"siteSettings"> | null = await ctx.db
      .query("siteSettings")
      .withIndex("by_org_key", (q) => q.eq("orgId", orgId).eq("key", "main"))
      .unique();
    const now = Date.now();
    const clean = Object.fromEntries(Object.entries(patch).filter(([, x]) => x !== undefined));
    if (existing) {
      await ctx.db.patch(existing._id, { ...clean, updatedAt: now, updatedBy: sa.adminId });
    } else {
      await ctx.db.insert("siteSettings", { orgId, key: "main", ...clean, updatedAt: now, updatedBy: sa.adminId });
    }
    await audit(ctx, {
      adminUserId: sa.adminId,
      actorType: "super_admin",
      orgId,
      action: "platform.import.siteSettings",
      targetType: "organization",
      targetId: orgId,
      payload: { fields: Object.keys(clean) },
    });
    return { updated: !!existing };
  },
});
