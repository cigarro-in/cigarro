import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import {
  collectInOrg,
  findOrgDocBySupabase,
  inOrg,
  requireOrgAdminBySlug,
} from "./lib/org";
import { matchesRef, replaceDeepRefs, replaceEmbeddedRef, type UsageContext } from "./lib/imageRefs";

// ---------- Wave 5: catalog + content authorship (Supabase -> Convex) ----------
// Catalog/content tables are ORG-SCOPED. Every read/write takes orgSlug,
// resolves it via organizations by_slug, and touches only that org's rows.
// Writes are gated on owner/admin of THAT org (never "admin of any org").
// Money in RUPEES (as in Supabase); paise only at the order boundary.
// Forms keep working with Supabase UUID strings: new rows mint a supabaseId
// via crypto.randomUUID(), joins key on those same strings (scoped per org).

// Slug clash scoped to the org (+ legacy null-orgId rows for smokeshop).
async function assertOrgSlugUnique(
  ctx: any,
  org: any,
  table: any,
  slug: string,
  except?: { id?: any; supabaseId?: string },
) {
  const scoped = await ctx.db
    .query(table)
    .withIndex("by_org_slug", (q: any) => q.eq("orgId", org._id).eq("slug", slug))
    .unique();
  if (
    scoped &&
    scoped._id !== except?.id &&
    scoped.supabaseId !== except?.supabaseId
  ) {
    throw new ConvexError({ code: "SLUG_TAKEN", slug });
  }
  if (org.slug !== "smokeshop") return;
  const legacy = await ctx.db
    .query(table)
    .withIndex("by_slug", (q: any) => q.eq("slug", slug))
    .collect();
  const clash = legacy.find(
    (r: any) =>
      r.orgId == null &&
      r._id !== except?.id &&
      r.supabaseId !== except?.supabaseId,
  );
  if (clash) throw new ConvexError({ code: "SLUG_TAKEN", slug });
}

async function findVariantInventoryBalance(
  ctx: any,
  orgId: any,
  variantSupabaseId: string,
) {
  return await ctx.db
    .query("inventoryBalances")
    .withIndex("by_org_variant", (q: any) =>
      q.eq("orgId", orgId).eq("variantSupabaseId", variantSupabaseId),
    )
    .unique();
}

async function assertVariantHasNoInventoryHistory(
  ctx: any,
  orgId: any,
  variantSupabaseId: string,
) {
  const balance = await findVariantInventoryBalance(ctx, orgId, variantSupabaseId);
  if (balance) {
    throw new ConvexError({
      code: "VARIANT_HAS_INVENTORY_HISTORY",
      variantSupabaseId,
      message: "Deactivate this product instead. Variants with sales or stock history cannot be deleted.",
    });
  }
}

// Join rows for one side of a join, scoped to the org (+ legacy null-orgId
// rows for smokeshop, which callers delete + reinsert with orgId to heal).
async function orgJoinRows(
  ctx: any,
  org: any,
  table: any,
  orgIndex: string,
  legacyIndex: string,
  field: string,
  value: string,
): Promise<any[]> {
  const scoped = await ctx.db
    .query(table)
    .withIndex(orgIndex, (q: any) => q.eq("orgId", org._id).eq(field, value))
    .collect();
  if (org.slug !== "smokeshop") return scoped;
  const legacy = await ctx.db
    .query(table)
    .withIndex(legacyIndex, (q: any) => q.eq(field, value))
    .collect();
  const seen = new Set(scoped.map((r: any) => r._id));
  return [
    ...scoped,
    ...legacy.filter((r: any) => r.orgId == null && !seen.has(r._id)),
  ];
}

async function orgVariantsByProduct(
  ctx: any,
  org: any,
  productSupabaseId: string,
): Promise<any[]> {
  return orgJoinRows(
    ctx,
    org,
    "catalogVariants",
    "by_org_product",
    "by_product",
    "productSupabaseId",
    productSupabaseId,
  );
}

