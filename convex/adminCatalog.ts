import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireIdentity } from "./lib/auth";
import { matchesRef, replaceDeepRefs, replaceEmbeddedRef, type UsageContext } from "./lib/imageRefs";

// ---------- Wave 5: catalog + content authorship (Supabase -> Convex) ----------
// Catalog/content tables are GLOBAL (no orgId). Writes are gated on owner or
// admin of ANY org — same pattern as appConfig.set. Reads stay public.
// Money in RUPEES (as in Supabase); paise only at the order boundary.
// Forms keep working with Supabase UUID strings: new rows mint a supabaseId
// via crypto.randomUUID(), joins key on those same strings.

async function requireCatalogAdmin(ctx: any) {
  const identity = await requireIdentity(ctx);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
    .filter((q: any) =>
      q.or(q.eq(q.field("role"), "owner"), q.eq(q.field("role"), "admin")),
    )
    .first();
  if (!membership) throw new ConvexError({ code: "NOT_CATALOG_ADMIN" });
  return identity;
}

async function assertSlugUnique(
  ctx: any,
  table: any,
  slug: string,
  exceptSupabaseId?: string,
) {
  const existing = await ctx.db
    .query(table)
    .withIndex("by_slug", (q: any) => q.eq("slug", slug))
    .unique();
  if (existing && existing.supabaseId !== exceptSupabaseId) {
    throw new ConvexError({ code: "SLUG_TAKEN", slug });
  }
}

async function findVariantInventoryBalance(ctx: any, variantSupabaseId: string) {
  return await ctx.db
    .query("inventoryBalances")
    .filter((q: any) => q.eq(q.field("variantSupabaseId"), variantSupabaseId))
    .first();
}

async function assertVariantHasNoInventoryHistory(ctx: any, variantSupabaseId: string) {
  const balance = await findVariantInventoryBalance(ctx, variantSupabaseId);
  if (balance) {
    throw new ConvexError({
      code: "VARIANT_HAS_INVENTORY_HISTORY",
      variantSupabaseId,
      message: "Deactivate this product instead. Variants with sales or stock history cannot be deleted.",
    });
  }
}

// Admin list view: products + variants + brand in one round trip.
// Public read like the rest of the catalog; writes above stay gated.
export const listProductsForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireCatalogAdmin(ctx);
    const products = await ctx.db.query("catalogProducts").collect();
    products.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    const brands = await ctx.db.query("catalogBrands").collect();
    const brandBySupabaseId = new Map(brands.map((b) => [b.supabaseId, b]));
    const out = [];
    for (const p of products) {
      const variants = await ctx.db
        .query("catalogVariants")
        .withIndex("by_product", (q) => q.eq("productSupabaseId", p.supabaseId))
        .collect();
      const brand = p.brandSupabaseId
        ? (brandBySupabaseId.get(p.brandSupabaseId) ?? null)
        : null;
      const catJoins = await ctx.db
        .query("catalogProductCategories")
        .withIndex("by_product", (q) => q.eq("productSupabaseId", p.supabaseId))
        .collect();
      const colJoins = await ctx.db
        .query("catalogCollectionProducts")
        .withIndex("by_product", (q) => q.eq("productSupabaseId", p.supabaseId))
        .collect();
      out.push({
        ...p,
        product_variants: variants,
        brand,
        categorySupabaseIds: catJoins.map((j) => j.categorySupabaseId),
        collectionSupabaseIds: colJoins.map((j) => j.collectionSupabaseId),
      });
    }
    return out;
  },
});

// Full R2 reference inventory. Tables are scanned field-by-field and
// repointImageRefs updates matching fields, including image URLs in order
// item snapshots. Embedded blog content and homepage/section config are
// replaced only for exact old URLs/keys.
// ponytail: full scans suit the current small catalog; add a reference index
// only when these collections approach Convex query limits.
async function imageRows(ctx: any) {
  const [products, variants, brands, categories, collections, combos, blogs, heroes, sections, components, sites, carts, orders] = await Promise.all([
    ctx.db.query("catalogProducts").collect(),
    ctx.db.query("catalogVariants").collect(),
    ctx.db.query("catalogBrands").collect(),
    ctx.db.query("catalogCategories").collect(),
    ctx.db.query("catalogCollections").collect(),
    ctx.db.query("catalogCombos").collect(),
    ctx.db.query("blogPosts").collect(),
    ctx.db.query("heroSlides").collect(),
    ctx.db.query("sectionConfigurations").collect(),
    ctx.db.query("homepageComponentConfig").collect(),
    ctx.db.query("siteSettings").collect(),
    ctx.db.query("carts").collect(),
    ctx.db.query("orders").collect(),
  ]);
  return { products, variants, brands, categories, collections, combos, blogs, heroes, sections, components, sites, carts, orders };
}

