import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ---------- Wave 3: catalog reads (Supabase -> Convex) ----------
// Catalog is GLOBAL and public: no orgId, no requireMember. Money fields
// are RUPEES (numbers, as in Supabase); paise conversion happens only at
// the order boundary (rupeesToPaise on createOrder).

const brandShape = (b: any) => ({
  _id: b._id,
  supabaseId: b.supabaseId,
  name: b.name,
  slug: b.slug,
  description: b.description,
  logoUrl: b.logoUrl,
  websiteUrl: b.websiteUrl,
  countryOfOrigin: b.countryOfOrigin,
  heritage: b.heritage,
  isActive: b.isActive,
  sortOrder: b.sortOrder,
  metaTitle: b.metaTitle,
  metaDescription: b.metaDescription,
  createdAt: b.createdAt,
  updatedAt: b.updatedAt,
});

const categoryShape = (c: any) => ({
  _id: c._id,
  supabaseId: c.supabaseId,
  name: c.name,
  slug: c.slug,
  description: c.description,
  image: c.image,
  imageAltText: c.imageAltText,
  metaTitle: c.metaTitle,
  metaDescription: c.metaDescription,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

const productShape = (p: any) => ({
  _id: p._id,
  supabaseId: p.supabaseId,
  name: p.name,
  slug: p.slug,
  brandSupabaseId: p.brandSupabaseId,
  description: p.description,
  shortDescription: p.shortDescription,
  origin: p.origin,
  specifications: p.specifications,
  isActive: p.isActive,
  metaTitle: p.metaTitle,
  metaDescription: p.metaDescription,
  canonicalUrl: p.canonicalUrl,
  ratingValue: p.ratingValue,
  reviewCount: p.reviewCount,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

const variantShape = (x: any) => ({
  _id: x._id,
  supabaseId: x.supabaseId,
  productSupabaseId: x.productSupabaseId,
  variantName: x.variantName,
  variantSlug: x.variantSlug,
  variantType: x.variantType,
  unitsContained: x.unitsContained,
  unit: x.unit,
  images: x.images ?? [],
  imageAltText: x.imageAltText,
  priceRupees: x.priceRupees,
  compareAtPriceRupees: x.compareAtPriceRupees,
  costPriceRupees: x.costPriceRupees,
  stock: x.stock,
  trackInventory: x.trackInventory,
  isDefault: x.isDefault,
  isActive: x.isActive,
});

export const listBrands = query({
  args: { activeOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    if (args.activeOnly === false) {
      return (await ctx.db.query("catalogBrands").collect()).map(brandShape);
    }
    const rows = await ctx.db
      .query("catalogBrands")
      .withIndex("by_active_sort", (q) => q.eq("isActive", true))
      .collect();
    return rows.map(brandShape);
  },
});

export const getBrandBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("catalogBrands")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    return row ? brandShape(row) : null;
  },
});

export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    return (await ctx.db.query("catalogCategories").collect()).map(
      categoryShape,
    );
  },
});

export const listProducts = query({
  args: { limit: v.optional(v.number()), activeOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    if (args.activeOnly === false) {
      const all = await ctx.db.query("catalogProducts").collect();
      return all.slice(0, args.limit ?? 100).map(productShape);
    }
    const rows = await ctx.db
      .query("catalogProducts")
      .withIndex("by_active_created", (q) => q.eq("isActive", true))
      .order("desc")
      .take(args.limit ?? 100);
    return rows.map(productShape);
  },
});

export const getProductBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("catalogProducts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!product) return null;
    const variants = await ctx.db
      .query("catalogVariants")
      .withIndex("by_product", (q) =>
        q.eq("productSupabaseId", product.supabaseId),
      )
      .collect();
    let brand = null;
    if (product.brandSupabaseId) {
      const b = await ctx.db
        .query("catalogBrands")
        .withIndex("by_supabase", (q) =>
          q.eq("supabaseId", product.brandSupabaseId as string),
        )
        .unique();
      if (b) brand = brandShape(b);
    }
    return {
      product: productShape(product),
      variants: variants.map(variantShape),
      brand,
    };
  },
});

