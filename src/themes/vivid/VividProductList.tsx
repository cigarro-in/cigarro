import { useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { useCached } from '../../lib/cache/swrCache';
import { SEOHead } from '../../components/seo/SEOHead';
import { VividProductCard } from './VividProductCard';
import { VividCartPanel } from './VividCartPanel';
import type { HomepageProduct } from '../../types/home';

interface ListResult {
  products: HomepageProduct[];
  categoryName: string | null;
  categoryDescription: string | null;
}

async function fetchAll(search: string): Promise<ListResult> {
  let q = supabase
    .from('products')
    .select(
      'id, name, slug, brand_id, description, is_active, created_at, brand:brands(id, name), product_variants(id, variant_name, price, is_default, is_active, images)'
    )
    .eq('is_active', true);
  if (search.trim()) {
    q = q.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }
  const { data } = await q.order('created_at', { ascending: false });
  return {
    products: normalize(data || []),
    categoryName: null,
    categoryDescription: null,
  };
}

async function fetchByCategory(slug: string): Promise<ListResult> {
  const { data } = await supabase
    .from('categories')
    .select(
      'id, name, description, products:product_categories!inner(products!inner(id, name, slug, brand_id, description, is_active, created_at, brand:brands(id, name), product_variants(id, variant_name, price, is_default, is_active, images)))'
    )
    .eq('slug', slug)
    .eq('products.products.is_active', true)
    .single();
  if (!data) return { products: [], categoryName: null, categoryDescription: null };
  const inner = ((data as any).products || []).map((pc: any) => pc.products).filter(Boolean);
  return {
    products: normalize(inner),
    categoryName: (data as any).name,
    categoryDescription: (data as any).description || null,
  };
}

type SortKey = 'relevance' | 'price-low' | 'price-high' | 'newest';

interface Props {
  mode: 'all' | 'category';
}

export function VividProductList({ mode }: Props) {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const [sort, setSort] = useState<SortKey>('relevance');

  const search = new URLSearchParams(location.search).get('search') || '';

  const cacheKey =
    mode === 'all'
      ? `products:all:${search || '_'}`
      : `products:cat:${slug || '_'}`;

  const { data, isLoading: loading } = useCached<ListResult>(
    cacheKey,
    () => (mode === 'all' ? fetchAll(search) : slug ? fetchByCategory(slug) : Promise.resolve({ products: [], categoryName: null, categoryDescription: null })),
    { ttl: 3 * 60_000, enabled: mode === 'all' || !!slug }
  );

  const products = data?.products || [];
  const categoryName = data?.categoryName || null;
  const categoryDescription = data?.categoryDescription || null;

  const sorted = useMemo(() => {
    const arr = [...products];
    const priceOf = (p: HomepageProduct) =>
      p.product_variants?.find((v) => v.is_default)?.price ||
      p.product_variants?.[0]?.price ||
      0;
    switch (sort) {
      case 'price-low':
        return arr.sort((a, b) => priceOf(a) - priceOf(b));
      case 'price-high':
        return arr.sort((a, b) => priceOf(b) - priceOf(a));
      case 'newest':
        return arr.sort(
          (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
      default:
        return arr;
    }
  }, [products, sort]);

  const title =
    mode === 'category' && categoryName
      ? categoryName
      : search
      ? `Search: "${search}"`
      : 'All Products';

  return (
    <>
      <SEOHead
        title={title}
        description={categoryDescription || 'Premium tobacco products'}
        url={`https://cigarro.in${location.pathname}`}
        type="website"
      />

      <div className="max-w-[1280px] mx-auto px-4 pt-6 pb-10 grid gap-5 md:grid-cols-[1fr_300px] lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{title}</h1>
            {categoryDescription && (
              <p className="text-[var(--color-muted-foreground)] text-sm mt-1">{categoryDescription}</p>
            )}
          </div>

          <div className="flex items-center justify-between mb-4">
            <p className="text-[var(--color-muted-foreground)] text-sm">
              {sorted.length} {sorted.length === 1 ? 'product' : 'products'}
            </p>
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="appearance-none bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg pl-9 pr-8 h-9 text-sm text-[var(--color-foreground)] focus:outline-none focus:border-[var(--color-primary)]"
              >
                <option value="relevance">Relevance</option>
                <option value="price-low">Price: Low → High</option>
                <option value="price-high">Price: High → Low</option>
                <option value="newest">Newest</option>
              </select>
              <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-muted)] pointer-events-none" />
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="vv-card flex items-center gap-4 p-3">
                  <div className="w-24 h-24 bg-[var(--color-surface-2)] rounded-lg animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-[var(--color-surface-2)] rounded animate-pulse" />
                    <div className="h-4 w-1/3 bg-[var(--color-surface-2)] rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-16 text-[var(--color-muted-foreground)]">
              No products found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sorted.map((p) => (
                <VividProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>

        <div className="hidden md:block">
          <VividCartPanel />
        </div>
      </div>
    </>
  );
}

function normalize(rows: any[]): HomepageProduct[] {
  return rows.map((p) => {
    const variants = p.product_variants?.filter((v: any) => v.is_active !== false) || [];
    const images = variants.flatMap((v: any) => v.images || []);
    return {
      ...p,
      brand: Array.isArray(p.brand) ? p.brand[0] : p.brand,
      product_variants: variants,
      gallery_images: images,
      image: images[0] || null,
    };
  });
}