async function collectImageUsage(
  ctx: any,
  key: string,
  url?: string,
  rows?: Awaited<ReturnType<typeof imageRows>>,
): Promise<{ contexts: UsageContext[]; mutableTotal: number; historicalTotal: number }> {
  const r = rows ?? await imageRows(ctx);
  const hits = (s: unknown) => matchesRef(s, key, url);
  const contexts: UsageContext[] = [];
  let mutableTotal = 0;
  let historicalTotal = 0;
  const push = (c: UsageContext, count = 1) => {
    if (c.mutable) mutableTotal += count;
    else historicalTotal += count;
    if (contexts.length < 10) contexts.push(c);
  };

  const nameById = new Map(r.products.map((p: any) => [p.supabaseId, p.name]));
  for (const x of r.variants) {
    const count = (x.images || []).filter(hits).length;
    if (count)
      push({
        kind: "variant",
        label: nameById.get(x.productSupabaseId) ?? x.productSupabaseId,
        detail: x.variantName,
        mutable: true,
      }, count);
  }
  for (const b of r.brands) {
    if (hits(b.logoUrl)) push({ kind: "brand", label: b.name, detail: "logo", mutable: true });
  }
  for (const c of r.categories) {
    if (hits(c.image)) push({ kind: "category", label: c.name, detail: "image", mutable: true });
  }
  for (const c of r.collections) {
    if (hits(c.imageUrl)) push({ kind: "collection", label: c.title, detail: "image", mutable: true });
  }
  for (const c of r.combos) {
    if (hits(c.image)) push({ kind: "combo", label: c.name, detail: "image", mutable: true });
    const count = (c.galleryImages || []).filter(hits).length;
    if (count) push({ kind: "combo", label: c.name, detail: "gallery", mutable: true }, count);
  }
  for (const p of r.blogs) {
    if (hits(p.featuredImage))
      push({ kind: "blog", label: p.title, detail: "featured image", mutable: true });
    if (hits(p.ogImage)) push({ kind: "blog", label: p.title, detail: "og image", mutable: true });
    if (replaceEmbeddedRef(p.content, key, url, "") !== null)
      push({ kind: "blog", label: p.title, detail: "content", mutable: true });
  }
  for (const s of r.heroes) {
    for (const f of ["imageUrl", "mobileImageUrl", "productImageUrl", "smallImageUrl"] as const) {
      if (hits((s as any)[f]))
        push({ kind: "hero", label: s.title || "hero slide", detail: f, mutable: true });
    }
  }
  for (const s of r.sections) {
    if (hits(s.backgroundImage))
      push({ kind: "section", label: s.sectionName, detail: "background", mutable: true });
    if (replaceDeepRefs(s.config, key, url, "") !== null)
      push({ kind: "section", label: s.sectionName, detail: "config", mutable: true });
  }
  for (const site of r.sites) {
    if (hits(site.faviconUrl)) push({ kind: "site", label: "site settings", detail: "favicon", mutable: true });
  }
  for (const c of r.components) {
    if (replaceDeepRefs(c.config, key, url, "") !== null)
      push({ kind: "homepage-config", label: c.componentName, detail: "config", mutable: true });
  }
  for (const cart of r.carts) {
    if (hits(cart.imageUrl)) push({ kind: "cart", label: cart.name, detail: "cart image", mutable: true });
  }
  for (const o of r.orders) {
    const n = (o.items || []).filter((i: any) => hits(i.image)).length;
    if (n > 0) {
      push({ kind: "order", label: o.displayOrderId || "order", detail: `${n} item image(s)`, mutable: true }, n);
    }
  }
  return { contexts, mutableTotal, historicalTotal };
}

// Single-asset usage (kept for backward compat: usedBy/total shape + contexts).
export const imageUsage = query({
  args: { key: v.string(), url: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireCatalogAdmin(ctx);
    const { contexts, mutableTotal, historicalTotal } = await collectImageUsage(ctx, args.key, args.url);
    const usedBy = contexts
      .filter((c) => c.mutable && c.kind === "variant")
      .map((c) => ({ productName: c.label, variantName: c.detail ?? "" }));
    return { usedBy, total: mutableTotal + historicalTotal, mutableTotal, historicalTotal, contexts };
  },
});

// Batch inventory: one round trip for the whole asset grid (no N+1).
export const imageUsageBatch = query({
  args: { refs: v.array(v.object({ key: v.string(), url: v.optional(v.string()) })) },
  handler: async (ctx, { refs }) => {
    await requireCatalogAdmin(ctx);
    if (refs.length > 200) throw new ConvexError({ code: "BATCH_TOO_LARGE" });
    const rows = await imageRows(ctx);
    const out = [];
    for (const r of refs) {
      const { contexts, mutableTotal, historicalTotal } = await collectImageUsage(ctx, r.key, r.url, rows);
      out.push({ key: r.key, total: mutableTotal + historicalTotal, mutableTotal, historicalTotal, contexts });
    }
    return out;
  },
});

// Repoint every mutable reference from an old R2 URL/key to a reprocessed one.
// Old-value compare per field: concurrent edits that already changed a field
// are left untouched. Old originals stay in R2 for rollback and cleanup.
export const repointImageRefs = mutation({
  args: { oldKey: v.string(), oldUrl: v.optional(v.string()), newUrl: v.string() },
  handler: async (ctx, { oldKey, oldUrl, newUrl }) => {
    await requireCatalogAdmin(ctx);
    if (!oldKey.startsWith("asset_images/") || !newUrl.startsWith("https://cdn.cigarro.in/asset_images/"))
      throw new ConvexError({ code: "BAD_IMAGE_REFERENCE" });
    const hits = (s: unknown) => matchesRef(s, oldKey, oldUrl);
    const patched: Record<string, number> = {};
    const bump = (k: string) => {
      patched[k] = (patched[k] ?? 0) + 1;
    };
    const products = await ctx.db.query("catalogProducts").collect();
    const productNames = new Map(products.map((p) => [p.supabaseId, p.name]));
    for (const x of await ctx.db.query("catalogVariants").collect()) {
      const images = x.images || [];
      if (!images.some(hits)) continue;
      const productName = productNames.get(x.productSupabaseId);
      const imageAltText = x.imageAltText?.trim() || [productName, x.variantName].filter(Boolean).join(" ");
      await ctx.db.patch(x._id, {
        images: images.map((s: string) => (hits(s) ? newUrl : s)),
        ...(x.imageAltText?.trim() ? {} : { imageAltText }),
        updatedAt: Date.now(),
      });
      bump("variants");
    }
    const scalarTables: Array<{ table: any; fields: string[]; label: string }> = [
      { table: "catalogBrands", fields: ["logoUrl"], label: "brands" },
      { table: "catalogCategories", fields: ["image"], label: "categories" },
      { table: "catalogCollections", fields: ["imageUrl"], label: "collections" },
      { table: "catalogCombos", fields: ["image"], label: "combos" },
      { table: "blogPosts", fields: ["featuredImage", "ogImage"], label: "blogPosts" },
      {
        table: "heroSlides",
        fields: ["imageUrl", "mobileImageUrl", "productImageUrl", "smallImageUrl"],
        label: "heroSlides",
      },
      { table: "sectionConfigurations", fields: ["backgroundImage"], label: "sections" },
      { table: "siteSettings", fields: ["faviconUrl"], label: "siteSettings" },
    ];
    for (const { table, fields, label } of scalarTables) {
      for (const row of await ctx.db.query(table).collect()) {
        const patch: Record<string, string> = {};
        for (const f of fields) if (hits((row as any)[f])) patch[f] = newUrl;
        if (Object.keys(patch).length === 0) continue;
        await ctx.db.patch(row._id, patch);
        bump(label);
      }
    }
    for (const c of await ctx.db.query("catalogCombos").collect()) {
      const gallery = c.galleryImages || [];
      if (!gallery.some(hits)) continue;
      await ctx.db.patch(c._id, {
        galleryImages: gallery.map((s: string) => (hits(s) ? newUrl : s)),
        updatedAt: Date.now(),
      });
      bump("combosGallery");
    }
    for (const p of await ctx.db.query("blogPosts").collect()) {
      const content = replaceEmbeddedRef(p.content, oldKey, oldUrl, newUrl);
      if (content === null) continue;
      await ctx.db.patch(p._id, { content, updatedAt: Date.now() });
      bump("blogContent");
    }
    for (const s of await ctx.db.query("sectionConfigurations").collect()) {
      const config = replaceDeepRefs(s.config, oldKey, oldUrl, newUrl);
      if (config === null) continue;
      await ctx.db.patch(s._id, { config });
      bump("sectionConfig");
    }
    for (const c of await ctx.db.query("homepageComponentConfig").collect()) {
      const config = replaceDeepRefs(c.config, oldKey, oldUrl, newUrl);
      if (config === null) continue;
      await ctx.db.patch(c._id, { config });
      bump("homepageConfig");
    }
    for (const cart of await ctx.db.query("carts").collect()) {
      if (!hits(cart.imageUrl)) continue;
      await ctx.db.patch(cart._id, { imageUrl: newUrl, updatedAt: Date.now() });
      bump("carts");
    }
    for (const order of await ctx.db.query("orders").collect()) {
      if (!order.items.some((item) => hits(item.image))) continue;
      await ctx.db.patch(order._id, {
        items: order.items.map((item) => (hits(item.image) ? { ...item, image: newUrl } : item)),
      });
      bump("orders");
    }
    return { patched };
  },
});