export const listVariantsByProduct = query({
  args: { productSupabaseId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("catalogVariants")
      .withIndex("by_product", (q) =>
        q.eq("productSupabaseId", args.productSupabaseId),
      )
      .collect();
    return rows.map(variantShape);
  },
});

export const listCollections = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("catalogCollections").collect();
    return rows.map((c) => ({
      _id: c._id,
      supabaseId: c.supabaseId,
      title: c.title,
      slug: c.slug,
      description: c.description,
      imageUrl: c.imageUrl,
    type: c.type,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    seoTitle: c.seoTitle,
    seoDescription: c.seoDescription,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
  },
});

export const listCombos = query({
  args: { activeOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("catalogCombos").collect();
    const list = (args.activeOnly === false ? rows : rows.filter((r) => r.isActive)).map(
      (c) => ({
        _id: c._id,
        supabaseId: c.supabaseId,
        name: c.name,
        slug: c.slug,
        description: c.description,
        comboPriceRupees: c.comboPriceRupees,
        originalPriceRupees: c.originalPriceRupees,
        discountPercentage: c.discountPercentage,
        image: c.image,
        galleryImages: c.galleryImages ?? [],
        isActive: c.isActive,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }),
    );
    return list;
  },
});

// Verification helper: row counts per catalog table.
export const catalogCounts = query({
  args: {},
  handler: async (ctx) => {
    const tables = [
      "catalogBrands",
      "catalogCategories",
      "catalogProducts",
      "catalogVariants",
      "catalogProductCategories",
      "catalogCollections",
      "catalogCollectionProducts",
      "catalogCombos",
      "catalogComboItems",
    ] as const;
    const out: Record<string, number> = {};
    for (const t of tables) {
      const rows = await ctx.db.query(t).take(2000);
      out[t] = rows.length < 2000 ? rows.length : -1;
    }
    return out;
  },
});

// ---------- TEMPORARY backfill (delete after Wave 3 verification) ----------
// Idempotent upserts keyed by supabaseId (joins: full replace per call).
// Driver script passes camelCase docs with ms timestamps; Supabase UUIDs
// ride along as supabaseId so joins rebuild exactly.
const optStr = (v: any) => (v === null || v === undefined ? undefined : v);
const optNum = (v: any) =>
  v === null || v === undefined || !Number.isFinite(Number(v))
    ? undefined
    : Number(v);

