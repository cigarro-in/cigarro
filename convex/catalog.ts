import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  collectInOrg,
  findOrgDocBySlug,
  findOrgDocBySupabase,
  inOrg,
  requireOrgAdminBySlug,
  resolveOrg,
} from "./lib/org";

// ---------- Wave 3: catalog reads (Supabase -> Convex) ----------
// Catalog is ORG-SCOPED and public: every query takes the storefront orgSlug,
// resolves it via organizations by_slug, and returns only that org's rows.
// Money fields are RUPEES (numbers, as in Supabase); paise conversion happens
// only at the order boundary (rupeesToPaise on createOrder). Pre-backfill rows
// (no orgId) read as the legacy smokeshop org's rows.

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

// Public catalog intentionally exposes availability only, never exact stock.
// Admin inventory queries are the sole source for quantities.
const variantShape = (x: any, available?: number) => ({
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
  stock: x.trackInventory === false ? undefined : (available ?? Number(x.stock ?? 0)) > 0 ? 1 : 0,
  trackInventory: x.trackInventory,
  isDefault: x.isDefault,
  isActive: x.isActive,
});

async function publicVariantShapes(ctx: any, org: any, variants: any[]) {
  const balances = await ctx.db
    .query("inventoryBalances")
    .withIndex("by_org", (q: any) => q.eq("orgId", org._id))
    .collect();
  const byVariant = new Map(balances.map((b: any) => [b.variantSupabaseId, b]));
  return variants.map((x) => {
    const balance: any = byVariant.get(x.supabaseId);
    const available = balance ? balance.onHand - balance.reserved : Number(x.stock ?? 0);
    return variantShape(x, available);
  });
}

async function orgVariantsByProduct(
  ctx: any,
  org: any,
  productSupabaseId: string,
): Promise<any[]> {
  const scoped = await ctx.db
    .query("catalogVariants")
    .withIndex("by_org_product", (q: any) =>
      q.eq("orgId", org._id).eq("productSupabaseId", productSupabaseId),
    )
    .collect();
  if (org.slug !== "smokeshop") return scoped;
  const legacy = await ctx.db
    .query("catalogVariants")
    .withIndex("by_product", (q: any) =>
      q.eq("productSupabaseId", productSupabaseId),
    )
    .collect();
  const seen = new Set(scoped.map((r: any) => r._id));
  return [
    ...scoped,
    ...legacy.filter((r: any) => r.orgId == null && !seen.has(r._id)),
  ];
}

async function orgActiveProducts(
  ctx: any,
  org: any,
  limit: number,
): Promise<any[]> {
  const scoped = await ctx.db
    .query("catalogProducts")
    .withIndex("by_org_active", (q: any) =>
      q.eq("orgId", org._id).eq("isActive", true),
    )
    .order("desc")
    .take(limit);
  if (org.slug !== "smokeshop") return scoped;
  const legacy = await ctx.db
    .query("catalogProducts")
    .withIndex("by_active_created", (q: any) => q.eq("isActive", true))
    .order("desc")
    .take(limit);
  const seen = new Set(scoped.map((r: any) => r._id));
  return [...scoped, ...legacy.filter((r: any) => r.orgId == null && !seen.has(r._id))]
    .sort((a: any, b: any) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .slice(0, limit);
}

export const listBrands = query({
  args: { orgSlug: v.string(), activeOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const rows = await collectInOrg(ctx, "catalogBrands", org);
    if (args.activeOnly === false) return rows.map(brandShape);
    return rows
      .filter((b: any) => b.isActive)
      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map(brandShape);
  },
});

export const getBrandBySlug = query({
  args: { orgSlug: v.string(), slug: v.string() },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const row = await findOrgDocBySlug(ctx, "catalogBrands", org, args.slug);
    return row ? brandShape(row) : null;
  },
});

export const listCategories = query({
  args: { orgSlug: v.string() },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    return (await collectInOrg(ctx, "catalogCategories", org)).map(
      categoryShape,
    );
  },
});