// ---------------- Brands ----------------
// Admin brand list with product counts (replaces the products(count) join).
export const listBrandsForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireCatalogAdmin(ctx);
    const brands = await ctx.db.query("catalogBrands").collect();
    brands.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    const out = [];
    for (const b of brands) {
      // Convex has no count op: bounded take off the brand index. Catalogs
      // here are tens of rows — a materialized counter can come past ~1k.
      const prods = await ctx.db
        .query("catalogProducts")
        .withIndex("by_brand_active", (q) => q.eq("brandSupabaseId", b.supabaseId))
        .take(1000);
      out.push({ ...b, product_count: prods.length });
    }
    return out;
  },
});

export const setBrandsActive = mutation({
  args: { supabaseIds: v.array(v.string()), isActive: v.boolean() },
  handler: async (ctx, { supabaseIds, isActive }) => {
    await requireCatalogAdmin(ctx);
    for (const supabaseId of supabaseIds) {
      const row = await ctx.db
        .query("catalogBrands")
        .withIndex("by_supabase", (q) => q.eq("supabaseId", supabaseId))
        .unique();
      if (row) await ctx.db.patch(row._id, { isActive, updatedAt: Date.now() });
    }
    return { updated: supabaseIds.length };
  },
});

const brandV = {
  name: v.string(),
  slug: v.string(),
  description: v.optional(v.string()),
  logoUrl: v.optional(v.string()),
  websiteUrl: v.optional(v.string()),
  countryOfOrigin: v.optional(v.string()),
  heritage: v.optional(v.any()),
  isActive: v.boolean(),
  sortOrder: v.optional(v.number()),
  metaTitle: v.optional(v.string()),
  metaDescription: v.optional(v.string()),
};

export const createBrand = mutation({
  args: brandV,
  handler: async (ctx, args) => {
    await requireCatalogAdmin(ctx);
    if (!args.name.trim() || !args.slug.trim())
      throw new ConvexError({ code: "NAME_SLUG_REQUIRED" });
    await assertSlugUnique(ctx, "catalogBrands", args.slug.trim());
    const now = Date.now();
    const supabaseId = crypto.randomUUID();
    await ctx.db.insert("catalogBrands", {
      ...args,
      name: args.name.trim(),
      slug: args.slug.trim(),
      supabaseId,
      createdAt: now,
      updatedAt: now,
    });
    return { supabaseId };
  },
});

export const updateBrand = mutation({
  args: { supabaseId: v.string(), patch: v.object(brandV) },
  handler: async (ctx, { supabaseId, patch }) => {
    await requireCatalogAdmin(ctx);
    const row = await ctx.db
      .query("catalogBrands")
      .withIndex("by_supabase", (q) => q.eq("supabaseId", supabaseId))
      .unique();
    if (!row) throw new ConvexError({ code: "NOT_FOUND" });
    await assertSlugUnique(ctx, "catalogBrands", patch.slug.trim(), supabaseId);
    await ctx.db.patch(row._id, {
      ...patch,
      name: patch.name.trim(),
      slug: patch.slug.trim(),
      updatedAt: Date.now(),
    });
    return { supabaseId };
  },
});

export const deleteBrand = mutation({
  args: { supabaseId: v.string() },
  handler: async (ctx, { supabaseId }) => {
    await requireCatalogAdmin(ctx);
    const row = await ctx.db
      .query("catalogBrands")
      .withIndex("by_supabase", (q) => q.eq("supabaseId", supabaseId))
      .unique();
    if (!row) throw new ConvexError({ code: "NOT_FOUND" });
    const used = await ctx.db
      .query("catalogProducts")
      .withIndex("by_brand_active", (q) => q.eq("brandSupabaseId", supabaseId))
      .first();
    if (used) throw new ConvexError({ code: "BRAND_IN_USE" });
    await ctx.db.delete(row._id);
    return { deleted: true };
  },
});