export const backfillCatalog = mutation({
  args: {
    brands: v.optional(v.array(v.any())),
    categories: v.optional(v.array(v.any())),
    products: v.optional(v.array(v.any())),
    variants: v.optional(v.array(v.any())),
    productCategories: v.optional(v.array(v.any())),
    collections: v.optional(v.array(v.any())),
    collectionProducts: v.optional(v.array(v.any())),
    combos: v.optional(v.array(v.any())),
    comboItems: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    const counts: Record<string, number> = {};
    const upsertBySupabase = async (
      table:
        | "catalogBrands"
        | "catalogCategories"
        | "catalogProducts"
        | "catalogVariants"
        | "catalogCollections"
        | "catalogCombos",
      doc: any,
    ) => {
      const ex = await ctx.db
        .query(table)
        .withIndex("by_supabase", (q) => q.eq("supabaseId", doc.supabaseId))
        .unique();
      if (ex) await ctx.db.patch(ex._id, doc);
      else await ctx.db.insert(table, doc);
    };

    for (const b of args.brands ?? []) {
      await upsertBySupabase("catalogBrands", {
        supabaseId: b.supabaseId,
        name: b.name,
        slug: b.slug,
        description: optStr(b.description),
        logoUrl: optStr(b.logoUrl),
        websiteUrl: optStr(b.websiteUrl),
        countryOfOrigin: optStr(b.countryOfOrigin),
        heritage: optStr(b.heritage),
        isActive: b.isActive !== false,
        sortOrder: optNum(b.sortOrder),
        metaTitle: optStr(b.metaTitle),
        metaDescription: optStr(b.metaDescription),
        createdAt: optNum(b.createdAt),
        updatedAt: optNum(b.updatedAt),
      });
      counts.brands = (counts.brands ?? 0) + 1;
    }
    for (const c of args.categories ?? []) {
      await upsertBySupabase("catalogCategories", {
        supabaseId: c.supabaseId,
        name: c.name,
        slug: c.slug,
        description: optStr(c.description),
        image: optStr(c.image),
        imageAltText: optStr(c.imageAltText),
        metaTitle: optStr(c.metaTitle),
        metaDescription: optStr(c.metaDescription),
        createdAt: optNum(c.createdAt),
        updatedAt: optNum(c.updatedAt),
      });
      counts.categories = (counts.categories ?? 0) + 1;
    }
    for (const p of args.products ?? []) {
      await upsertBySupabase("catalogProducts", {
        supabaseId: p.supabaseId,
        name: p.name,
        slug: p.slug,
        brandSupabaseId: optStr(p.brandSupabaseId),
        description: optStr(p.description),
        shortDescription: optStr(p.shortDescription),
        origin: optStr(p.origin),
        specifications: p.specifications ?? undefined,
        isActive: p.isActive !== false,
        metaTitle: optStr(p.metaTitle),
        metaDescription: optStr(p.metaDescription),
        canonicalUrl: optStr(p.canonicalUrl),
        ratingValue: optNum(p.ratingValue),
        reviewCount: optNum(p.reviewCount),
        createdAt: optNum(p.createdAt),
        updatedAt: optNum(p.updatedAt),
      });
      counts.products = (counts.products ?? 0) + 1;
    }
    for (const x of args.variants ?? []) {
      await upsertBySupabase("catalogVariants", {
        supabaseId: x.supabaseId,
        productSupabaseId: x.productSupabaseId,
        variantName: x.variantName,
        variantSlug: x.variantSlug,
        variantType: optStr(x.variantType),
        unitsContained: optNum(x.unitsContained),
        unit: optStr(x.unit),
        images: Array.isArray(x.images) ? x.images : undefined,
        imageAltText: optStr(x.imageAltText),
        priceRupees: Number(x.priceRupees ?? 0),
        compareAtPriceRupees: optNum(x.compareAtPriceRupees),
        costPriceRupees: optNum(x.costPriceRupees),
        stock: optNum(x.stock),
        trackInventory: x.trackInventory ?? undefined,
        isDefault: x.isDefault ?? undefined,
        isActive: x.isActive !== false,
        createdAt: optNum(x.createdAt),
        updatedAt: optNum(x.updatedAt),
      });
      counts.variants = (counts.variants ?? 0) + 1;
    }
    for (const c of args.collections ?? []) {
      await upsertBySupabase("catalogCollections", {
        supabaseId: c.supabaseId,
        title: c.title,
        slug: c.slug,
        description: optStr(c.description),
        imageUrl: optStr(c.imageUrl),
        type: optStr(c.type),
        rules: c.rules ?? undefined,
        sortOrder: optNum(c.sortOrder),
        isActive: c.isActive !== false,
        seoTitle: optStr(c.seoTitle),
        seoDescription: optStr(c.seoDescription),
        createdAt: optNum(c.createdAt),
        updatedAt: optNum(c.updatedAt),
      });
      counts.collections = (counts.collections ?? 0) + 1;
    }
    for (const c of args.combos ?? []) {
      await upsertBySupabase("catalogCombos", {
        supabaseId: c.supabaseId,
        name: c.name,
        slug: c.slug,
        description: optStr(c.description),
        comboPriceRupees: Number(c.comboPriceRupees ?? 0),
        originalPriceRupees: optNum(c.originalPriceRupees),
        discountPercentage: optNum(c.discountPercentage),
        image: optStr(c.image),
        galleryImages: Array.isArray(c.galleryImages) ? c.galleryImages : undefined,
        isActive: c.isActive !== false,
        createdAt: optNum(c.createdAt),
        updatedAt: optNum(c.updatedAt),
      });
      counts.combos = (counts.combos ?? 0) + 1;
    }
    // Joins: delete-then-insert per call (backfill runs whole-table).
    if (args.productCategories !== undefined) {
      const existing = await ctx.db.query("catalogProductCategories").collect();
      for (const r of existing) await ctx.db.delete(r._id);
      for (const j of args.productCategories) {
        await ctx.db.insert("catalogProductCategories", {
          productSupabaseId: j.productSupabaseId,
          categorySupabaseId: j.categorySupabaseId,
          order: optNum(j.order),
        });
        counts.productCategories = (counts.productCategories ?? 0) + 1;
      }
    }
    if (args.collectionProducts !== undefined) {
      const existing = await ctx.db.query("catalogCollectionProducts").collect();
      for (const r of existing) await ctx.db.delete(r._id);
      for (const j of args.collectionProducts) {
        await ctx.db.insert("catalogCollectionProducts", {
          collectionSupabaseId: j.collectionSupabaseId,
          productSupabaseId: j.productSupabaseId,
          sortOrder: optNum(j.sortOrder),
        });
        counts.collectionProducts = (counts.collectionProducts ?? 0) + 1;
      }
    }
    if (args.comboItems !== undefined) {
      const existing = await ctx.db.query("catalogComboItems").collect();
      for (const r of existing) await ctx.db.delete(r._id);
      for (const j of args.comboItems) {
        await ctx.db.insert("catalogComboItems", {
          comboSupabaseId: j.comboSupabaseId,
          variantSupabaseId: j.variantSupabaseId,
          quantity: Number(j.quantity ?? 1),
          sortOrder: optNum(j.sortOrder),
        });
        counts.comboItems = (counts.comboItems ?? 0) + 1;
      }
    }
    return counts;
  },
});

