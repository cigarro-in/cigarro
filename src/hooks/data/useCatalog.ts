import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';

// Theme-safe catalog reads (Wave 3: Convex). Shapes mirror the legacy
// Supabase rows — snake_case, Supabase UUID ids, ISO timestamps, explicit
// nulls — so pages keep their logic untouched. Money stays RUPEES.
// Themes must use these hooks, never Convex/Supabase clients.

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
  const brandById = new Map((bundle.brands || []).map((b: any) => [b.supabaseId, b]));
  const variantsByProduct = new Map<string, any[]>();
  for (const x of bundle.variants || []) {
    if (!variantsByProduct.has(x.productSupabaseId)) variantsByProduct.set(x.productSupabaseId, []);
    variantsByProduct.get(x.productSupabaseId)!.push(x);
  }
  const catById = new Map((bundle.categories || []).map((c: any) => [c.supabaseId, c]));
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
  const bundle = useQuery(api.catalog.fullCatalog, {});
  return useMemo(() => {
    if (!bundle) {
      return {
        products: [] as LegacyProduct[],
        brands: [],
        categories: [],
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
      productCategories: bundle.productCategories ?? [],
      loading: false,
    };
  }, [bundle]);
}

// PDP: single product with variants + brand (legacy shapes).
export function useCatalogProduct(slug: string | undefined) {
  const detail = useQuery(
    api.catalog.getProductBySlug,
    slug ? { slug } : 'skip',
  );
  return useMemo(() => {
    if (detail === undefined) return { product: null, loading: true as boolean };
    if (!detail) return { product: null, loading: false as boolean };
    const brandById = new Map(
      detail.brand ? [[detail.brand.supabaseId, detail.brand]] : [],
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

// Combos are an empty table in prod: keep the legacy call-site contract
// (list) without a Supabase dependency.
export function useCatalogCombos() {
  const rows = useQuery(api.catalog.listCombos, { activeOnly: true });
  return useMemo(() => ({ combos: rows ?? [] }), [rows]);
}