// ---------------- Categories ----------------
// Admin category list with product counts + linked product ids (for the form's
// ProductSelector). isActive absent (pre-cutover rows) reads as active.
export const listCategoriesForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireCatalogAdmin(ctx);
    const categories = await ctx.db.query("catalogCategories").collect();
    categories.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    const out = [];
    for (const c of categories) {
      const joins = await ctx.db
        .query("catalogProductCategories")
        .withIndex("by_category", (q) => q.eq("categorySupabaseId", c.supabaseId))
        .collect();
      out.push({
        ...c,
        isActive: c.isActive ?? true,
        product_count: joins.length,
        productSupabaseIds: joins.map((j) => j.productSupabaseId),
      });
    }
    return out;
  },
});

export const setCategoriesActive = mutation({
  args: { supabaseIds: v.array(v.string()), isActive: v.boolean() },
  handler: async (ctx, { supabaseIds, isActive }) => {
    await requireCatalogAdmin(ctx);
    for (const supabaseId of supabaseIds) {
      const row = await ctx.db
        .query("catalogCategories")
        .withIndex("by_supabase", (q) => q.eq("supabaseId", supabaseId))
        .unique();
      if (row) await ctx.db.patch(row._id, { isActive, updatedAt: Date.now() });
    }
    return { updated: supabaseIds.length };
  },
});

export const setCategoryProducts = mutation({
  args: { supabaseId: v.string(), productSupabaseIds: v.array(v.string()) },
  handler: async (ctx, { supabaseId, productSupabaseIds }) => {
    await requireCatalogAdmin(ctx);
    const old = await ctx.db
      .query("catalogProductCategories")
      .withIndex("by_category", (q) => q.eq("categorySupabaseId", supabaseId))
      .collect();
    for (const j of old) await ctx.db.delete(j._id);
    for (const productSupabaseId of productSupabaseIds) {
      await ctx.db.insert("catalogProductCategories", {
        categorySupabaseId: supabaseId,
        productSupabaseId,
      });
    }
    return { ok: true };
  },
});

const categoryV = {
  name: v.string(),
  slug: v.string(),
  description: v.optional(v.string()),
  image: v.optional(v.string()),
  imageAltText: v.optional(v.string()),
  metaTitle: v.optional(v.string()),
  metaDescription: v.optional(v.string()),
};

export const createCategory = mutation({
  args: categoryV,
  handler: async (ctx, args) => {
    await requireCatalogAdmin(ctx);
    if (!args.name.trim() || !args.slug.trim())
      throw new ConvexError({ code: "NAME_SLUG_REQUIRED" });
    await assertSlugUnique(ctx, "catalogCategories", args.slug.trim());
    const now = Date.now();
    const supabaseId = crypto.randomUUID();
    await ctx.db.insert("catalogCategories", {
      ...args,
      name: args.name.trim(),
      slug: args.slug.trim(),
      supabaseId,
      createdAt: now,
      updatedAt: now,
    });
    return { supabaseId };
  },
});

export const updateCategory = mutation({
  args: { supabaseId: v.string(), patch: v.object(categoryV) },
  handler: async (ctx, { supabaseId, patch }) => {
    await requireCatalogAdmin(ctx);
    const row = await ctx.db
      .query("catalogCategories")
      .withIndex("by_supabase", (q) => q.eq("supabaseId", supabaseId))
      .unique();
    if (!row) throw new ConvexError({ code: "NOT_FOUND" });
    await assertSlugUnique(ctx, "catalogCategories", patch.slug.trim(), supabaseId);
    await ctx.db.patch(row._id, {
      ...patch,
      name: patch.name.trim(),
      slug: patch.slug.trim(),
      updatedAt: Date.now(),
    });
    return { supabaseId };
  },
});

export const deleteCategory = mutation({
  args: { supabaseId: v.string() },
  handler: async (ctx, { supabaseId }) => {
    await requireCatalogAdmin(ctx);
    const row = await ctx.db
      .query("catalogCategories")
      .withIndex("by_supabase", (q) => q.eq("supabaseId", supabaseId))
      .unique();
    if (!row) throw new ConvexError({ code: "NOT_FOUND" });
    const joins = await ctx.db
      .query("catalogProductCategories")
      .withIndex("by_category", (q) => q.eq("categorySupabaseId", supabaseId))
      .collect();
    for (const j of joins) await ctx.db.delete(j._id);
    await ctx.db.delete(row._id);
    return { deleted: true };
  },
});

// ---------------- Products (+ variants + joins, one mutation) ----------------

const variantV = {
  supabaseId: v.optional(v.string()),
  variantName: v.string(),
  variantSlug: v.optional(v.string()),
  variantType: v.optional(v.string()),
  unitsContained: v.optional(v.number()),
  unit: v.optional(v.string()),
  images: v.optional(v.array(v.string())),
  imageAltText: v.optional(v.string()),
  priceRupees: v.number(),
  compareAtPriceRupees: v.optional(v.number()),
  costPriceRupees: v.optional(v.number()),
  stock: v.optional(v.number()),
  trackInventory: v.optional(v.boolean()),
  isDefault: v.optional(v.boolean()),
  isActive: v.boolean(),
};