// ---------- Prerender / sitemap support (byte-diff gates) ----------
// These queries return exactly what the edge generators need so the swap
// is data-source-only: templates stay untouched.

async function brandNameBySupabaseId(ctx: any, brandSupabaseId?: string) {
  if (!brandSupabaseId) return null;
  const b = await ctx.db
    .query("catalogBrands")
    .withIndex("by_supabase", (q: any) => q.eq("supabaseId", brandSupabaseId))
    .unique();
  return b ? { name: b.name, slug: b.slug } : null;
}

// Sitemap: active products with images + updatedAt, categories, brands.
export const sitemapCatalog = query({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db
      .query("catalogProducts")
      .withIndex("by_active_created", (q) => q.eq("isActive", true))
      .collect();
    const withImages = [];
    for (const p of products) {
      const variants = await ctx.db
        .query("catalogVariants")
        .withIndex("by_product", (q) =>
          q.eq("productSupabaseId", p.supabaseId),
        )
        .collect();
      const images = variants
        .filter((x) => x.isActive !== false)
        .flatMap((x) => x.images ?? [])
        .filter(Boolean)
        .slice(0, 5);
      withImages.push({
        slug: p.slug,
        name: p.name,
        updatedAt: p.updatedAt,
        images,
      });
    }
    const categories = (
      await ctx.db.query("catalogCategories").collect()
    ).map((c) => ({ slug: c.slug, updatedAt: c.updatedAt }));
    const brands = (
      await ctx.db
        .query("catalogBrands")
        .withIndex("by_active_sort", (q) => q.eq("isActive", true))
        .collect()
    ).map((b) => ({ slug: b.slug, updatedAt: b.updatedAt }));
    return { products: withImages, categories, brands };
  },
});

// Related-product links for PDP prerender (same-brand first is done in the
// template; this returns the candidate pool with brand names).
export const relatedProductLinks = query({
  args: { excludeSlug: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("catalogProducts")
      .withIndex("by_active_created", (q) => q.eq("isActive", true))
      .take(args.limit ?? 50);
    const out = [];
    for (const p of rows) {
      if (p.slug === args.excludeSlug) continue;
      const brand = await brandNameBySupabaseId(ctx, p.brandSupabaseId);
      out.push({ slug: p.slug, name: p.name, brandName: brand?.name ?? null });
    }
    return out;
  },
});

