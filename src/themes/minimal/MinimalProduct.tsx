import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCatalogProduct, type LegacyVariant } from '../../hooks/data/useCatalog';
import { useCart } from '../../hooks/useCart';
import { useStoreSettings } from '../../hooks/data/useStoreSettings';
import { useOrgInfo } from '../../lib/org/OrgContext';
import { useInlineStatus, InlineStatus } from '../../components/common/InlineStatus';
import { SEOHead } from '../../components/seo/SEOHead';
import { BreadcrumbSchema } from '../../components/seo/BreadcrumbSchema';
import { productBreadcrumbs, productSeoProps } from '../../lib/seo/productSeo';
import { resolveProductCanonical } from '../../lib/seo/productOffer';
import { getProductImageUrl } from '../../lib/images/urls';
import { ROUTES } from '../../config/routes';
import { dkRupees } from './MinimalCard';

// Product page in the reference layout: gallery left, buy box right (name as the single h1,
// price with MRP, variant chips, quantity, add to cart), description below.
// Server-rendered (eager, see ssrRoutes). Cart writes go through useCart.

export default function MinimalProduct() {
  const { primaryHost } = useOrgInfo();
  const { settings } = useStoreSettings();
  const { slug } = useParams<{ slug: string }>();
  const { product: catalogProduct, loading } = useCatalogProduct(slug);
  const { addVariantToCart, addToCart, isLoading } = useCart();
  const status = useInlineStatus();
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [picked, setPicked] = useState<{ slug: string; variantId: string } | null>(null);

  const product = catalogProduct && (catalogProduct as any).is_active !== false ? (catalogProduct as any) : null;
  const variants = useMemo<LegacyVariant[]>(
    () => (product?.product_variants || []).filter((v: LegacyVariant) => v.is_active !== false),
    [product],
  );
  const defaultVariant = variants.find((v) => v.is_default) || variants[0];
  const selected =
    picked && picked.slug === slug ? variants.find((v) => v.id === picked.variantId) : undefined;
  const current = selected ?? defaultVariant;
  const gallery: string[] = useMemo(() => {
    const imgs = [...(product?.gallery_images || [])];
    return imgs.length ? [...new Set(imgs)] : product?.image ? [product.image] : [];
  }, [product]);

  if (loading) {
    return <div className="dk-wrap dk-section"><p className="dk-muted">Loading…</p></div>;
  }
  if (!product) {
    return (
      <div className="dk-wrap dk-section">
        <h1 className="dk-section-title">Product not found</h1>
        <Link to={ROUTES.PRODUCTS}>Back to all products</Link>
      </div>
    );
  }

  const price = current?.price ?? product.price ?? 0;
  const was = current?.compare_at_price && current.compare_at_price > price ? current.compare_at_price : null;
  const inStock = current ? current.stock == null || current.stock > 0 : true;
  const canonical = resolveProductCanonical(product.canonical_url, `https://${primaryHost}/product/${product.slug}`);

  const onAdd = async () => {
    try {
      if (selected) await addVariantToCart(product as any, selected as any, qty);
      else await addToCart(product as any, qty);
      status.setOk(`${product.name} added to cart`);
    } catch {
      status.setError('Could not add this to your cart. Try again.');
    }
  };

  const photo = gallery[activeImage] ?? gallery[0];

  return (
    <div className="dk-wrap dk-section dk-pdp">
      <SEOHead
        {...productSeoProps(product, variants as any, primaryHost, settings.name)}
        url={canonical}
      />
      <BreadcrumbSchema items={productBreadcrumbs(product, primaryHost, canonical)} />

      <nav className="dk-crumbs" aria-label="Breadcrumb">
        <Link to={ROUTES.HOME}>Home</Link>
        <span aria-hidden="true"> / </span>
        <Link to={ROUTES.PRODUCTS}>Shop all</Link>
      </nav>

      <div className="dk-pdp-grid">
        <div className="dk-gallery">
          <div className="dk-gallery-main">
            {photo ? (
              <img src={getProductImageUrl(photo)} alt={product.name} width={800} height={800} fetchPriority="high" decoding="async" />
            ) : (
              <span className="dk-card-placeholder" aria-hidden="true" />
            )}
          </div>
          {gallery.length > 1 && (
            <ul className="dk-thumbs">
              {gallery.map((g, i) => (
                <li key={g}>
                  <button
                    type="button"
                    aria-label={`Show image ${i + 1}`}
                    aria-pressed={i === activeImage}
                    onClick={() => setActiveImage(i)}
                  >
                    <img src={getProductImageUrl(g)} alt="" width={72} height={72} loading="lazy" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="dk-buybox">
          <h1 className="dk-pdp-title">{product.name}</h1>
          <p className="dk-price dk-price-lg">
            <span className="dk-price-now">{dkRupees(price)}</span>
            {was && <s className="dk-price-was">{dkRupees(was)}</s>}
          </p>
          {!inStock && <p className="dk-muted">Out of stock</p>}

          {variants.length > 1 && (
            <div className="dk-variants" role="radiogroup" aria-label="Choose an option">
              {variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={v.id === current?.id}
                  className={`dk-chip ${v.id === current?.id ? 'is-on' : ''}`}
                  onClick={() => setPicked({ slug: slug ?? '', variantId: v.id })}
                >
                  {v.variant_name}
                  <span className="dk-chip-price">{dkRupees(v.price)}</span>
                </button>
              ))}
            </div>
          )}

          <div className="dk-buy-row">
            <div className="dk-qty" role="group" aria-label="Quantity">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease">−</button>
              <span aria-live="polite">{qty}</span>
              <button type="button" onClick={() => setQty((q) => Math.min(99, q + 1))} aria-label="Increase">+</button>
            </div>
            <button type="button" className="dk-btn dk-btn-primary dk-btn-block" onClick={() => void onAdd()} disabled={isLoading || !inStock}>
              Add to cart
            </button>
          </div>
          <InlineStatus status={status.status} />
        </div>
      </div>

      {product.description && (
        <section className="dk-desc" aria-labelledby="dk-desc-title">
          <h2 id="dk-desc-title" className="dk-section-title">Description</h2>
          <div className="dk-prose" dangerouslySetInnerHTML={{ __html: product.description }} />
        </section>
      )}
    </div>
  );
}