const productV = {
  name: v.string(),
  slug: v.string(),
  brandSupabaseId: v.optional(v.string()),
  description: v.optional(v.string()),
  shortDescription: v.optional(v.string()),
  origin: v.optional(v.string()),
  specifications: v.optional(v.any()),
  isActive: v.boolean(),
  metaTitle: v.optional(v.string()),
  metaDescription: v.optional(v.string()),
  canonicalUrl: v.optional(v.string()),
  ratingValue: v.optional(v.number()),
  reviewCount: v.optional(v.number()),
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const saveProduct = mutation({
  args: {
    supabaseId: v.optional(v.string()),
    product: v.object(productV),
    variants: v.array(v.object(variantV)),
    deletedVariantSupabaseIds: v.optional(v.array(v.string())),
    categorySupabaseIds: v.optional(v.array(v.string())),
    collectionSupabaseIds: v.optional(v.array(v.string())),
  },
  handler: async (
    ctx,
    {
      supabaseId,
      product,
      variants,
      deletedVariantSupabaseIds = [],
      categorySupabaseIds = [],
      collectionSupabaseIds = [],
    },
  ) => {
    await requireCatalogAdmin(ctx);
    if (!product.name.trim()) throw new ConvexError({ code: "NAME_REQUIRED" });
    if (!variants.some((x) => x.isDefault))
      throw new ConvexError({ code: "DEFAULT_VARIANT_REQUIRED" });
    const def = variants.find((x) => x.isDefault)!;
    if (!(def.priceRupees > 0))
      throw new ConvexError({ code: "DEFAULT_PRICE_REQUIRED" });

    const now = Date.now();
    let productSupabaseId = supabaseId;
    if (productSupabaseId) {
      const row = await ctx.db
        .query("catalogProducts")
        .withIndex("by_supabase", (q) => q.eq("supabaseId", productSupabaseId!))
        .unique();
      if (!row) throw new ConvexError({ code: "NOT_FOUND" });
      await assertSlugUnique(ctx, "catalogProducts", product.slug.trim(), productSupabaseId);
      await ctx.db.patch(row._id, {
        ...product,
        name: product.name.trim(),
        slug: product.slug.trim(),
        updatedAt: now,
      });
    } else {
      await assertSlugUnique(ctx, "catalogProducts", product.slug.trim());
      productSupabaseId = crypto.randomUUID();
      await ctx.db.insert("catalogProducts", {
        ...product,
        name: product.name.trim(),
        slug: product.slug.trim(),
        supabaseId: productSupabaseId,
        createdAt: now,
        updatedAt: now,
      });
    }
    const pid = productSupabaseId!;

    for (const delId of deletedVariantSupabaseIds) {
      const vrow = await ctx.db
        .query("catalogVariants")
        .withIndex("by_supabase", (q) => q.eq("supabaseId", delId))
        .unique();
      if (vrow) {
        await assertVariantHasNoInventoryHistory(ctx, vrow.supabaseId);
        await ctx.db.delete(vrow._id);
      }
    }
    for (const variant of variants) {
      const doc = {
        ...variant,
        variantSlug: variant.variantSlug?.trim() || slugify(variant.variantName),
        productSupabaseId: pid,
        updatedAt: now,
      };
      if (variant.supabaseId) {
        const vrow = await ctx.db
          .query("catalogVariants")
          .withIndex("by_supabase", (q) => q.eq("supabaseId", variant.supabaseId!))
          .unique();
        if (vrow) {
          // Once the inventory ledger has initialized this variant, stock is
          // managed only by inventory mutations. Product edits/imports must
          // not silently overwrite an audited balance.
          const balance = await findVariantInventoryBalance(ctx, vrow.supabaseId);
          await ctx.db.patch(vrow._id, balance ? { ...doc, stock: vrow.stock } : doc);
        }
        else
          await ctx.db.insert("catalogVariants", {
            ...doc,
            supabaseId: variant.supabaseId,
            createdAt: now,
          });
      } else {
        await ctx.db.insert("catalogVariants", {
          ...doc,
          supabaseId: crypto.randomUUID(),
          createdAt: now,
        });
      }
    }

    const oldCat = await ctx.db
      .query("catalogProductCategories")
      .withIndex("by_product", (q) => q.eq("productSupabaseId", pid))
      .collect();
    for (const j of oldCat) await ctx.db.delete(j._id);
    for (const categorySupabaseId of categorySupabaseIds) {
      await ctx.db.insert("catalogProductCategories", {
        productSupabaseId: pid,
        categorySupabaseId,
      });
    }

    const oldCol = await ctx.db
      .query("catalogCollectionProducts")
      .withIndex("by_product", (q) => q.eq("productSupabaseId", pid))
      .collect();
    for (const j of oldCol) await ctx.db.delete(j._id);
    for (const collectionSupabaseId of collectionSupabaseIds) {
      await ctx.db.insert("catalogCollectionProducts", {
        collectionSupabaseId,
        productSupabaseId: pid,
      });
    }
    return { supabaseId: pid };
  },
});

export const deleteProduct = mutation({
  args: { supabaseId: v.string() },
  handler: async (ctx, { supabaseId }) => {
    await requireCatalogAdmin(ctx);
    const row = await ctx.db
      .query("catalogProducts")
      .withIndex("by_supabase", (q) => q.eq("supabaseId", supabaseId))
      .unique();
    if (!row) throw new ConvexError({ code: "NOT_FOUND" });
    const variants = await ctx.db
      .query("catalogVariants")
      .withIndex("by_product", (q) => q.eq("productSupabaseId", supabaseId))
      .collect();
    for (const r of variants) await assertVariantHasNoInventoryHistory(ctx, r.supabaseId);
    for (const r of variants) await ctx.db.delete(r._id);
    for (const table of ["catalogProductCategories", "catalogCollectionProducts"] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_product", (q: any) => q.eq("productSupabaseId", supabaseId))
        .collect();
      for (const r of rows) await ctx.db.delete(r._id);
    }
    await ctx.db.delete(row._id);
    return { deleted: true };
  },
});

export const setProductsActive = mutation({
  args: { supabaseIds: v.array(v.string()), isActive: v.boolean() },
  handler: async (ctx, { supabaseIds, isActive }) => {
    await requireCatalogAdmin(ctx);
    for (const supabaseId of supabaseIds) {
      const row = await ctx.db
        .query("catalogProducts")
        .withIndex("by_supabase", (q) => q.eq("supabaseId", supabaseId))
        .unique();
      if (row) await ctx.db.patch(row._id, { isActive, updatedAt: Date.now() });
    }
    return { updated: supabaseIds.length };
  },
});

// Edit-form loader: product + variants + join ids (mirrors the old 3-query load).
export const getProductForEdit = query({
  args: { supabaseId: v.string() },
  handler: async (ctx, { supabaseId }) => {
    await requireCatalogAdmin(ctx);
    const product = await ctx.db
      .query("catalogProducts")
      .withIndex("by_supabase", (q) => q.eq("supabaseId", supabaseId))
      .unique();
    if (!product) return null;
    const variants = await ctx.db
      .query("catalogVariants")
      .withIndex("by_product", (q) => q.eq("productSupabaseId", supabaseId))
      .collect();
    const catJoins = await ctx.db
      .query("catalogProductCategories")
      .withIndex("by_product", (q) => q.eq("productSupabaseId", supabaseId))
      .collect();
    const colJoins = await ctx.db
      .query("catalogCollectionProducts")
      .withIndex("by_product", (q) => q.eq("productSupabaseId", supabaseId))
      .collect();
    return {
      product,
      variants,
      categorySupabaseIds: catJoins.map((j) => j.categorySupabaseId),
      collectionSupabaseIds: colJoins.map((j) => j.collectionSupabaseId),
    };
  },
});

// ---------------- Collections ----------------
// Admin collection list with linked product ids (for the form's selector).
export const listCollectionsForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireCatalogAdmin(ctx);
    const collections = await ctx.db.query("catalogCollections").collect();
    collections.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    const out = [];
    for (const c of collections) {
      const joins = await ctx.db
        .query("catalogCollectionProducts")
        .withIndex("by_collection", (q) => q.eq("collectionSupabaseId", c.supabaseId))
        .collect();
      out.push({
        ...c,
        product_count: joins.length,
        productSupabaseIds: joins.map((j) => j.productSupabaseId),
      });
    }
    return out;
  },
});