export const getCategoryDetail = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const category = await ctx.db
      .query("catalogCategories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!category) return null;
    const joins = await ctx.db
      .query("catalogProductCategories")
      .withIndex("by_category", (q) =>
        q.eq("categorySupabaseId", category.supabaseId),
      )
      .take(20);
    const products = [];
    for (const j of joins) {
      const p = await ctx.db
        .query("catalogProducts")
        .withIndex("by_supabase", (q) =>
          q.eq("supabaseId", j.productSupabaseId),
        )
        .unique();
      if (p && p.isActive && p.slug) products.push({ slug: p.slug, name: p.name });
    }
    return { category: categoryShape(category), products };
  },
});

export const getBrandDetail = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const brand = await ctx.db
      .query("catalogBrands")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!brand || !brand.isActive) return null;
    const rows = await ctx.db
      .query("catalogProducts")
      .withIndex("by_brand_active", (q) =>
        q.eq("brandSupabaseId", brand.supabaseId).eq("isActive", true),
      )
      .take(12);
    return {
      brand: brandShape(brand),
      products: rows
        .filter((p) => p.slug)
        .map((p) => ({ slug: p.slug, name: p.name })),
    };
  },
});

// Full catalog bundle for the edge JSON APIs (/api/products, /api/brands,
// /api/categories, /api/homepage-data). Returns raw camelCase docs; the
// edge layer maps them to the exact legacy Supabase shapes (snake_case,
// UUID ids, ISO timestamps, explicit nulls) so API JSON stays identical.
export const fullCatalog = query({
  args: {},
  handler: async (ctx) => {
    const [products, variants, brands, categories, productCategories] =
      await Promise.all([
        ctx.db.query("catalogProducts").collect(),
        ctx.db.query("catalogVariants").collect(),
        ctx.db.query("catalogBrands").collect(),
        ctx.db.query("catalogCategories").collect(),
        ctx.db.query("catalogProductCategories").collect(),
      ]);
    return {
      products: products.map(productShape),
      variants: variants.map(variantShape),
      brands: brands.map(brandShape),
      categories: categories.map(categoryShape),
      productCategories: productCategories.map((j) => ({
        productSupabaseId: j.productSupabaseId,
        categorySupabaseId: j.categorySupabaseId,
        order: j.order,
      })),
    };
  },
});

// Cart rehydration: lean server lines carry Supabase UUIDs; resolve them to
// the exact legacy row shapes (snake_case) so useCart logic is untouched.
export const productsBySupabaseIds = query({
  args: { ids: v.array(v.string()) },
  handler: async (ctx, args) => {
    const out = [];
    for (const id of args.ids.slice(0, 100)) {
      const p = await ctx.db
        .query("catalogProducts")
        .withIndex("by_supabase", (q) => q.eq("supabaseId", id))
        .unique();
      if (!p) continue;
      const variants = await ctx.db
        .query("catalogVariants")
        .withIndex("by_product", (q) => q.eq("productSupabaseId", p.supabaseId))
        .collect();
      const brand = await brandNameBySupabaseId(ctx, p.brandSupabaseId);
      out.push({
        id: p.supabaseId,
        name: p.name,
        slug: p.slug,
        brand_id: p.brandSupabaseId ?? null,
        brand: brand ? { id: p.brandSupabaseId, name: brand.name } : null,
        description: p.description,
        is_active: p.isActive,
        product_variants: variants.map((x) => ({
          id: x.supabaseId,
          variant_name: x.variantName,
          price: x.priceRupees,
          images: x.images ?? [],
          is_default: x.isDefault,
          is_active: x.isActive,
        })),
      });
    }
    return out;
  },
});

export const combosBySupabaseIds = query({
  args: { ids: v.array(v.string()) },
  handler: async (ctx, args) => {
    const out = [];
    for (const id of args.ids.slice(0, 100)) {
      const c = await ctx.db
        .query("catalogCombos")
        .withIndex("by_supabase", (q) => q.eq("supabaseId", id))
        .unique();
      if (c)
        out.push({
          id: c.supabaseId,
          name: c.name,
          combo_price: c.comboPriceRupees,
        });
    }
    return out;
  },
});
