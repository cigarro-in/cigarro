import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Minus, Plus, ShoppingCart, Heart, ChevronLeft } from 'lucide-react';
import { useInlineStatus, InlineStatus } from '../../components/common/InlineStatus';
import { useCatalogProduct } from '../../hooks/data/useCatalog';
import { useCart } from '../../hooks/useCart';
import { useWishlist } from '../../hooks/useWishlist';
import { getProductImageUrl } from '../../lib/images/urls';
import { trackViewItemOnce } from '../../lib/analytics/ga';
import { SEOHead } from '../../components/seo/SEOHead';
import { ProductReviews } from '../../components/products/ProductReviews';
import type { ProductVariant } from '../../types/product';

interface Details {
  id: string;
  name: string;
  slug: string;
  description?: string;
  short_description?: string;
  brand?: { id: string; name: string };
  meta_title?: string;
  meta_description?: string;
}

const formatPrice = (n: number) => n.toLocaleString('en-IN');

export default function VividProduct() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Details | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selected, setSelected] = useState<ProductVariant | null>(null);
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const { addVariantToCart, addToCart, isLoading } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  // Wave 3: product + variants from the Convex catalog (same shapes).
  const { product: catalogProduct, loading: catalogLoading } = useCatalogProduct(slug);
  const { status: opStatus, setError: setOpError, setOk: setOpOk } = useInlineStatus();

  useEffect(() => {
    if (catalogLoading) return;
    setLoading(true);
    const data = catalogProduct && (catalogProduct as any).is_active !== false ? catalogProduct : null;
    if (data) {
      const p: any = data;
      setProduct({ ...p, brand: Array.isArray(p.brand) ? p.brand[0] : p.brand });
      const vars = (p.product_variants || []).filter((v: any) => v.is_active !== false);
      setVariants(vars);
      setSelected(vars.find((v: any) => v.is_default) || vars[0] || null);
    } else {
      setProduct(null);
      setVariants([]);
      setSelected(null);
    }
    setLoading(false);
  }, [slug, catalogProduct, catalogLoading]);

  useEffect(() => {
    setActiveImage(0);
  }, [selected]);

  // GA4 view_item: once per product slug, with the offered variant's price
  // (mirrors classic ProductPage; dedup is module-scoped, survives remounts).
  useEffect(() => {
    if (!product) return;
    const ov = selected ?? variants.find((v) => (v as any).is_default) ?? variants[0];
    if (!ov) return;
    trackViewItemOnce(product.slug, {
      id: String(product.slug),
      name: String(product.name),
      price: Number((ov as any).price ?? 0) || 0,
      quantity: 1,
    });
  }, [product, selected, variants]);

  if (loading) {
    return (
      <div className="px-4 py-10">
        <div className="animate-pulse space-y-4">
          <div className="aspect-square bg-[var(--color-surface)] rounded-xl" />
          <div className="h-6 w-2/3 bg-[var(--color-surface)] rounded" />
          <div className="h-4 w-1/3 bg-[var(--color-surface)] rounded" />
        </div>
      </div>
    );
  }

  if (!product) {
    return <div className="px-4 py-16 text-[var(--color-muted-foreground)]">Product not found.</div>;
  }

  const images = selected?.images?.length ? selected.images : variants[0]?.images || [];
  const price = selected?.price || 0;

  const handleAdd = async () => {
    try {
      if (selected) {
        await addVariantToCart(product as any, selected, qty);
      } else {
        await addToCart(product as any, qty);
      }
      setOpOk(`${product.name} added to cart`);
    } catch {
      setOpError('Could not add to cart');
    }
  };

  return (
    <>
      <SEOHead
        title={product.meta_title || product.name}
        description={product.meta_description || product.short_description || product.description || ''}
        url={`https://cigarro.in/product/${product.slug}`}
        type="product"
      />

      <div className="px-4 pt-3">
        <Link to="/products" className="inline-flex items-center gap-1 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)]">
          <ChevronLeft className="w-4 h-4" />
          Back
        </Link>
      </div>

      <div className="max-w-[1080px] mx-auto px-4 pt-4 grid gap-8 md:grid-cols-2">
        {/* Gallery — capped so it doesn't dominate on wide screens */}
        <div className="md:sticky md:top-20 md:self-start">
          <div className="max-w-[460px] mx-auto">
            <div className="aspect-square rounded-xl overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)]">
              <img
                src={getProductImageUrl(images[activeImage])}
                alt={(selected as any)?.image_alt_text || product.name}
                className="w-full h-full object-cover"
              />
            </div>
            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 flex-shrink-0 ${
                      i === activeImage ? 'border-[var(--color-primary)]' : 'border-[var(--color-border)]'
                  }`}
                >
                  <img src={getProductImageUrl(img)} alt={(selected as any)?.image_alt_text || `${product.name} thumbnail ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div>
          {product.brand?.name && (
            <p className="text-xs uppercase tracking-wider text-[var(--color-primary)] font-semibold mb-1">
              {product.brand.name}
            </p>
          )}
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-foreground)] mb-2">
            {product.name}
          </h1>
          <p className="text-3xl font-black text-[var(--color-foreground)] mb-4">
            ₹{formatPrice(price)}
          </p>

          {product.short_description && (
            <p className="text-[var(--color-muted-foreground)] text-sm mb-4 leading-relaxed">
              {product.short_description}
            </p>
          )}

          {variants.length > 1 && (
            <div className="mb-5">
              <p className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)] mb-2 font-semibold">
                Variant
              </p>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelected(v)}
                    className={`px-4 py-2 rounded-lg border text-sm ${
                      selected?.id === v.id
                        ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-foreground)]'
                    }`}
                  >
                    {v.variant_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-3"><InlineStatus status={opStatus} /></div>
          <div className="flex items-center gap-3 mb-5">
            <div className="inline-flex items-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full overflow-hidden">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-10 h-10 grid place-items-center text-[var(--color-foreground)]"
                aria-label="Decrease"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-8 text-center text-[var(--color-foreground)] font-semibold">{qty}</span>
              <button
                onClick={() => setQty((q) => q + 1)}
                className="w-10 h-10 grid place-items-center text-[var(--color-foreground)]"
                aria-label="Increase"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleAdd}
              disabled={isLoading}
              className="flex-1 vv-btn-primary inline-flex items-center justify-center gap-2 h-11"
            >
              <ShoppingCart className="w-4 h-4" />
              Add to Cart
            </button>

            <button
              onClick={() => toggleWishlist(product.id)}
              className="w-11 h-11 rounded-full border border-[var(--color-border)] flex items-center justify-center text-[var(--color-foreground)] hover:border-[var(--color-primary)]"
              aria-label="Wishlist"
            >
              <Heart className={`w-4 h-4 ${isWishlisted(product.id) ? 'fill-[var(--color-primary)] text-[var(--color-primary)]' : ''}`} />
            </button>
          </div>

          {product.description && (
            <div className="mt-8">
              <h3 className="text-sm uppercase tracking-wider text-[var(--color-muted-foreground)] font-semibold mb-2">
                Description
              </h3>
              <p className="text-[var(--color-foreground)] text-sm leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1080px] mx-auto px-4">
        <ProductReviews productSupabaseId={product.id} productName={product.name} />
      </div>

      <div className="h-10" />
    </>
  );
}