export const setCollectionsActive = mutation({
  args: { supabaseIds: v.array(v.string()), isActive: v.boolean() },
  handler: async (ctx, { supabaseIds, isActive }) => {
    await requireCatalogAdmin(ctx);
    for (const supabaseId of supabaseIds) {
      const row = await ctx.db
        .query("catalogCollections")
        .withIndex("by_supabase", (q) => q.eq("supabaseId", supabaseId))
        .unique();
      if (row) await ctx.db.patch(row._id, { isActive, updatedAt: Date.now() });
    }
    return { updated: supabaseIds.length };
  },
});

const collectionV = {
  title: v.string(),
  slug: v.string(),
  description: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  type: v.optional(v.string()),
  rules: v.optional(v.any()),
  sortOrder: v.optional(v.number()),
  isActive: v.boolean(),
  seoTitle: v.optional(v.string()),
  seoDescription: v.optional(v.string()),
};

export const saveCollection = mutation({
  args: {
    supabaseId: v.optional(v.string()),
    collection: v.object(collectionV),
    productSupabaseIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { supabaseId, collection, productSupabaseIds }) => {
    await requireCatalogAdmin(ctx);
    if (!collection.title.trim() || !collection.slug.trim())
      throw new ConvexError({ code: "TITLE_SLUG_REQUIRED" });
    const now = Date.now();
    let cid = supabaseId;
    if (cid) {
      const row = await ctx.db
        .query("catalogCollections")
        .withIndex("by_supabase", (q) => q.eq("supabaseId", cid!))
        .unique();
      if (!row) throw new ConvexError({ code: "NOT_FOUND" });
      await assertSlugUnique(ctx, "catalogCollections", collection.slug.trim(), cid);
      await ctx.db.patch(row._id, {
        ...collection,
        title: collection.title.trim(),
        slug: collection.slug.trim(),
        updatedAt: now,
      });
    } else {
      await assertSlugUnique(ctx, "catalogCollections", collection.slug.trim());
      cid = crypto.randomUUID();
      await ctx.db.insert("catalogCollections", {
        ...collection,
        title: collection.title.trim(),
        slug: collection.slug.trim(),
        supabaseId: cid,
        createdAt: now,
        updatedAt: now,
      });
    }
    if (productSupabaseIds !== undefined) {
      const old = await ctx.db
        .query("catalogCollectionProducts")
        .withIndex("by_collection", (q) => q.eq("collectionSupabaseId", cid!))
        .collect();
      for (const j of old) await ctx.db.delete(j._id);
      // Insert order = admin picker order (selection click order); the
      // storefront sorts by sortOrder, so persist the index.
      let order = 0;
      for (const productSupabaseId of productSupabaseIds) {
        await ctx.db.insert("catalogCollectionProducts", {
          collectionSupabaseId: cid!,
          productSupabaseId,
          sortOrder: order++,
        });
      }
    }
    return { supabaseId: cid! };
  },
});

export const deleteCollection = mutation({
  args: { supabaseId: v.string() },
  handler: async (ctx, { supabaseId }) => {
    await requireCatalogAdmin(ctx);
    const row = await ctx.db
      .query("catalogCollections")
      .withIndex("by_supabase", (q) => q.eq("supabaseId", supabaseId))
      .unique();
    if (!row) throw new ConvexError({ code: "NOT_FOUND" });
    const joins = await ctx.db
      .query("catalogCollectionProducts")
      .withIndex("by_collection", (q) => q.eq("collectionSupabaseId", supabaseId))
      .collect();
    for (const j of joins) await ctx.db.delete(j._id);
    // Clear homepage links pointing at the deleted collection so sections
    // fall back to latest products instead of a stale id.
    const linked = await ctx.db
      .query("homepageComponentConfig")
      .collect();
    for (const c of linked) {
      if (c.sectionId === supabaseId) await ctx.db.patch(c._id, { sectionId: undefined });
    }
    await ctx.db.delete(row._id);
    return { deleted: true };
  },
});

// ---------------- Combos ----------------

const comboV = {
  name: v.string(),
  slug: v.string(),
  description: v.optional(v.string()),
  comboPriceRupees: v.number(),
  originalPriceRupees: v.optional(v.number()),
  discountPercentage: v.optional(v.number()),
  image: v.optional(v.string()),
  galleryImages: v.optional(v.array(v.string())),
  isActive: v.boolean(),
};

