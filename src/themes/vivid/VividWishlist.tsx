import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase/client';
import { useWishlist } from '../../hooks/useWishlist';
import { SEOHead } from '../../components/seo/SEOHead';
import { VividProductCard } from './VividProductCard';
import type { HomepageProduct } from '../../types/home';

export function VividWishlist() {
  const { wishlistItems, clearWishlist } = useWishlist();
  const [products, setProducts] = useState<HomepageProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!wishlistItems || wishlistItems.length === 0) {
        if (!cancelled) {
          setProducts([]);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from('products')
        .select(
          'id, name, slug, brand_id, description, is_active, created_at, brand:brands(id, name), product_variants(id, variant_name, price, is_default, is_active, images)'
        )
        .in('id', wishlistItems)
        .eq('is_active', true);
      if (cancelled) return;
      const rows = (data || []).map((p: any) => {
        const variants = (p.product_variants || []).filter((v: any) => v.is_active !== false);
        const images = variants.flatMap((v: any) => v.images || []);
        return {
          ...p,
          brand: Array.isArray(p.brand) ? p.brand[0] : p.brand,
          product_variants: variants,
          gallery_images: images,
          image: images[0] || null,
        };
      });
      setProducts(rows);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [wishlistItems]);

  const handleClear = async () => {
    if (!confirm('Clear your entire wishlist?')) return;
    try {
      await clearWishlist();
      toast.success('Wishlist cleared');
    } catch {
      toast.error('Failed to clear wishlist');
    }
  };

  return (
    <>
      <SEOHead title="Wishlist" description="Your saved items" url="https://cigarro.in/wishlist" type="website" />

      <div className="max-w-[1280px] mx-auto px-4 py-6">
        <header className="vv-page-header flex items-start justify-between gap-4">
          <div>
            <h1 className="vv-page-title">Wishlist</h1>
            <p className="vv-page-subtitle">
              {products.length > 0
                ? `${products.length} saved item${products.length > 1 ? 's' : ''}`
                : 'Save items you like for later.'}
            </p>
          </div>
          {products.length > 0 && (
            <button onClick={handleClear} className="vv-btn vv-btn-outline vv-btn--sm text-[var(--vv-danger)]">
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear all</span>
            </button>
          )}
        </header>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="vv-card flex items-center gap-4 p-3">
                <div className="w-24 h-24 vv-skeleton rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 vv-skeleton" />
                  <div className="h-4 w-1/3 vv-skeleton" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="vv-empty">
            <div className="vv-empty-icon"><Heart className="w-6 h-6" /></div>
            <p className="vv-empty-title">Your wishlist is empty</p>
            <p className="text-sm">Tap the heart on any product to save it.</p>
            <Link to="/products" className="vv-btn-primary mt-5 inline-flex">Explore products</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {products.map((p) => (
              <VividProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
