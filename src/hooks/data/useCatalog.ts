import { useMemo } from 'react';
import { api } from '../../../convex/_generated/api';
import { usePreloadedOrLive } from '../../lib/ssr/preload';
import { useOrgInfo } from '../../lib/org/OrgContext';

// Theme-safe catalog reads (Convex). Shapes are snake_case rows with ISO
// timestamps and explicit nulls, so pages keep their logic untouched. Money
// stays RUPEES.
// Themes must use these hooks, never Convex clients.

const iso = (ms: any) =>
  ms == null ? null : new Date(ms).toISOString().replace('Z', '+00:00');

export interface LegacyVariant {
  id: string;
  product_id: string;
  variant_name: string;
  variant_slug?: string;
  variant_type?: string;
  units_contained?: number;
  unit?: string;
  images?: string[];
  image_alt_text?: string;
  price: number;
  compare_at_price?: number | null;
  cost_price?: number | null;
  stock?: number | null;
  track_inventory?: boolean;
  is_default?: boolean;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface LegacyProduct {
  id: string;
  name: string;
  slug: string;
  brand_id?: string | null;
  brand?: { id: string; name: string; slug?: string } | null;
  description?: string | null;
  short_description?: string | null;
  origin?: string | null;
  specifications?: any;
  is_active: boolean;
  meta_title?: string | null;
  meta_description?: string | null;
  canonical_url?: string | null;
  rating_value?: number | null;
  review_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  product_variants?: LegacyVariant[];
  categories?: Array<{ id: string; name: string; slug: string }>;
  // Computed conveniences (same rules as the edge APIs)
  price?: number;
  gallery_images?: string[];
  image?: string | null;
}

function toLegacyVariant(x: any, productSupabaseId: string): LegacyVariant {
  return {
    id: x.supabaseId,
    product_id: productSupabaseId,
    variant_name: x.variantName,
    variant_slug: x.variantSlug,
    variant_type: x.variantType,
    units_contained: x.unitsContained,
    unit: x.unit,
    images: x.images ?? [],
    image_alt_text: x.imageAltText,
    price: x.priceRupees,
    compare_at_price: x.compareAtPriceRupees,
    cost_price: x.costPriceRupees,
    stock: x.stock,
    track_inventory: x.trackInventory,
    is_default: x.isDefault,
    is_active: x.isActive,
    created_at: iso(x.createdAt),
    updated_at: iso(x.updatedAt),
  };
}

function toLegacyProduct(
  p: any,
  brandById: Map<string, any>,
  variantsByProduct: Map<string, any[]>,
  catsByProduct?: Map<string, Array<{ id: string; name: string; slug: string }>>,
): LegacyProduct {
  const b = p.brandSupabaseId ? brandById.get(p.brandSupabaseId) : null;
  const variants = (variantsByProduct.get(p.supabaseId) || []).map((x: any) =>
    toLegacyVariant(x, p.supabaseId),
  );
  const activeVariants = variants.filter((v: LegacyVariant) => v.is_active !== false);
  const defaultVariant =
    activeVariants.find((v: LegacyVariant) => v.is_default) || activeVariants[0];
  const images = activeVariants.flatMap((v: LegacyVariant) => v.images || []);
  return {
    id: p.supabaseId,
    name: p.name,
    slug: p.slug,
    brand_id: p.brandSupabaseId ?? null,
    brand: b ? { id: b.supabaseId, name: b.name, slug: b.slug } : null,
    description: p.description ?? null,
    short_description: p.shortDescription ?? null,
    origin: p.origin ?? null,
    specifications: p.specifications ?? null,
    is_active: p.isActive,
    meta_title: p.metaTitle ?? null,
    meta_description: p.metaDescription ?? null,
    canonical_url: p.canonicalUrl ?? null,
    rating_value: p.ratingValue ?? null,
    review_count: p.reviewCount ?? null,
    created_at: iso(p.createdAt),
    updated_at: iso(p.updatedAt),
    product_variants: variants,
    categories: catsByProduct?.get(p.supabaseId) || [],
    price: defaultVariant?.price || 0,
    gallery_images: images,
    image: images[0] || null,
  };
}

function buildMaps(bundle: any) {
  const brandById = new Map<string, any>((bundle.brands || []).map((b: any) => [b.supabaseId, b] as [string, any]));
  const variantsByProduct = new Map<string, any[]>();
  for (const x of bundle.variants || []) {
    if (!variantsByProduct.has(x.productSupabaseId)) variantsByProduct.set(x.productSupabaseId, []);
    variantsByProduct.get(x.productSupabaseId)!.push(x);
  }
  const catById = new Map<string, any>((bundle.categories || []).map((c: any) => [c.supabaseId, c] as [string, any]));
  const catsByProduct = new Map<string, Array<{ id: string; name: string; slug: string }>>();
  for (const j of bundle.productCategories || []) {
    const c = catById.get(j.categorySupabaseId);
    if (!c) continue;
    if (!catsByProduct.has(j.productSupabaseId)) catsByProduct.set(j.productSupabaseId, []);
    catsByProduct.get(j.productSupabaseId)!.push({ id: c.supabaseId, name: c.name, slug: c.slug });
  }
  return { brandById, variantsByProduct, catsByProduct };
}

// Full catalog (30 products — one subscription, filter locally).
// Memoized: consumers feed these identities into setState-in-effect syncs,
// so a fresh object per render would retrigger them infinitely.
export function useFullCatalog() {
  const { slug: orgSlug } = useOrgInfo();
  // No useOrg() gate: it is a live query and would block preloaded data on the server.
  const bundle = usePreloadedOrLive(api.catalog.fullCatalog, { orgSlug: orgSlug });
  return useMemo(() => {
    if (!bundle) {
      return {
        products: [] as LegacyProduct[],
        brands: [],
        categories: [],
        collections: [],
        collectionProducts: [],
        productCategories: [],
        loading: true,
      };
    }
    const { brandById, variantsByProduct, catsByProduct } = buildMaps(bundle);
    return {
      products: (bundle.products || []).map((p: any) =>
        toLegacyProduct(p, brandById, variantsByProduct, catsByProduct),
      ),
      brands: bundle.brands ?? [],
      categories: bundle.categories ?? [],
      collections: (bundle as any).collections ?? [],
      collectionProducts: (bundle as any).collectionProducts ?? [],
      productCategories: bundle.productCategories ?? [],
      loading: false,
    };
  }, [bundle]);
}

// PDP: single product with variants + brand (legacy shapes).
export function useCatalogProduct(slug: string | undefined) {
  const { slug: orgSlug } = useOrgInfo();
  const detail = usePreloadedOrLive(
    api.catalog.getProductBySlug,
    slug ? { slug, orgSlug: orgSlug } : 'skip',
  );
  return useMemo(() => {
    if (detail === undefined) return { product: null, loading: true as boolean };
    if (!detail) return { product: null, loading: false as boolean };
    const brandById = new Map<string, any>(
      detail.brand ? [[detail.brand.supabaseId, detail.brand] as [string, any]] : [],
    );
    const variantsByProduct = new Map([
      [detail.product.supabaseId, detail.variants || []],
    ]);
    return {
      product: toLegacyProduct(detail.product, brandById, variantsByProduct),
      loading: false as boolean,
    };
  }, [detail]);
}

// Combos are an empty table in prod: keep the call-site contract (list).
export function useCatalogCombos() {
  const { slug: orgSlug } = useOrgInfo();
  const rows = usePreloadedOrLive(api.catalog.listCombos, { activeOnly: true, orgSlug: orgSlug });
  return useMemo(() => ({ combos: rows ?? [] }), [rows]);
}

// Category listing (/category/:slug) and category+brand listing
// (/category/:category/:brand). Derived from the full catalog, so the server
// render and the client's first render produce the same rows. `missing` is
// the 404 case: unknown category, unknown or inactive brand, or an empty
// category+brand combo (the bot renderer returns 404 for the same inputs).
export type ListingStatus = 'loading' | 'ok' | 'missing';

export function useCategoryListing(categorySlug: string | undefined, brandSlug?: string) {
  const { products, brands, categories, productCategories, loading } = useFullCatalog();
  return useMemo(() => {
    const empty = { status: 'loading' as ListingStatus, category: null, brand: null, products: [] as LegacyProduct[] };
    if (loading) return empty;
    const category = categorySlug
      ? ((categories as any[]).find((c: any) => c.slug === categorySlug) ?? null)
      : null;
    if (!category) return { ...empty, status: 'missing' as ListingStatus };
    const brand = brandSlug
      ? ((brands as any[]).find((b: any) => b.slug === brandSlug && b.isActive) ?? null)
      : null;
    if (brandSlug && !brand) return { ...empty, status: 'missing' as ListingStatus, category };
    const byId = new Map(products.map((p) => [p.id, p]));
    let rows = (productCategories as any[])
      .filter((j: any) => j.categorySupabaseId === category.supabaseId)
      .map((j: any) => byId.get(j.productSupabaseId))
      .filter((p: any): p is LegacyProduct => !!p && p.is_active);
    if (brand) rows = rows.filter((p) => p.brand_id === brand.supabaseId);
    if (brand && rows.length === 0) return { ...empty, status: 'missing' as ListingStatus, category, brand };
    return { status: 'ok' as ListingStatus, category, brand, products: rows };
  }, [categorySlug, brandSlug, products, brands, categories, productCategories, loading]);
}

// Brand detail (/brand/:slug). Derived from the full catalog, like the category
// listing. `missing` is the 404 case: unknown or inactive brand. A brand with no
// products is still 200 (the page shows its empty state), as on the bot renderer.
export function useBrandDetail(brandSlug: string | undefined) {
  const { products, brands, loading } = useFullCatalog();
  return useMemo(() => {
    if (loading) return { status: 'loading' as ListingStatus, brand: null as any, products: [] as LegacyProduct[] };
    const brand = brandSlug
      ? ((brands as any[]).find((b: any) => b.slug === brandSlug && b.isActive) ?? null)
      : null;
    if (!brand) return { status: 'missing' as ListingStatus, brand: null as any, products: [] as LegacyProduct[] };
    const rows = products
      .filter((p) => p.brand_id === brand.supabaseId && p.is_active)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    return { status: 'ok' as ListingStatus, brand, products: rows };
  }, [brandSlug, products, brands, loading]);
}

// Brands hub (/brands): active brands with at least one active product, most
// products first. Same rules as the bot renderer's brand list.
export interface HubBrand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  productCount: number;
}