export const saveCombo = mutation({
  args: {
    supabaseId: v.optional(v.string()),
    combo: v.object(comboV),
    items: v.optional(
      v.array(
        v.object({
          variantSupabaseId: v.string(),
          quantity: v.number(),
          sortOrder: v.optional(v.number()),
        }),
      ),
    ),
  },
  handler: async (ctx, { supabaseId, combo, items }) => {
    await requireCatalogAdmin(ctx);
    if (!combo.name.trim() || !combo.slug.trim())
      throw new ConvexError({ code: "NAME_SLUG_REQUIRED" });
    const now = Date.now();
    let cid = supabaseId;
    if (cid) {
      const row = await ctx.db
        .query("catalogCombos")
        .withIndex("by_supabase", (q) => q.eq("supabaseId", cid!))
        .unique();
      if (!row) throw new ConvexError({ code: "NOT_FOUND" });
      await assertSlugUnique(ctx, "catalogCombos", combo.slug.trim(), cid);
      await ctx.db.patch(row._id, {
        ...combo,
        name: combo.name.trim(),
        slug: combo.slug.trim(),
        updatedAt: now,
      });
    } else {
      await assertSlugUnique(ctx, "catalogCombos", combo.slug.trim());
      cid = crypto.randomUUID();
      await ctx.db.insert("catalogCombos", {
        ...combo,
        name: combo.name.trim(),
        slug: combo.slug.trim(),
        supabaseId: cid,
        createdAt: now,
        updatedAt: now,
      });
    }
    if (items !== undefined) {
      const old = await ctx.db
        .query("catalogComboItems")
        .withIndex("by_combo", (q) => q.eq("comboSupabaseId", cid!))
        .collect();
      for (const j of old) await ctx.db.delete(j._id);
      for (const item of items) {
        await ctx.db.insert("catalogComboItems", {
          comboSupabaseId: cid!,
          ...item,
        });
      }
    }
    return { supabaseId: cid! };
  },
});

export const deleteCombo = mutation({
  args: { supabaseId: v.string() },
  handler: async (ctx, { supabaseId }) => {
    await requireCatalogAdmin(ctx);
    const row = await ctx.db
      .query("catalogCombos")
      .withIndex("by_supabase", (q) => q.eq("supabaseId", supabaseId))
      .unique();
    if (!row) throw new ConvexError({ code: "NOT_FOUND" });
    const items = await ctx.db
      .query("catalogComboItems")
      .withIndex("by_combo", (q) => q.eq("comboSupabaseId", supabaseId))
      .collect();
    for (const j of items) await ctx.db.delete(j._id);
    await ctx.db.delete(row._id);
    return { deleted: true };
  },
});

// ---------------- Content ----------------
// Admin blog list: ALL statuses (public query is published-only), newest
// first, with category name/color resolved for the table badge.
export const listBlogPostsForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireCatalogAdmin(ctx);
    const posts = await ctx.db.query("blogPosts").collect();
    posts.sort((a, b) => (b.publishedAt ?? b.updatedAt ?? 0) - (a.publishedAt ?? a.updatedAt ?? 0));
    const cats = await ctx.db.query("blogCategories").collect();
    const catBySlug = new Map(cats.map((c) => [c.slug, c]));
    return posts.map((p) => ({
      ...p,
      category: p.categorySlug
        ? (() => {
            const c = catBySlug.get(p.categorySlug!);
            return c ? { name: c.name, color: c.color } : null;
          })()
        : null,
    }));
  },
});

export const setBlogPostsStatus = mutation({
  args: { ids: v.array(v.id("blogPosts")), status: v.string() },
  handler: async (ctx, { ids, status }) => {
    await requireCatalogAdmin(ctx);
    if (!["draft", "published", "archived"].includes(status))
      throw new ConvexError({ code: "BAD_STATUS" });
    const now = Date.now();
    for (const id of ids) {
      const row = await ctx.db.get(id);
      if (!row) continue;
      await ctx.db.patch(id, {
        status,
        publishedAt: status === "published" ? (row.publishedAt ?? now) : row.publishedAt,
        updatedAt: now,
      });
    }
    return { updated: ids.length };
  },
});

// Admin hero list: ALL slides (public query is active-only), sort order.
export const listHeroSlidesForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireCatalogAdmin(ctx);
    const rows = await ctx.db.query("heroSlides").collect();
    rows.sort((a, b) => a.sortOrder - b.sortOrder);
    return rows;
  },
});

// Content rows carry no supabaseId (Wave 2 backfill didn't keep one), so
// updates key on the Convex _id — Wave 6 forms read from Convex and get it.

export const saveBlogPost = mutation({
  args: {
    id: v.optional(v.id("blogPosts")),
    post: v.object({
      slug: v.string(),
      title: v.string(),
      excerpt: v.optional(v.string()),
      content: v.string(),
      featuredImage: v.optional(v.string()),
      status: v.string(),
      authorName: v.optional(v.string()),
      categorySlug: v.optional(v.string()),
      readingTime: v.optional(v.number()),
      metaTitle: v.optional(v.string()),
      metaDescription: v.optional(v.string()),
      ogTitle: v.optional(v.string()),
      ogDescription: v.optional(v.string()),
      ogImage: v.optional(v.string()),
      canonicalUrl: v.optional(v.string()),
      isFeatured: v.optional(v.boolean()),
      isPinned: v.optional(v.boolean()),
      sortOrder: v.optional(v.number()),
    }),
  },
  handler: async (ctx, { id, post }) => {
    await requireCatalogAdmin(ctx);
    if (!post.title.trim() || !post.slug.trim())
      throw new ConvexError({ code: "TITLE_SLUG_REQUIRED" });
    // ponytail: like/view counts are reader-derived, never admin inputs.
    const now = Date.now();
    if (id) {
      const row = await ctx.db.get(id);
      if (!row) throw new ConvexError({ code: "NOT_FOUND" });
      const clash = await ctx.db
        .query("blogPosts")
        .withIndex("by_slug", (q) => q.eq("slug", post.slug.trim()))
        .unique();
      if (clash && clash._id !== id) throw new ConvexError({ code: "SLUG_TAKEN" });
      await ctx.db.patch(id, {
        ...post,
        authorName: post.authorName ?? row.authorName,
        title: post.title.trim(),
        slug: post.slug.trim(),
        publishedAt: post.status === "published" ? (row.publishedAt ?? now) : undefined,
        updatedAt: now,
      });
      return { id };
    }
    await assertSlugUnique(ctx, "blogPosts", post.slug.trim());
    const newId = await ctx.db.insert("blogPosts", {
      ...post,
      authorName: post.authorName ?? "Cigarro",
      title: post.title.trim(),
      slug: post.slug.trim(),
      likeCount: 0,
      viewCount: 0,
      publishedAt: post.status === "published" ? now : undefined,
      updatedAt: now,
    });
    return { id: newId };
  },
});

export const deleteBlogPost = mutation({
  args: { id: v.id("blogPosts") },
  handler: async (ctx, { id }) => {
    await requireCatalogAdmin(ctx);
    const row = await ctx.db.get(id);
    if (!row) throw new ConvexError({ code: "NOT_FOUND" });
    await ctx.db.delete(id);
    return { deleted: true };
  },
});