export const listProducts = query({
  args: {
    orgSlug: v.string(),
    limit: v.optional(v.number()),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    if (args.activeOnly === false) {
      const all = await collectInOrg(ctx, "catalogProducts", org);
      return all.slice(0, args.limit ?? 100).map(productShape);
    }
    const rows = await orgActiveProducts(ctx, org, args.limit ?? 100);
    return rows.map(productShape);
  },
});

export const getProductBySlug = query({
  args: { orgSlug: v.string(), slug: v.string() },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const product = await findOrgDocBySlug(
      ctx,
      "catalogProducts",
      org,
      args.slug,
    );
    if (!product) return null;
    const variants = await orgVariantsByProduct(ctx, org, product.supabaseId);
    let brand = null;
    if (product.brandSupabaseId) {
      const b = await findOrgDocBySupabase(
        ctx,
        "catalogBrands",
        org,
        product.brandSupabaseId as string,
      );
      if (b) brand = brandShape(b);
    }
    return {
      product: productShape(product),
      variants: await publicVariantShapes(ctx, org, variants),
      brand,
    };
  },
});

export const listVariantsByProduct = query({
  args: { orgSlug: v.string(), productSupabaseId: v.string() },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const rows = await orgVariantsByProduct(ctx, org, args.productSupabaseId);
    return await publicVariantShapes(ctx, org, rows);
  },
});