// Admin list view: products + variants + brand in one round trip.
// Scoped to the caller's org; writes below stay gated on that org's admin.
export const listProductsForAdmin = query({
  args: { orgSlug: v.string() },
  handler: async (ctx, args) => {
    const { org } = await requireOrgAdminBySlug(ctx, args.orgSlug);
    const products = await collectInOrg(ctx, "catalogProducts", org);
    products.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    const brands = await collectInOrg(ctx, "catalogBrands", org);
    const brandBySupabaseId = new Map(brands.map((b) => [b.supabaseId, b]));
    const out = [];
    for (const p of products) {
      const variants = await orgVariantsByProduct(ctx, org, p.supabaseId);
      const brand = p.brandSupabaseId
        ? (brandBySupabaseId.get(p.brandSupabaseId) ?? null)
        : null;
      const catJoins = await orgJoinRows(
        ctx,
        org,
        "catalogProductCategories",
        "by_org_product",
        "by_product",
        "productSupabaseId",
        p.supabaseId,
      );
      const colJoins = await orgJoinRows(
        ctx,
        org,
        "catalogCollectionProducts",
        "by_org_product",
        "by_product",
        "productSupabaseId",
        p.supabaseId,
      );
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

// Full R2 reference inventory, scoped to the org. Tables are scanned
// field-by-field and repointImageRefs updates matching fields. Embedded blog
// content and homepage/section config are replaced only for exact old
// URLs/keys. Order item image snapshots count too (any hit blocks deletes,
// fail-closed); the repoint loop below moves them with exact old-value
// matching so old originals stay cleanable. Reads tolerate pre-schema rows
// (image optional).
// ponytail: full scans suit the current small catalog; add a reference index
// only when these collections approach Convex query limits (orders first —
// it grows unboundedly while the rest stay small).
async function imageRows(ctx: any, org: any) {
  const orgTables = [
    "catalogProducts",
    "catalogVariants",
    "catalogBrands",
    "catalogCategories",
    "catalogCollections",
    "catalogCombos",
    "blogPosts",
    "heroSlides",
    "sectionConfigurations",
    "homepageComponentConfig",
    "siteSettings",
  ] as const;
  const scoped = await Promise.all(
    orgTables.map((t) => collectInOrg(ctx, t, org)),
  );
  const [products, variants, brands, categories, collections, combos, blogs, heroes, sections, components, sites] = scoped;
  // carts/orders were always org-scoped: prefix-eq on the leading index field.
  const carts = await ctx.db
    .query("carts")
    .withIndex("by_org_user", (q: any) => q.eq("orgId", org._id))
    .collect();
  const orders = await ctx.db
    .query("orders")
    .withIndex("by_org_user", (q: any) => q.eq("orgId", org._id))
    .collect();
  return { products, variants, brands, categories, collections, combos, blogs, heroes, sections, components, sites, carts, orders };
}

async function collectImageUsage(
  ctx: any,
  key: string,
  url?: string,
  rows?: Awaited<ReturnType<typeof imageRows>>,
): Promise<{ contexts: UsageContext[]; mutableTotal: number; historicalTotal: number }> {
  const r = rows!;
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
  // Order item snapshots are history (mutable: false — no admin form edits
  // them), but any hit still counts: deletes stay fail-closed while an order
  // references the asset. Missing `image` on pre-schema rows reads as
  // undefined and never matches.
  for (const o of r.orders ?? []) {
    const items = Array.isArray((o as any).items) ? (o as any).items : [];
    const count = items.filter((it: any) => hits(it?.image)).length;
    if (count)
      push({
        kind: "order",
        label: (o as any).displayOrderId ?? String((o as any)._id),
        detail: "item snapshot",
        mutable: false,
      }, count);
  }
  return { contexts, mutableTotal, historicalTotal };
}

// Single-asset usage (kept for backward compat: usedBy/total shape + contexts).
export const imageUsage = query({
  args: { orgSlug: v.string(), key: v.string(), url: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { org } = await requireOrgAdminBySlug(ctx, args.orgSlug);
    const rows = await imageRows(ctx, org);
    const { contexts, mutableTotal, historicalTotal } = await collectImageUsage(ctx, args.key, args.url, rows);
    const usedBy = contexts
      .filter((c) => c.mutable && c.kind === "variant")
      .map((c) => ({ productName: c.label, variantName: c.detail ?? "" }));
    return { usedBy, total: mutableTotal + historicalTotal, mutableTotal, historicalTotal, contexts };
  },
});

// Batch inventory: one round trip for the whole asset grid (no N+1).
export const imageUsageBatch = query({
  args: {
    orgSlug: v.string(),
    refs: v.array(v.object({ key: v.string(), url: v.optional(v.string()) })),
  },
  handler: async (ctx, { orgSlug, refs }) => {
    const { org } = await requireOrgAdminBySlug(ctx, orgSlug);
    if (refs.length > 200) throw new ConvexError({ code: "BATCH_TOO_LARGE" });
    const rows = await imageRows(ctx, org);
    const out = [];
    for (const r of refs) {
      const { contexts, mutableTotal, historicalTotal } = await collectImageUsage(ctx, r.key, r.url, rows);
      out.push({ key: r.key, total: mutableTotal + historicalTotal, mutableTotal, historicalTotal, contexts });
    }
    return out;
  },
});

// Repoint every mutable reference from an old R2 URL/key to a reprocessed one.
// Scoped to the org: only rows inOrg are patched (patches stamp orgId, healing
// legacy rows). Old-value compare per field: concurrent edits that already
// changed a field are left untouched. Old originals stay in R2 for rollback.
export const repointImageRefs = mutation({
  args: {
    orgSlug: v.string(),
    oldKey: v.string(),
    oldUrl: v.optional(v.string()),
    newUrl: v.string(),
  },
  handler: async (ctx, { orgSlug, oldKey, oldUrl, newUrl }) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    if (!oldKey.startsWith("asset_images/") || !newUrl.startsWith("https://cdn.cigarro.in/asset_images/"))
      throw new ConvexError({ code: "BAD_IMAGE_REFERENCE" });
    const hits = (s: unknown) => matchesRef(s, oldKey, oldUrl);
    const patched: Record<string, number> = {};
    const bump = (k: string) => {
      patched[k] = (patched[k] ?? 0) + 1;
    };
    const products = await collectInOrg(ctx, "catalogProducts", org);
    const productNames = new Map(products.map((p) => [p.supabaseId, p.name]));
    for (const x of await collectInOrg(ctx, "catalogVariants", org)) {
      const images = x.images || [];
      if (!images.some(hits)) continue;
      const productName = productNames.get(x.productSupabaseId);
      const imageAltText = x.imageAltText?.trim() || [productName, x.variantName].filter(Boolean).join(" ");
      await ctx.db.patch(x._id, {
        images: images.map((s: string) => (hits(s) ? newUrl : s)),
        ...(x.imageAltText?.trim() ? {} : { imageAltText }),
        orgId,
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
      for (const row of await collectInOrg(ctx, table, org)) {
        const patch: Record<string, string> = {};
        for (const f of fields) if (hits((row as any)[f])) patch[f] = newUrl;
        if (Object.keys(patch).length === 0) continue;
        await ctx.db.patch(row._id, { ...patch, orgId });
        bump(label);
      }
    }
    for (const c of await collectInOrg(ctx, "catalogCombos", org)) {
      const gallery = c.galleryImages || [];
      if (!gallery.some(hits)) continue;
      await ctx.db.patch(c._id, {
        galleryImages: gallery.map((s: string) => (hits(s) ? newUrl : s)),
        orgId,
        updatedAt: Date.now(),
      });
      bump("combosGallery");
    }
    for (const p of await collectInOrg(ctx, "blogPosts", org)) {
      const content = replaceEmbeddedRef(p.content, oldKey, oldUrl, newUrl);
      if (content === null) continue;
      await ctx.db.patch(p._id, { content, orgId, updatedAt: Date.now() });
      bump("blogContent");
    }
    for (const s of await collectInOrg(ctx, "sectionConfigurations", org)) {
      const config = replaceDeepRefs(s.config, oldKey, oldUrl, newUrl);
      if (config === null) continue;
      await ctx.db.patch(s._id, { config, orgId });
      bump("sectionConfig");
    }
    for (const c of await collectInOrg(ctx, "homepageComponentConfig", org)) {
      const config = replaceDeepRefs(c.config, oldKey, oldUrl, newUrl);
      if (config === null) continue;
      await ctx.db.patch(c._id, { config, orgId });
      bump("homepageConfig");
    }
    for (const cart of await ctx.db
      .query("carts")
      .withIndex("by_org_user", (q: any) => q.eq("orgId", org._id))
      .collect()) {
      if (!hits(cart.imageUrl)) continue;
      await ctx.db.patch(cart._id, { imageUrl: newUrl, updatedAt: Date.now() });
      bump("carts");
    }
    // Order item snapshots: the single deliberate exception to "history is
    // never patched". Thumbnails are display-only (money untouched), exact
    // old-value match per item, and moving them lets old originals become
    // unreferenced for cleanup. Pre-schema rows (no `image`) never match.
    for (const o of await ctx.db
      .query("orders")
      .withIndex("by_org_user", (q: any) => q.eq("orgId", org._id))
      .collect()) {
      const items = Array.isArray((o as any).items) ? (o as any).items : [];
      if (!items.some((it: any) => hits(it?.image))) continue;
      await ctx.db.patch(o._id, {
        items: items.map((it: any) => (hits(it?.image) ? { ...it, image: newUrl } : it)),
      });
      bump("orders");
    }
    return { patched };
  },
});

// ---------------- Brands ----------------
// Admin brand list with product counts (replaces the products(count) join).
export const listBrandsForAdmin = query({
  args: { orgSlug: v.string() },
  handler: async (ctx, args) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, args.orgSlug);
    const brands = await collectInOrg(ctx, "catalogBrands", org);
    brands.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    const out = [];
    for (const b of brands) {
      // Convex has no count op: bounded take off the brand index. Catalogs
      // here are tens of rows — a materialized counter can come past ~1k.
      const prods = await ctx.db
        .query("catalogProducts")
        .withIndex("by_org_brand_active", (q) =>
          q.eq("orgId", orgId).eq("brandSupabaseId", b.supabaseId),
        )
        .take(1000);
      let n = prods.length;
      if (org.slug === "smokeshop" && n < 1000) {
        const legacy = await ctx.db
          .query("catalogProducts")
          .withIndex("by_brand_active", (q) =>
            q.eq("brandSupabaseId", b.supabaseId),
          )
          .take(1000);
        n += legacy.filter((p: any) => p.orgId == null).length;
      }
      out.push({ ...b, product_count: n });
    }
    return out;
  },
});

export const setBrandsActive = mutation({
  args: {
    orgSlug: v.string(),
    supabaseIds: v.array(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, { orgSlug, supabaseIds, isActive }) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    for (const supabaseId of supabaseIds) {
      const row = await findOrgDocBySupabase(ctx, "catalogBrands", org, supabaseId);
      if (row) await ctx.db.patch(row._id, { isActive, orgId, updatedAt: Date.now() });
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
  args: { orgSlug: v.string(), ...brandV },
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAdminBySlug(ctx, args.orgSlug);
    const { orgSlug: _drop, ...rest } = args;
    if (!rest.name.trim() || !rest.slug.trim())
      throw new ConvexError({ code: "NAME_SLUG_REQUIRED" });
    const org = { _id: orgId, slug: args.orgSlug };
    await assertOrgSlugUnique(ctx, org, "catalogBrands", rest.slug.trim());
    const now = Date.now();
    const supabaseId = crypto.randomUUID();
    await ctx.db.insert("catalogBrands", {
      ...rest,
      name: rest.name.trim(),
      slug: rest.slug.trim(),
      supabaseId,
      orgId,
      createdAt: now,
      updatedAt: now,
    });
    return { supabaseId };
  },
});

export const updateBrand = mutation({
  args: { orgSlug: v.string(), supabaseId: v.string(), patch: v.object(brandV) },
  handler: async (ctx, { orgSlug, supabaseId, patch }) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    const row = await findOrgDocBySupabase(ctx, "catalogBrands", org, supabaseId);
    if (!row || !inOrg(row, org)) throw new ConvexError({ code: "NOT_FOUND" });
    await assertOrgSlugUnique(ctx, org, "catalogBrands", patch.slug.trim(), {
      supabaseId,
    });
    await ctx.db.patch(row._id, {
      ...patch,
      name: patch.name.trim(),
      slug: patch.slug.trim(),
      orgId,
      updatedAt: Date.now(),
    });
    return { supabaseId };
  },
});

export const deleteBrand = mutation({
  args: { orgSlug: v.string(), supabaseId: v.string() },
  handler: async (ctx, { orgSlug, supabaseId }) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    const row = await findOrgDocBySupabase(ctx, "catalogBrands", org, supabaseId);
    if (!row || !inOrg(row, org)) throw new ConvexError({ code: "NOT_FOUND" });
    const used = await ctx.db
      .query("catalogProducts")
      .withIndex("by_org_brand_active", (q) =>
        q.eq("orgId", orgId).eq("brandSupabaseId", supabaseId),
      )
      .first();
    if (used) throw new ConvexError({ code: "BRAND_IN_USE" });
    if (org.slug === "smokeshop" && row.orgId == null) {
      const legacyUsed = await ctx.db
        .query("catalogProducts")
        .withIndex("by_brand_active", (q) => q.eq("brandSupabaseId", supabaseId))
        .first();
      if (legacyUsed && legacyUsed.orgId == null)
        throw new ConvexError({ code: "BRAND_IN_USE" });
    }
    await ctx.db.delete(row._id);
    return { deleted: true };
  },
});

// ---------------- Categories ----------------
// Admin category list with product counts + linked product ids (for the form's
// ProductSelector). isActive absent (pre-cutover rows) reads as active.
export const listCategoriesForAdmin = query({
  args: { orgSlug: v.string() },
  handler: async (ctx, args) => {
    const { org } = await requireOrgAdminBySlug(ctx, args.orgSlug);
    const categories = await collectInOrg(ctx, "catalogCategories", org);
    categories.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    const out = [];
    for (const c of categories) {
      const joins = await orgJoinRows(
        ctx,
        org,
        "catalogProductCategories",
        "by_org_category",
        "by_category",
        "categorySupabaseId",
        c.supabaseId,
      );
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
  args: {
    orgSlug: v.string(),
    supabaseIds: v.array(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, { orgSlug, supabaseIds, isActive }) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    for (const supabaseId of supabaseIds) {
      const row = await findOrgDocBySupabase(ctx, "catalogCategories", org, supabaseId);
      if (row) await ctx.db.patch(row._id, { isActive, orgId, updatedAt: Date.now() });
    }
    return { updated: supabaseIds.length };
  },
});

export const setCategoryProducts = mutation({
  args: {
    orgSlug: v.string(),
    supabaseId: v.string(),
    productSupabaseIds: v.array(v.string()),
  },
  handler: async (ctx, { orgSlug, supabaseId, productSupabaseIds }) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    const cat = await findOrgDocBySupabase(ctx, "catalogCategories", org, supabaseId);
    if (!cat || !inOrg(cat, org)) throw new ConvexError({ code: "NOT_FOUND" });
    for (const pid of productSupabaseIds) {
      const p = await findOrgDocBySupabase(ctx, "catalogProducts", org, pid);
      if (!p || !inOrg(p, org)) throw new ConvexError({ code: "NOT_FOUND" });
    }
    const old = await orgJoinRows(
      ctx,
      org,
      "catalogProductCategories",
      "by_org_category",
      "by_category",
      "categorySupabaseId",
      supabaseId,
    );
    for (const j of old) await ctx.db.delete(j._id);
    for (const productSupabaseId of productSupabaseIds) {
      await ctx.db.insert("catalogProductCategories", {
        orgId,
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
  args: { orgSlug: v.string(), ...categoryV },
  handler: async (ctx, args) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, args.orgSlug);
    const { orgSlug: _drop, ...rest } = args;
    if (!rest.name.trim() || !rest.slug.trim())
      throw new ConvexError({ code: "NAME_SLUG_REQUIRED" });
    await assertOrgSlugUnique(ctx, org, "catalogCategories", rest.slug.trim());
    const now = Date.now();
    const supabaseId = crypto.randomUUID();
    await ctx.db.insert("catalogCategories", {
      ...rest,
      name: rest.name.trim(),
      slug: rest.slug.trim(),
      supabaseId,
      orgId,
      createdAt: now,
      updatedAt: now,
    });
    return { supabaseId };
  },
});

export const updateCategory = mutation({
  args: { orgSlug: v.string(), supabaseId: v.string(), patch: v.object(categoryV) },
  handler: async (ctx, { orgSlug, supabaseId, patch }) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    const row = await findOrgDocBySupabase(ctx, "catalogCategories", org, supabaseId);
    if (!row || !inOrg(row, org)) throw new ConvexError({ code: "NOT_FOUND" });
    await assertOrgSlugUnique(ctx, org, "catalogCategories", patch.slug.trim(), {
      supabaseId,
    });
    await ctx.db.patch(row._id, {
      ...patch,
      name: patch.name.trim(),
      slug: patch.slug.trim(),
      orgId,
      updatedAt: Date.now(),
    });
    return { supabaseId };
  },
});

export const deleteCategory = mutation({
  args: { orgSlug: v.string(), supabaseId: v.string() },
  handler: async (ctx, { orgSlug, supabaseId }) => {
    const { org } = await requireOrgAdminBySlug(ctx, orgSlug);
    const row = await findOrgDocBySupabase(ctx, "catalogCategories", org, supabaseId);
    if (!row || !inOrg(row, org)) throw new ConvexError({ code: "NOT_FOUND" });
    const joins = await orgJoinRows(
      ctx,
      org,
      "catalogProductCategories",
      "by_org_category",
      "by_category",
      "categorySupabaseId",
      supabaseId,
    );
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
    orgSlug: v.string(),
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
      orgSlug,
      supabaseId,
      product,
      variants,
      deletedVariantSupabaseIds = [],
      categorySupabaseIds = [],
      collectionSupabaseIds = [],
    },
  ) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    if (!product.name.trim()) throw new ConvexError({ code: "NAME_REQUIRED" });
    if (!variants.some((x) => x.isDefault))
      throw new ConvexError({ code: "DEFAULT_VARIANT_REQUIRED" });
    const def = variants.find((x) => x.isDefault)!;
    if (!(def.priceRupees > 0))
      throw new ConvexError({ code: "DEFAULT_PRICE_REQUIRED" });
    // Cross-table joins stay inside the org: brand/categories/collections
    // must all resolve here, never to another tenant's rows.
    if (product.brandSupabaseId) {
      const b = await findOrgDocBySupabase(
        ctx,
        "catalogBrands",
        org,
        product.brandSupabaseId,
      );
      if (!b || !inOrg(b, org)) throw new ConvexError({ code: "BRAND_NOT_FOUND" });
    }
    for (const cid of [...categorySupabaseIds, ...collectionSupabaseIds]) {
      const inCat = await findOrgDocBySupabase(ctx, "catalogCategories", org, cid);
      const inCol = inCat ? null : await findOrgDocBySupabase(ctx, "catalogCollections", org, cid);
      const found = inCat ?? inCol;
      if (!found || !inOrg(found, org)) throw new ConvexError({ code: "NOT_FOUND" });
    }

    const now = Date.now();
    let productSupabaseId = supabaseId;
    if (productSupabaseId) {
      const row = await findOrgDocBySupabase(ctx, "catalogProducts", org, productSupabaseId);
      if (!row || !inOrg(row, org)) throw new ConvexError({ code: "NOT_FOUND" });
      await assertOrgSlugUnique(ctx, org, "catalogProducts", product.slug.trim(), {
        supabaseId: productSupabaseId,
      });
      await ctx.db.patch(row._id, {
        ...product,
        name: product.name.trim(),
        slug: product.slug.trim(),
        orgId,
        updatedAt: now,
      });
    } else {
      await assertOrgSlugUnique(ctx, org, "catalogProducts", product.slug.trim());
      productSupabaseId = crypto.randomUUID();
      await ctx.db.insert("catalogProducts", {
        ...product,
        name: product.name.trim(),
        slug: product.slug.trim(),
        supabaseId: productSupabaseId,
        orgId,
        createdAt: now,
        updatedAt: now,
      });
    }
    const pid = productSupabaseId!;

    for (const delId of deletedVariantSupabaseIds) {
      const vrow = await findOrgDocBySupabase(ctx, "catalogVariants", org, delId);
      if (vrow && inOrg(vrow, org) && vrow.productSupabaseId === pid) {
        await assertVariantHasNoInventoryHistory(ctx, orgId, vrow.supabaseId);
        await ctx.db.delete(vrow._id);
      }
    }
    for (const variant of variants) {
      const doc = {
        ...variant,
        variantSlug: variant.variantSlug?.trim() || slugify(variant.variantName),
        productSupabaseId: pid,
        orgId,
        updatedAt: now,
      };
      if (variant.supabaseId) {
        const vrow = await findOrgDocBySupabase(ctx, "catalogVariants", org, variant.supabaseId);
        if (vrow && inOrg(vrow, org) && vrow.productSupabaseId === pid) {
          // Once the inventory ledger has initialized this variant, stock is
          // managed only by inventory mutations. Product edits/imports must
          // not silently overwrite an audited balance.
          const balance = await findVariantInventoryBalance(ctx, orgId, vrow.supabaseId);
          await ctx.db.patch(vrow._id, balance ? { ...doc, stock: vrow.stock } : doc);
        } else if (!vrow) {
          await ctx.db.insert("catalogVariants", {
            ...doc,
            supabaseId: variant.supabaseId,
            createdAt: now,
          });
        } else {
          throw new ConvexError({ code: "NOT_FOUND" });
        }
      } else {
        await ctx.db.insert("catalogVariants", {
          ...doc,
          supabaseId: crypto.randomUUID(),
          createdAt: now,
        });
      }
    }

    const oldCat = await orgJoinRows(
      ctx,
      org,
      "catalogProductCategories",
      "by_org_product",
      "by_product",
      "productSupabaseId",
      pid,
    );
    for (const j of oldCat) await ctx.db.delete(j._id);
    for (const categorySupabaseId of categorySupabaseIds) {
      await ctx.db.insert("catalogProductCategories", {
        orgId,
        productSupabaseId: pid,
        categorySupabaseId,
      });
    }

    const oldCol = await orgJoinRows(
      ctx,
      org,
      "catalogCollectionProducts",
      "by_org_product",
      "by_product",
      "productSupabaseId",
      pid,
    );
    for (const j of oldCol) await ctx.db.delete(j._id);
    for (const collectionSupabaseId of collectionSupabaseIds) {
      await ctx.db.insert("catalogCollectionProducts", {
        orgId,
        collectionSupabaseId,
        productSupabaseId: pid,
      });
    }
    return { supabaseId: pid };
  },
});

export const deleteProduct = mutation({
  args: { orgSlug: v.string(), supabaseId: v.string() },
  handler: async (ctx, { orgSlug, supabaseId }) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    const row = await findOrgDocBySupabase(ctx, "catalogProducts", org, supabaseId);
    if (!row || !inOrg(row, org)) throw new ConvexError({ code: "NOT_FOUND" });
    const variants = await orgVariantsByProduct(ctx, org, supabaseId);
    for (const r of variants) await assertVariantHasNoInventoryHistory(ctx, orgId, r.supabaseId);
    for (const r of variants) await ctx.db.delete(r._id);
    for (const table of ["catalogProductCategories", "catalogCollectionProducts"] as const) {
      const rows = await orgJoinRows(
        ctx,
        org,
        table,
        "by_org_product",
        "by_product",
        "productSupabaseId",
        supabaseId,
      );
      for (const r of rows) await ctx.db.delete(r._id);
    }
    await ctx.db.delete(row._id);
    return { deleted: true };
  },
});

export const setProductsActive = mutation({
  args: {
    orgSlug: v.string(),
    supabaseIds: v.array(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, { orgSlug, supabaseIds, isActive }) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    for (const supabaseId of supabaseIds) {
      const row = await findOrgDocBySupabase(ctx, "catalogProducts", org, supabaseId);
      if (row) await ctx.db.patch(row._id, { isActive, orgId, updatedAt: Date.now() });
    }
    return { updated: supabaseIds.length };
  },
});

// Edit-form loader: product + variants + join ids (mirrors the old 3-query load).
export const getProductForEdit = query({
  args: { orgSlug: v.string(), supabaseId: v.string() },
  handler: async (ctx, { orgSlug, supabaseId }) => {
    const { org } = await requireOrgAdminBySlug(ctx, orgSlug);
    const product = await findOrgDocBySupabase(ctx, "catalogProducts", org, supabaseId);
    if (!product || !inOrg(product, org)) return null;
    const variants = await orgVariantsByProduct(ctx, org, supabaseId);
    const catJoins = await orgJoinRows(
      ctx,
      org,
      "catalogProductCategories",
      "by_org_product",
      "by_product",
      "productSupabaseId",
      supabaseId,
    );
    const colJoins = await orgJoinRows(
      ctx,
      org,
      "catalogCollectionProducts",
      "by_org_product",
      "by_product",
      "productSupabaseId",
      supabaseId,
    );
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
  args: { orgSlug: v.string() },
  handler: async (ctx, args) => {
    const { org } = await requireOrgAdminBySlug(ctx, args.orgSlug);
    const collections = await collectInOrg(ctx, "catalogCollections", org);
    collections.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    const out = [];
    for (const c of collections) {
      const joins = await orgJoinRows(
        ctx,
        org,
        "catalogCollectionProducts",
        "by_org_collection",
        "by_collection",
        "collectionSupabaseId",
        c.supabaseId,
      );
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
  args: {
    orgSlug: v.string(),
    supabaseIds: v.array(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, { orgSlug, supabaseIds, isActive }) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    for (const supabaseId of supabaseIds) {
      const row = await findOrgDocBySupabase(ctx, "catalogCollections", org, supabaseId);
      if (row) await ctx.db.patch(row._id, { isActive, orgId, updatedAt: Date.now() });
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
    orgSlug: v.string(),
    supabaseId: v.optional(v.string()),
    collection: v.object(collectionV),
    productSupabaseIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { orgSlug, supabaseId, collection, productSupabaseIds }) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    if (!collection.title.trim() || !collection.slug.trim())
      throw new ConvexError({ code: "TITLE_SLUG_REQUIRED" });
    const now = Date.now();
    let cid = supabaseId;
    if (cid) {
      const row = await findOrgDocBySupabase(ctx, "catalogCollections", org, cid);
      if (!row || !inOrg(row, org)) throw new ConvexError({ code: "NOT_FOUND" });
      await assertOrgSlugUnique(ctx, org, "catalogCollections", collection.slug.trim(), {
        supabaseId: cid,
      });
      await ctx.db.patch(row._id, {
        ...collection,
        title: collection.title.trim(),
        slug: collection.slug.trim(),
        orgId,
        updatedAt: now,
      });
    } else {
      await assertOrgSlugUnique(ctx, org, "catalogCollections", collection.slug.trim());
      cid = crypto.randomUUID();
      await ctx.db.insert("catalogCollections", {
        ...collection,
        title: collection.title.trim(),
        slug: collection.slug.trim(),
        supabaseId: cid,
        orgId,
        createdAt: now,
        updatedAt: now,
      });
    }
    if (productSupabaseIds !== undefined) {
      for (const pid of productSupabaseIds) {
        const p = await findOrgDocBySupabase(ctx, "catalogProducts", org, pid);
        if (!p || !inOrg(p, org)) throw new ConvexError({ code: "NOT_FOUND" });
      }
      const old = await orgJoinRows(
        ctx,
        org,
        "catalogCollectionProducts",
        "by_org_collection",
        "by_collection",
        "collectionSupabaseId",
        cid!,
      );
      for (const j of old) await ctx.db.delete(j._id);
      // Insert order = admin picker order (selection click order); the
      // storefront sorts by sortOrder, so persist the index.
      let order = 0;
      for (const productSupabaseId of productSupabaseIds) {
        await ctx.db.insert("catalogCollectionProducts", {
          orgId,
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
  args: { orgSlug: v.string(), supabaseId: v.string() },
  handler: async (ctx, { orgSlug, supabaseId }) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    const row = await findOrgDocBySupabase(ctx, "catalogCollections", org, supabaseId);
    if (!row || !inOrg(row, org)) throw new ConvexError({ code: "NOT_FOUND" });
    const joins = await orgJoinRows(
      ctx,
      org,
      "catalogCollectionProducts",
      "by_org_collection",
      "by_collection",
      "collectionSupabaseId",
      supabaseId,
    );
    for (const j of joins) await ctx.db.delete(j._id);
    // Clear homepage links pointing at the deleted collection so sections
    // fall back to latest products instead of a stale id.
    const linked = await collectInOrg(ctx, "homepageComponentConfig", org);
    for (const c of linked) {
      if (c.sectionId === supabaseId) await ctx.db.patch(c._id, { sectionId: undefined });
    }
    void orgId;
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
    orgSlug: v.string(),
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
  handler: async (ctx, { orgSlug, supabaseId, combo, items }) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    if (!combo.name.trim() || !combo.slug.trim())
      throw new ConvexError({ code: "NAME_SLUG_REQUIRED" });
    const now = Date.now();
    let cid = supabaseId;
    if (cid) {
      const row = await findOrgDocBySupabase(ctx, "catalogCombos", org, cid);
      if (!row || !inOrg(row, org)) throw new ConvexError({ code: "NOT_FOUND" });
      await assertOrgSlugUnique(ctx, org, "catalogCombos", combo.slug.trim(), {
        supabaseId: cid,
      });
      await ctx.db.patch(row._id, {
        ...combo,
        name: combo.name.trim(),
        slug: combo.slug.trim(),
        orgId,
        updatedAt: now,
      });
    } else {
      await assertOrgSlugUnique(ctx, org, "catalogCombos", combo.slug.trim());
      cid = crypto.randomUUID();
      await ctx.db.insert("catalogCombos", {
        ...combo,
        name: combo.name.trim(),
        slug: combo.slug.trim(),
        supabaseId: cid,
        orgId,
        createdAt: now,
        updatedAt: now,
      });
    }
    if (items !== undefined) {
      for (const item of items) {
        const vx = await findOrgDocBySupabase(
          ctx,
          "catalogVariants",
          org,
          item.variantSupabaseId,
        );
        if (!vx || !inOrg(vx, org)) throw new ConvexError({ code: "NOT_FOUND" });
      }
      const old = await orgJoinRows(
        ctx,
        org,
        "catalogComboItems",
        "by_org_combo",
        "by_combo",
        "comboSupabaseId",
        cid!,
      );
      for (const j of old) await ctx.db.delete(j._id);
      for (const item of items) {
        await ctx.db.insert("catalogComboItems", {
          orgId,
          comboSupabaseId: cid!,
          ...item,
        });
      }
    }
    return { supabaseId: cid! };
  },
});

export const deleteCombo = mutation({
  args: { orgSlug: v.string(), supabaseId: v.string() },
  handler: async (ctx, { orgSlug, supabaseId }) => {
    const { org } = await requireOrgAdminBySlug(ctx, orgSlug);
    const row = await findOrgDocBySupabase(ctx, "catalogCombos", org, supabaseId);
    if (!row || !inOrg(row, org)) throw new ConvexError({ code: "NOT_FOUND" });
    const items = await orgJoinRows(
      ctx,
      org,
      "catalogComboItems",
      "by_org_combo",
      "by_combo",
      "comboSupabaseId",
      supabaseId,
    );
    for (const j of items) await ctx.db.delete(j._id);
    await ctx.db.delete(row._id);
    return { deleted: true };
  },
});

// ---------------- Content ----------------
// Admin blog list: ALL statuses (public query is published-only), newest
// first, with category name/color resolved for the table badge.
export const listBlogPostsForAdmin = query({
  args: { orgSlug: v.string() },
  handler: async (ctx, args) => {
    const { org } = await requireOrgAdminBySlug(ctx, args.orgSlug);
    const posts = await collectInOrg(ctx, "blogPosts", org);
    posts.sort((a, b) => (b.publishedAt ?? b.updatedAt ?? 0) - (a.publishedAt ?? a.updatedAt ?? 0));
    const cats = await collectInOrg(ctx, "blogCategories", org);
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
  args: {
    orgSlug: v.string(),
    ids: v.array(v.id("blogPosts")),
    status: v.string(),
  },
  handler: async (ctx, { orgSlug, ids, status }) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    if (!["draft", "published", "archived"].includes(status))
      throw new ConvexError({ code: "BAD_STATUS" });
    const now = Date.now();
    for (const id of ids) {
      const row = await ctx.db.get(id);
      if (!row || !inOrg(row as any, { _id: orgId, slug: org.slug })) continue;
      await ctx.db.patch(id, {
        status,
        publishedAt: status === "published" ? (row.publishedAt ?? now) : row.publishedAt,
        orgId,
        updatedAt: now,
      });
    }
    return { updated: ids.length };
  },
});

// Admin hero list: ALL slides (public query is active-only), sort order.
export const listHeroSlidesForAdmin = query({
  args: { orgSlug: v.string() },
  handler: async (ctx, args) => {
    const { org } = await requireOrgAdminBySlug(ctx, args.orgSlug);
    const rows = await collectInOrg(ctx, "heroSlides", org);
    rows.sort((a, b) => a.sortOrder - b.sortOrder);
    return rows;
  },
});

// Content rows carry no supabaseId (Wave 2 backfill didn't keep one), so
// updates key on the Convex _id — Wave 6 forms read from Convex and get it.
// Every id-keyed write verifies the row belongs to the caller's org.

export const saveBlogPost = mutation({
  args: {
    orgSlug: v.string(),
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
  handler: async (ctx, { orgSlug, id, post }) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    if (!post.title.trim() || !post.slug.trim())
      throw new ConvexError({ code: "TITLE_SLUG_REQUIRED" });
    // ponytail: like/view counts are reader-derived, never admin inputs.
    const now = Date.now();
    if (id) {
      const row = await ctx.db.get(id);
      if (!row || !inOrg(row as any, org)) throw new ConvexError({ code: "NOT_FOUND" });
      await assertOrgSlugUnique(ctx, org, "blogPosts", post.slug.trim(), { id });
      await ctx.db.patch(id, {
        ...post,
        authorName: post.authorName ?? row.authorName,
        title: post.title.trim(),
        slug: post.slug.trim(),
        publishedAt: post.status === "published" ? (row.publishedAt ?? now) : undefined,
        orgId,
        updatedAt: now,
      });
      return { id };
    }
    await assertOrgSlugUnique(ctx, org, "blogPosts", post.slug.trim());
    const newId = await ctx.db.insert("blogPosts", {
      ...post,
      authorName: post.authorName ?? "Cigarro",
      title: post.title.trim(),
      slug: post.slug.trim(),
      orgId,
      likeCount: 0,
      viewCount: 0,
      publishedAt: post.status === "published" ? now : undefined,
      updatedAt: now,
    });
    return { id: newId };
  },
});

export const deleteBlogPost = mutation({
  args: { orgSlug: v.string(), id: v.id("blogPosts") },
  handler: async (ctx, { orgSlug, id }) => {
    const { org } = await requireOrgAdminBySlug(ctx, orgSlug);
    const row = await ctx.db.get(id);
    if (!row || !inOrg(row as any, org)) throw new ConvexError({ code: "NOT_FOUND" });
    await ctx.db.delete(id);
    return { deleted: true };
  },
});

export const saveBlogCategory = mutation({
  args: {
    orgSlug: v.string(),
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
  handler: async (ctx, { orgSlug, id, category }) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    await assertOrgSlugUnique(ctx, org, "blogCategories", category.slug.trim(), { id });
    if (id) {
      const row = await ctx.db.get(id);
      if (!row || !inOrg(row as any, org)) throw new ConvexError({ code: "NOT_FOUND" });
      await ctx.db.patch(id, { ...category, orgId });
      return { id };
    }
    const newId = await ctx.db.insert("blogCategories", { ...category, orgId });
    return { id: newId };
  },
});

export const deleteBlogCategory = mutation({
  args: { orgSlug: v.string(), id: v.id("blogCategories") },
  handler: async (ctx, { orgSlug, id }) => {
    const { org } = await requireOrgAdminBySlug(ctx, orgSlug);
    const row = await ctx.db.get(id);
    if (!row || !inOrg(row as any, org)) throw new ConvexError({ code: "NOT_FOUND" });
    await ctx.db.delete(id);
    return { deleted: true };
  },
});

export const saveHeroSlide = mutation({
  args: {
    orgSlug: v.string(),
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
  handler: async (ctx, { orgSlug, id, slide }) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    if (id) {
      const row = await ctx.db.get(id);
      if (!row || !inOrg(row as any, org)) throw new ConvexError({ code: "NOT_FOUND" });
      await ctx.db.patch(id, { ...slide, orgId });
      return { id };
    }
    const newId = await ctx.db.insert("heroSlides", { ...slide, orgId });
    return { id: newId };
  },
});

export const deleteHeroSlide = mutation({
  args: { orgSlug: v.string(), id: v.id("heroSlides") },
  handler: async (ctx, { orgSlug, id }) => {
    const { org } = await requireOrgAdminBySlug(ctx, orgSlug);
    const row = await ctx.db.get(id);
    if (!row || !inOrg(row as any, org)) throw new ConvexError({ code: "NOT_FOUND" });
    await ctx.db.delete(id);
    return { deleted: true };
  },
});

export const saveSectionConfig = mutation({
  args: {
    orgSlug: v.string(),
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
  handler: async (ctx, { orgSlug, sectionName, patch }) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    const row = await ctx.db
      .query("sectionConfigurations")
      .withIndex("by_org_name", (q) =>
        q.eq("orgId", orgId).eq("sectionName", sectionName),
      )
      .unique();
    const legacy =
      !row && org.slug === "smokeshop"
        ? (
            await ctx.db
              .query("sectionConfigurations")
              .withIndex("by_name", (q) => q.eq("sectionName", sectionName))
              .collect()
          ).find((r: any) => r.orgId == null) ?? null
        : null;
    const found = row ?? legacy;
    if (found && !inOrg(found as any, org)) throw new ConvexError({ code: "NOT_FOUND" });
    if (found) await ctx.db.patch(found._id, { ...patch, orgId });
    else await ctx.db.insert("sectionConfigurations", { orgId, sectionName, ...patch });
    return { ok: true };
  },
});

export const saveHomepageComponent = mutation({
  args: {
    orgSlug: v.string(),
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
  handler: async (ctx, { orgSlug, componentName, patch }) => {
    const { org, orgId } = await requireOrgAdminBySlug(ctx, orgSlug);
    const row = await ctx.db
      .query("homepageComponentConfig")
      .withIndex("by_org_component", (q) =>
        q.eq("orgId", orgId).eq("componentName", componentName),
      )
      .unique();
    const legacy =
      !row && org.slug === "smokeshop"
        ? (
            await ctx.db
              .query("homepageComponentConfig")
              .withIndex("by_component", (q) => q.eq("componentName", componentName))
              .collect()
          ).find((r: any) => r.orgId == null) ?? null
        : null;
    const found = row ?? legacy;
    if (found && !inOrg(found as any, org)) throw new ConvexError({ code: "NOT_FOUND" });
    // Normalize: null/"" = unlink (unset), undefined = leave untouched.
    const { sectionId, ...rest } = patch;
    const dbPatch: any = {
      ...rest,
      displayOrder: patch.displayOrder ?? (found as any)?.displayOrder ?? 0,
      orgId,
    };
    if (sectionId === null || sectionId === "") dbPatch.sectionId = undefined;
    else if (sectionId !== undefined) dbPatch.sectionId = sectionId;
    if (found) {
      await ctx.db.patch(found._id, dbPatch);
    } else {
      await ctx.db.insert("homepageComponentConfig", {
        orgId,
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
    orgSlug: v.string(),
    siteName: v.optional(v.string()),
    metaTitle: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    faviconUrl: v.optional(v.string()),
    activeTheme: v.optional(v.string()),
    upiId: v.optional(v.string()),
    shippingConfig: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { org, orgId, identity } = await requireOrgAdminBySlug(ctx, args.orgSlug);
    const { orgSlug: _drop, ...rest } = args;
    const row = await ctx.db
      .query("siteSettings")
      .withIndex("by_org_key", (q) => q.eq("orgId", orgId).eq("key", "main"))
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
    if (found && !inOrg(found as any, org)) throw new ConvexError({ code: "NOT_FOUND" });
    const patch = {
      ...rest,
      orgId,
      updatedAt: Date.now(),
      updatedBy: identity.subject,
    };
    if (found) await ctx.db.patch(found._id, patch);
    else await ctx.db.insert("siteSettings", { key: "main", ...patch });
    return { ok: true };
  },
});
