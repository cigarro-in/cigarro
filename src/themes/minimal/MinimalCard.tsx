import { Link } from 'react-router-dom';
import type { LegacyProduct } from '../../hooks/data/useCatalog';
import { getProductImageUrl } from '../../lib/images/urls';
import { ROUTES } from '../../config/routes';

// Product tile in the reference grid: square image, name, price with the strike-through
// MRP when the source had one. Presentational only; the data comes from the caller.

export const dkRupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export function dkProductHref(slug: string) {
  return ROUTES.PRODUCT_DETAIL.replace(':slug', encodeURIComponent(slug));
}

export function MinimalCard({ product }: { product: LegacyProduct }) {
  const variants = (product.product_variants || []).filter((v) => v.is_active !== false);
  const def = variants.find((v) => v.is_default) || variants[0];
  const price = def?.price ?? product.price ?? 0;
  const was = def?.compare_at_price && def.compare_at_price > price ? def.compare_at_price : null;
  const img = product.image ? getProductImageUrl(product.image) : '';
  return (
    <article className="dk-card">
      <Link to={dkProductHref(product.slug)} className="dk-card-media" aria-label={product.name}>
        {img ? (
          <img src={img} alt={product.name} loading="lazy" decoding="async" width={400} height={400} />
        ) : (
          <span className="dk-card-placeholder" aria-hidden="true" />
        )}
      </Link>
      <div className="dk-card-body">
        <h3 className="dk-card-title">
          <Link to={dkProductHref(product.slug)}>{product.name}</Link>
        </h3>
        <p className="dk-price">
          <span className="dk-price-now">{dkRupees(price)}</span>
          {was && <s className="dk-price-was">{dkRupees(was)}</s>}
        </p>
      </div>
    </article>
  );
}
