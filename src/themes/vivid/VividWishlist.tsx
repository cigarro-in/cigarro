import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Heart, Loader2, Trash2 } from 'lucide-react';
import { useWishlist } from '../../hooks/useWishlist';
import { useFullCatalog } from '../../hooks/data/useCatalog';
import { SEOHead } from '../../components/seo/SEOHead';
import { VividProductCard } from './VividProductCard';
import type { HomepageProduct } from '../../types/home';
import { useActionFeedback } from './useActionFeedback';

export function VividWishlist() {
  const { wishlistItems, clearWishlist } = useWishlist();
  const [products, setProducts] = useState<HomepageProduct[]>([]);
  const [loading, setLoading] = useState(true);
  // Wave 3: wishlist rows from the Convex catalog (same shapes).
  const { products: catalogProducts, loading: catalogLoading } = useFullCatalog();
  const clearFeedback = useActionFeedback();

  useEffect(() => {
    if (catalogLoading) return;
    if (!wishlistItems || wishlistItems.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const wanted = new Set(wishlistItems);
    const rows = (catalogProducts as any[])
      .filter((p: any) => wanted.has(p.id) && p.is_active)
      .map((p: any) => {
        const variants = (p.product_variants || []).filter((v: any) => v.is_active !== false);
        const images = variants.flatMap((v: any) => v.images || []);
        return {
          ...p,
          product_variants: variants,
          gallery_images: images,
          image: images[0] || null,
        };
      });
    setProducts(rows);
    setLoading(false);
  }, [wishlistItems, catalogProducts, catalogLoading]);

  const handleClear = () => {
    if (clearFeedback.busy || !confirm('Clear your entire wishlist?')) return;
    void clearFeedback.run(() => clearWishlist(), 'Could not clear wishlist');
  };

  return (
    <>
      <SEOHead title="Wishlist" description="Your saved items" url="/wishlist" type="website" />

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
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                onClick={handleClear}
                disabled={clearFeedback.busy}
                aria-live="polite"
                className={`vv-btn vv-btn-outline text-[var(--vv-danger)] ${clearFeedback.state === 'done' ? '!text-[var(--vv-success)]' : ''}`}
              >
                {clearFeedback.state === 'pending' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : clearFeedback.state === 'done' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>
                  {clearFeedback.state === 'pending' ? 'Clearing...' : clearFeedback.state === 'done' ? 'Cleared' : clearFeedback.state === 'error' ? 'Try again' : 'Clear all'}
                </span>
              </button>
              {clearFeedback.error && (
                <span role="alert" className="text-xs text-[var(--vv-danger)]">{clearFeedback.error}</span>
              )}
            </div>
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