export function useBrandsHub(): { brands: HubBrand[]; loading: boolean } {
  const { products, brands, loading } = useFullCatalog();
  return useMemo(() => {
    if (loading) return { brands: [] as HubBrand[], loading: true };
    const counts = new Map<string, number>();
    for (const p of products) {
      if (!p.is_active || !p.brand_id) continue;
      counts.set(p.brand_id, (counts.get(p.brand_id) || 0) + 1);
    }
    const list = (brands as any[])
      .filter((b) => b.isActive)
      .map((b) => ({
        id: b.supabaseId as string,
        name: b.name as string,
        slug: b.slug as string,
        description: (b.description ?? null) as string | null,
        logoUrl: (b.logoUrl ?? null) as string | null,
        productCount: counts.get(b.supabaseId) || 0,
      }))
      .filter((b) => b.productCount > 0)
      .sort((a, b) => b.productCount - a.productCount);
    return { brands: list, loading: false };
  }, [products, brands, loading]);
}

// Categories hub (/categories): categories with at least one active product,
// by name. Each carries its active products (listing order is the catalog's).
export interface HubCategory {
  id: string;
  name: string;
  slug: string;
  products: LegacyProduct[];
}

export function useCategoriesHub(): { categories: HubCategory[]; loading: boolean } {
  const { products, categories, productCategories, loading } = useFullCatalog();
  return useMemo(() => {
    if (loading) return { categories: [] as HubCategory[], loading: true };
    const byId = new Map(products.map((p) => [p.id, p] as [string, LegacyProduct]));
    const list = [...(categories as any[])]
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .map((cat) => ({
        id: cat.supabaseId as string,
        name: cat.name as string,
        slug: cat.slug as string,
        products: (productCategories as any[])
          .filter((j) => j.categorySupabaseId === cat.supabaseId)
          .map((j) => byId.get(j.productSupabaseId))
          .filter((p): p is LegacyProduct => !!p && p.is_active),
      }))
      .filter((c) => c.products.length > 0);
    return { categories: list, loading: false };
  }, [products, categories, productCategories, loading]);
}
