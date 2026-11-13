import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Check, Loader2, Minus, Plus, ShoppingCart, Heart, ChevronLeft } from 'lucide-react';
import { useCatalogProduct } from '../../hooks/data/useCatalog';
import { useCart } from '../../hooks/useCart';
import { useWishlist } from '../../hooks/useWishlist';
import { getProductImageUrl } from '../../lib/images/urls';
import { trackViewItemOnce } from '../../lib/analytics/ga';
import { SEOHead } from '../../components/seo/SEOHead';
import { BreadcrumbSchema } from '../../components/seo/BreadcrumbSchema';
import { useOrgInfo } from '../../lib/org/OrgContext';
import { useStoreSettings } from '../../hooks/data/useStoreSettings';
import { productBreadcrumbs, productSeoProps } from '../../lib/seo/productSeo';
import { sanitizeBlogBody } from '../../lib/blog/blogRender';
import { getDefaultVariant, getVariantKey, resolveProductCanonical } from '../../lib/seo/productOffer';
import { ProductReviews } from '../../components/products/ProductReviews';
import type { ProductVariant } from '../../types/product';
import { useActionFeedback } from './useActionFeedback';

interface Details {
  id: string;
  name: string;
  slug: string;
  description?: string;
  short_description?: string;
  brand?: { id: string; name: string };
  meta_title?: string;
  meta_description?: string;
  canonical_url?: string | null;
  rating_value?: number | null;
  review_count?: number | null;
}

const formatPrice = (n: number) => n.toLocaleString('en-IN');

export default function VividProduct() {
  const { primaryHost } = useOrgInfo();
  const { settings: storeSettings } = useStoreSettings();
  const { slug } = useParams<{ slug: string }>();
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  // The shopper's variant pick, scoped to the slug it was made on.
  const [picked, setPicked] = useState<{ slug: string; variantId: string } | null>(null);
  const { addVariantToCart, addToCart, isLoading } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  // Product + variants from the Convex catalog (preload-aware: same data on the
  // server render and the first client render). Derived, not effect-synced.
  const { product: catalogProduct, loading: catalogLoading } = useCatalogProduct(slug);
  // Button-level feedback only (no notices): the Add button shows pending/done/error.
  const addFeedback = useActionFeedback();
  const wishFeedback = useActionFeedback();

  const data = catalogProduct && (catalogProduct as any).is_active !== false ? (catalogProduct as any) : null;
  const product = useMemo<Details | null>(
    () => (data ? { ...data, brand: Array.isArray(data.brand) ? data.brand[0] : data.brand } : null),
    [data],
  );
  const variants = useMemo<ProductVariant[]>(
    () => ((data?.product_variants || []) as ProductVariant[]).filter((v) => v.is_active !== false),
    [data],
  );
  const loading = catalogLoading;

  // Variant precedence: the shopper's pick > ?variant=<key> > catalog default
  // (same rule as the classic ProductPage). A pick is written back to the URL.
  const [searchParams, setSearchParams] = useSearchParams();
  const urlVariantKey = (searchParams.get('variant') || '').toLowerCase();
  const variantFromUrl = urlVariantKey
    ? variants.find((v) => getVariantKey(v) === urlVariantKey) ?? null
    : null;
  const pickedId = picked && picked.slug === slug ? picked.variantId : null;
  const selected: ProductVariant | null =
    variants.find((v) => v.id === pickedId) ??
    variantFromUrl ??
    getDefaultVariant<ProductVariant>(variants);
  const setSelected = (variant: ProductVariant) => {
    setPicked({ slug: slug ?? '', variantId: variant.id });
    // Replace, not push: the variant is part of the page's address, not a history step.
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const key = getVariantKey(variant);
        if (key) next.set('variant', key);
        return next;
      },
      { replace: true },
    );
  };

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

  const handleAdd = () => {
    if (addFeedback.busy) return;
    void addFeedback.run(
      () => (selected ? addVariantToCart(product as any, selected, qty) : addToCart(product as any, qty)),
      'Could not add to cart',
    );
  };

  const handleWishlist = () => {
    if (wishFeedback.busy) return;
    void wishFeedback.run(() => toggleWishlist(product.id), 'Could not update wishlist');
  };

  return (
    <>
      <SEOHead
        {...productSeoProps(product, variants, primaryHost, storeSettings.name)}
      />
      <BreadcrumbSchema
        items={productBreadcrumbs(product, primaryHost, resolveProductCanonical(product.canonical_url, `https://${primaryHost}/product/${product.slug}`))}
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

          <div className="flex items-center gap-3 mb-1">
            <div className="inline-flex items-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full overflow-hidden">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-11 h-11 grid place-items-center text-[var(--color-foreground)]"
                aria-label="Decrease"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-8 text-center text-[var(--color-foreground)] font-semibold">{qty}</span>
              <button
                onClick={() => setQty((q) => q + 1)}
                className="w-11 h-11 grid place-items-center text-[var(--color-foreground)]"
                aria-label="Increase"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleAdd}
              disabled={isLoading || addFeedback.busy}
              aria-live="polite"
              data-state={addFeedback.state}
              className={`flex-1 vv-btn-primary inline-flex items-center justify-center gap-2 h-11 ${
                addFeedback.state === 'done' ? '!bg-[var(--vv-success)] !border-[var(--vv-success)]' : ''
              } ${addFeedback.state === 'error' ? '!bg-[var(--vv-danger)] !border-[var(--vv-danger)]' : ''}`}
            >
              {addFeedback.state === 'pending' && <Loader2 className="w-4 h-4 animate-spin" />}
              {addFeedback.state === 'done' && <Check className="w-4 h-4" strokeWidth={3} />}
              {(addFeedback.state === 'idle' || addFeedback.state === 'error') && <ShoppingCart className="w-4 h-4" />}
              {addFeedback.state === 'pending'
                ? 'Adding...'
                : addFeedback.state === 'done'
                  ? 'Added to cart'
                  : addFeedback.state === 'error'
                    ? 'Try again'
                    : 'Add to Cart'}
            </button>

            <button
              type="button"
              onClick={handleWishlist}
              disabled={wishFeedback.busy}
              aria-pressed={isWishlisted(product.id)}
              className="w-11 h-11 shrink-0 rounded-full border border-[var(--color-border)] flex items-center justify-center text-[var(--color-foreground)] hover:border-[var(--color-primary)] disabled:opacity-60"
              aria-label={isWishlisted(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart className={`w-4 h-4 ${isWishlisted(product.id) ? 'fill-[var(--color-primary)] text-[var(--color-primary)]' : ''}`} />
            </button>
          </div>
          {(addFeedback.error || wishFeedback.error) && (
            <p role="alert" className="mb-4 text-sm text-[var(--vv-danger)]">
              {addFeedback.error || wishFeedback.error}
            </p>
          )}

          {product.description && (
            <div className="mt-8">
              <h3 className="text-sm uppercase tracking-wider text-[var(--color-muted-foreground)] font-semibold mb-2">
                Description
              </h3>
              {/* Descriptions are HTML (cleaned on import) or legacy plain text; sanitizeBlogBody keeps only the allowlist. */}
              <div
                className={`text-[var(--color-foreground)] text-sm leading-relaxed [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_li]:mb-1 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_strong]:font-semibold [&_a]:underline ${/<[a-z][\s\S]*>/i.test(product.description) ? '' : 'whitespace-pre-line'}`}
                dangerouslySetInnerHTML={{ __html: sanitizeBlogBody(product.description) }}
              />
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