export const listCollections = query({
  args: { orgSlug: v.string() },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const rows = await collectInOrg(ctx, "catalogCollections", org);
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
  args: { orgSlug: v.string(), activeOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const rows = await collectInOrg(ctx, "catalogCombos", org);
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

// Verification helper: row counts per catalog table, scoped to the org.
export const catalogCounts = query({
  args: { orgSlug: v.string() },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
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
      const rows = await ctx.db
        .query(t)
        .withIndex("by_org", (q: any) => q.eq("orgId", org._id))
        .take(2000);
      let n = rows.length;
      if (org.slug === "smokeshop" && n < 2000) {
        const legacy = (await ctx.db.query(t).take(2000)).filter(
          (r: any) => r.orgId == null,
        );
        n += legacy.length;
        if (legacy.length === 2000) n = -1;
        else if (rows.length === 2000) n = -1;
      } else if (n === 2000) {
        n = -1;
      }
      out[t] = n;
    }
    return out;
  },
});

// ---------- TEMPORARY backfill (delete after Wave 3 verification) ----------
// Idempotent upserts keyed by (orgId, supabaseId) (joins: full replace per
// org per call). Driver script passes camelCase docs with ms timestamps;
// Supabase UUIDs ride along as supabaseId so joins rebuild exactly.
const optStr = (v: any) => (v === null || v === undefined ? undefined : v);
const optNum = (v: any) =>
  v === null || v === undefined || !Number.isFinite(Number(v))
    ? undefined
    : Number(v);

export const backfillCatalog = mutation({
  args: {
    orgSlug: v.string(),
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
    const { orgId } = await requireOrgAdminBySlug(ctx, args.orgSlug);
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
        .withIndex("by_org_supabase", (q) =>
          q.eq("orgId", orgId).eq("supabaseId", doc.supabaseId),
        )
        .unique();
      // Patch stamps orgId so legacy global rows heal into this org.
      if (ex) await ctx.db.patch(ex._id, { ...doc, orgId });
      else await ctx.db.insert(table, { ...doc, orgId });
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
    // Joins: delete-then-insert per org per call (backfill runs whole-table).
    if (args.productCategories !== undefined) {
      const existing = await ctx.db
        .query("catalogProductCategories")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect();
      for (const r of existing) await ctx.db.delete(r._id);
      for (const j of args.productCategories) {
        await ctx.db.insert("catalogProductCategories", {
          orgId,
          productSupabaseId: j.productSupabaseId,
          categorySupabaseId: j.categorySupabaseId,
          order: optNum(j.order),
        });
        counts.productCategories = (counts.productCategories ?? 0) + 1;
      }
    }
    if (args.collectionProducts !== undefined) {
      const existing = await ctx.db
        .query("catalogCollectionProducts")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect();
      for (const r of existing) await ctx.db.delete(r._id);
      for (const j of args.collectionProducts) {
        await ctx.db.insert("catalogCollectionProducts", {
          orgId,
          collectionSupabaseId: j.collectionSupabaseId,
          productSupabaseId: j.productSupabaseId,
          sortOrder: optNum(j.sortOrder),
        });
        counts.collectionProducts = (counts.collectionProducts ?? 0) + 1;
      }
    }
    if (args.comboItems !== undefined) {
      const existing = await ctx.db
        .query("catalogComboItems")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect();
      for (const r of existing) await ctx.db.delete(r._id);
      for (const j of args.comboItems) {
        await ctx.db.insert("catalogComboItems", {
          orgId,
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
// is data-source-only: templates stay untouched. All scoped by orgSlug.

async function brandNameBySupabaseId(ctx: any, org: any, brandSupabaseId?: string) {
  if (!brandSupabaseId) return null;
  const b = await findOrgDocBySupabase(ctx, "catalogBrands", org, brandSupabaseId);
  return b ? { name: b.name, slug: b.slug } : null;
}

// Sitemap: active products with images + updatedAt, categories, brands.
export const sitemapCatalog = query({
  args: { orgSlug: v.string() },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const products = (await orgActiveProducts(ctx, org, 5000)).filter(
      (p: any) => p.slug,
    );
    const withImages = [];
    for (const p of products) {
      const variants = await orgVariantsByProduct(ctx, org, p.supabaseId);
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
      await collectInOrg(ctx, "catalogCategories", org)
    ).map((c) => ({ slug: c.slug, updatedAt: c.updatedAt }));
    const brands = (
      await collectInOrg(ctx, "catalogBrands", org)
    )
      .filter((b: any) => b.isActive)
      .map((b) => ({ slug: b.slug, updatedAt: b.updatedAt }));
    return { products: withImages, categories, brands };
  },
});

// Related-product links for PDP prerender (same-brand first is done in the
// template; this returns the candidate pool with brand names).
export const relatedProductLinks = query({
  args: {
    orgSlug: v.string(),
    excludeSlug: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const rows = await orgActiveProducts(ctx, org, args.limit ?? 50);
    const out = [];
    for (const p of rows) {
      if (p.slug === args.excludeSlug) continue;
      const brand = await brandNameBySupabaseId(ctx, org, p.brandSupabaseId);
      out.push({ slug: p.slug, name: p.name, brandName: brand?.name ?? null });
    }
    return out;
  },
});

export const getCategoryDetail = query({
  args: { orgSlug: v.string(), slug: v.string() },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const category = await findOrgDocBySlug(
      ctx,
      "catalogCategories",
      org,
      args.slug,
    );
    if (!category) return null;
    const joins = await ctx.db
      .query("catalogProductCategories")
      .withIndex("by_org_category", (q) =>
        q.eq("orgId", org._id).eq("categorySupabaseId", category.supabaseId),
      )
      .take(20);
    const legacyJoins =
      org.slug === "smokeshop"
        ? (
            await ctx.db
              .query("catalogProductCategories")
              .withIndex("by_category", (q) =>
                q.eq("categorySupabaseId", category.supabaseId),
              )
              .take(20)
          ).filter((j: any) => j.orgId == null)
        : [];
    const seen = new Set(joins.map((j: any) => j.productSupabaseId));
    const allJoins = [
      ...joins,
      ...legacyJoins.filter((j: any) => !seen.has(j.productSupabaseId)),
    ].slice(0, 20);
    const products = [];
    for (const j of allJoins) {
      const p = await findOrgDocBySupabase(
        ctx,
        "catalogProducts",
        org,
        j.productSupabaseId,
      );
      if (p && p.isActive && p.slug) products.push({ slug: p.slug, name: p.name });
    }
    return { category: categoryShape(category), products };
  },
});

export const getBrandDetail = query({
  args: { orgSlug: v.string(), slug: v.string() },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const brand = await findOrgDocBySlug(ctx, "catalogBrands", org, args.slug);
    if (!brand || !brand.isActive) return null;
    const rows = await ctx.db
      .query("catalogProducts")
      .withIndex("by_org_brand_active", (q) =>
        q
          .eq("orgId", org._id)
          .eq("brandSupabaseId", brand.supabaseId)
          .eq("isActive", true),
      )
      .take(12);
    let list = rows;
    if (org.slug === "smokeshop" && list.length < 12) {
      const legacy = await ctx.db
        .query("catalogProducts")
        .withIndex("by_brand_active", (q) =>
          q.eq("brandSupabaseId", brand.supabaseId).eq("isActive", true),
        )
        .take(12);
      const seen = new Set(list.map((p: any) => p._id));
      list = [
        ...list,
        ...legacy.filter((p: any) => p.orgId == null && !seen.has(p._id)),
      ].slice(0, 12);
    }
    return {
      brand: brandShape(brand),
      products: list
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
  args: { orgSlug: v.string() },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const [products, variants, brands, categories, productCategories, combos, collections, collectionProducts] =
      await Promise.all([
        collectInOrg(ctx, "catalogProducts", org),
        collectInOrg(ctx, "catalogVariants", org),
        collectInOrg(ctx, "catalogBrands", org),
        collectInOrg(ctx, "catalogCategories", org),
        collectInOrg(ctx, "catalogProductCategories", org),
        collectInOrg(ctx, "catalogCombos", org),
        collectInOrg(ctx, "catalogCollections", org),
        collectInOrg(ctx, "catalogCollectionProducts", org),
      ]);
    return {
      products: products.map(productShape),
      variants: await publicVariantShapes(ctx, org, variants),
      brands: brands.map(brandShape),
      categories: categories.map(categoryShape),
      collections: collections.map((c) => ({
        supabaseId: c.supabaseId,
        title: c.title,
        slug: c.slug,
        description: c.description,
        imageUrl: c.imageUrl,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
      })),
      collectionProducts: collectionProducts.map((j) => ({
        collectionSupabaseId: j.collectionSupabaseId,
        productSupabaseId: j.productSupabaseId,
        sortOrder: j.sortOrder,
      })),
      productCategories: productCategories.map((j) => ({
        productSupabaseId: j.productSupabaseId,
        categorySupabaseId: j.categorySupabaseId,
        order: j.order,
      })),
      combos: combos.map((c) => ({
        supabaseId: c.supabaseId,
        name: c.name,
        slug: c.slug,
        description: c.description,
        comboPriceRupees: c.comboPriceRupees,
        galleryImages: c.galleryImages ?? [],
        isActive: c.isActive,
      })),
    };
  },
});

// Cart rehydration: lean server lines carry Supabase UUIDs; resolve them to
// the exact legacy row shapes (snake_case) so useCart logic is untouched.
export const productsBySupabaseIds = query({
  args: { orgSlug: v.string(), ids: v.array(v.string()) },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const out = [];
    for (const id of args.ids.slice(0, 100)) {
      const p = await findOrgDocBySupabase(ctx, "catalogProducts", org, id);
      if (!p || !inOrg(p, org)) continue;
      const variants = await orgVariantsByProduct(ctx, org, p.supabaseId);
      const brand = await brandNameBySupabaseId(ctx, org, p.brandSupabaseId);
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
  args: { orgSlug: v.string(), ids: v.array(v.string()) },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const out = [];
    for (const id of args.ids.slice(0, 100)) {
      const c = await findOrgDocBySupabase(ctx, "catalogCombos", org, id);
      if (c && inOrg(c, org))
        out.push({
          id: c.supabaseId,
          name: c.name,
          combo_price: c.comboPriceRupees,
        });
    }
    return out;
  },
});
