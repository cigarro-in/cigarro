import { Link } from 'react-router-dom';
import { Check, Loader2, Plus } from 'lucide-react';
import { getProductImageUrl } from '../../lib/images/urls';
import { trackSelectItem } from '../../lib/analytics/ga';
import { useCart } from '../../hooks/useCart';
import type { HomepageProduct } from '../../types/home';
import { useActionFeedback } from './useActionFeedback';

interface Props {
  product: HomepageProduct;
  listName?: string;
}

const formatPrice = (n: number) => n.toLocaleString('en-IN');

export function VividProductCard({ product, listName = 'products' }: Props) {
  const { addToCart } = useCart();
  const add = useActionFeedback();

  const defaultVariant =
    product.product_variants?.find((v) => v.is_default) ||
    product.product_variants?.[0];
  const price = defaultVariant?.price || product.price || 0;
  const comparePrice = (defaultVariant as any)?.compare_at_price as number | undefined;
  const image = defaultVariant?.images?.[0] || product.image || undefined;

  const discount =
    comparePrice && comparePrice > price
      ? Math.round(((comparePrice - price) / comparePrice) * 100)
      : 0;

  const handleAdd = (e: React.MouseEvent) => {
    // The whole card is a link: the add button must not navigate.
    e.preventDefault();
    e.stopPropagation();
    if (add.busy) return;
    void add.run(() => addToCart(product as any, 1, defaultVariant?.id), 'Could not add');
  };

  const label =
    add.state === 'pending' ? 'Adding' : add.state === 'done' ? 'Added' : add.state === 'error' ? 'Retry' : 'Add';

  return (
    <Link
      to={`/product/${product.slug}`}
      onClick={() => trackSelectItem(product, listName)}
      className="vv-card flex items-center gap-3 sm:gap-4 p-3"
    >
      <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-[var(--color-surface-2)] flex-shrink-0">
        <img
          src={getProductImageUrl(image)}
          alt={(defaultVariant as any)?.image_alt_text || product.name}
          width={96}
          height={96}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
          // Thumbnails never compete with the hero (the page's LCP image) for bandwidth.
          fetchpriority="low"
        />
        {discount > 0 && <span className="vv-badge-discount">{discount}% OFF</span>}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="text-[var(--color-foreground)] font-semibold text-sm leading-snug line-clamp-2">
          {product.name}
        </h3>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
          <span className="text-[var(--color-foreground)] font-bold text-[15px]">
            ₹{formatPrice(price)}
          </span>
          {comparePrice && comparePrice > price && (
            <span className="text-[var(--color-muted-foreground)] text-xs line-through">
              ₹{formatPrice(comparePrice)}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 flex-shrink-0 max-w-[104px]">
        <button
          type="button"
          onClick={handleAdd}
          disabled={add.busy}
          aria-live="polite"
          data-state={add.state}
          className={`vv-btn-add ${add.state === 'done' ? 'vv-btn-add--done' : ''} ${add.state === 'error' ? 'vv-btn-add--error' : ''}`}
        >
          {add.state === 'pending' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {add.state === 'done' && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
          {(add.state === 'idle' || add.state === 'error') && <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />}
          {label}
        </button>
        {add.error && (
          <span role="alert" className="text-[11px] leading-tight text-[var(--vv-danger)] text-right">
            {add.error}
          </span>
        )}
      </div>
    </Link>
  );
}