export const saveBlogCategory = mutation({
  args: {
    id: v.optional(v.id("blogCategories")),
    category: v.object({
      slug: v.string(),
      name: v.string(),
      color: v.optional(v.string()),
      description: v.optional(v.string()),
      isActive: v.boolean(),
      sortOrder: v.optional(v.number()),
    }),
  },
  handler: async (ctx, { id, category }) => {
    await requireCatalogAdmin(ctx);
    const clash = await ctx.db
      .query("blogCategories")
      .withIndex("by_slug", (q) => q.eq("slug", category.slug.trim()))
      .unique();
    if (clash && clash._id !== id) throw new ConvexError({ code: "SLUG_TAKEN" });
    if (id) {
      const row = await ctx.db.get(id);
      if (!row) throw new ConvexError({ code: "NOT_FOUND" });
      await ctx.db.patch(id, category);
      return { id };
    }
    const newId = await ctx.db.insert("blogCategories", category);
    return { id: newId };
  },
});

export const deleteBlogCategory = mutation({
  args: { id: v.id("blogCategories") },
  handler: async (ctx, { id }) => {
    await requireCatalogAdmin(ctx);
    const row = await ctx.db.get(id);
    if (!row) throw new ConvexError({ code: "NOT_FOUND" });
    await ctx.db.delete(id);
    return { deleted: true };
  },
});

export const saveHeroSlide = mutation({
  args: {
    id: v.optional(v.id("heroSlides")),
    slide: v.object({
      title: v.optional(v.string()),
      subtitle: v.optional(v.string()),
      suptitle: v.optional(v.string()),
      description: v.optional(v.string()),
      buttonText: v.optional(v.string()),
      buttonUrl: v.optional(v.string()),
      buttonStyle: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      mobileImageUrl: v.optional(v.string()),
      productImageUrl: v.optional(v.string()),
      productName: v.optional(v.string()),
      productPrice: v.optional(v.number()),
      smallImageUrl: v.optional(v.string()),
      overlayOpacity: v.optional(v.number()),
      textColor: v.optional(v.string()),
      textPosition: v.optional(v.string()),
      sortOrder: v.number(),
      isActive: v.boolean(),
    }),
  },
  handler: async (ctx, { id, slide }) => {
    await requireCatalogAdmin(ctx);
    if (id) {
      const row = await ctx.db.get(id);
      if (!row) throw new ConvexError({ code: "NOT_FOUND" });
      await ctx.db.patch(id, slide);
      return { id };
    }
    const newId = await ctx.db.insert("heroSlides", slide);
    return { id: newId };
  },
});

export const deleteHeroSlide = mutation({
  args: { id: v.id("heroSlides") },
  handler: async (ctx, { id }) => {
    await requireCatalogAdmin(ctx);
    const row = await ctx.db.get(id);
    if (!row) throw new ConvexError({ code: "NOT_FOUND" });
    await ctx.db.delete(id);
    return { deleted: true };
  },
});

export const saveSectionConfig = mutation({
  args: {
    sectionName: v.string(),
    patch: v.object({
      title: v.optional(v.string()),
      subtitle: v.optional(v.string()),
      description: v.optional(v.string()),
      backgroundImage: v.optional(v.string()),
      buttonText: v.optional(v.string()),
      buttonUrl: v.optional(v.string()),
      config: v.optional(v.any()),
      maxItems: v.optional(v.number()),
      isEnabled: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, { sectionName, patch }) => {
    await requireCatalogAdmin(ctx);
    const row = await ctx.db
      .query("sectionConfigurations")
      .withIndex("by_name", (q) => q.eq("sectionName", sectionName))
      .unique();
    if (row) await ctx.db.patch(row._id, patch);
    else await ctx.db.insert("sectionConfigurations", { sectionName, ...patch });
    return { ok: true };
  },
});

export const saveHomepageComponent = mutation({
  args: {
    componentName: v.string(),
    patch: v.object({
      config: v.optional(v.any()),
      isEnabled: v.optional(v.boolean()),
      displayOrder: v.optional(v.number()),
      // null clears the link (undefined keys are stripped by the client
      // transport, so unlink must send an explicit null).
      sectionId: v.optional(v.union(v.string(), v.null())),
    }),
  },
  handler: async (ctx, { componentName, patch }) => {
    await requireCatalogAdmin(ctx);
    const row = await ctx.db
      .query("homepageComponentConfig")
      .withIndex("by_component", (q) => q.eq("componentName", componentName))
      .unique();
    // Normalize: null/"" = unlink (unset), undefined = leave untouched.
    const { sectionId, ...rest } = patch;
    const dbPatch: any = {
      ...rest,
      displayOrder: patch.displayOrder ?? row?.displayOrder ?? 0,
    };
    if (sectionId === null || sectionId === "") dbPatch.sectionId = undefined;
    else if (sectionId !== undefined) dbPatch.sectionId = sectionId;
    if (row) {
      await ctx.db.patch(row._id, dbPatch);
    } else {
      await ctx.db.insert("homepageComponentConfig", {
        componentName,
        config: patch.config,
        isEnabled: patch.isEnabled ?? true,
        displayOrder: patch.displayOrder ?? 0,
        sectionId:
          sectionId === null || sectionId === "" || sectionId === undefined
            ? undefined
            : sectionId,
      });
    }
    return { ok: true };
  },
});

export const saveSiteSettings = mutation({
  args: {
    siteName: v.optional(v.string()),
    metaTitle: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    faviconUrl: v.optional(v.string()),
    activeTheme: v.optional(v.string()),
    upiId: v.optional(v.string()),
    shippingConfig: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await requireCatalogAdmin(ctx);
    const row = await ctx.db
      .query("siteSettings")
      .withIndex("by_key", (q) => q.eq("key", "main"))
      .unique();
    const patch = {
      ...args,
      updatedAt: Date.now(),
      updatedBy: identity.subject,
    };
    if (row) await ctx.db.patch(row._id, patch);
    else await ctx.db.insert("siteSettings", { key: "main", ...patch });
    return { ok: true };
  },
});
