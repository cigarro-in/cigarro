import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { getProductImageUrl } from '../../lib/supabase/storage';
import { useCart } from '../../hooks/useCart';
import type { HomepageProduct } from '../../types/home';

interface Props {
  product: HomepageProduct;
}

const formatPrice = (n: number) => n.toLocaleString('en-IN');

export function VividProductCard({ product }: Props) {
  const { addToCart } = useCart();

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

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await addToCart(product as any, 1, defaultVariant?.id);
      toast.success(`${product.name} added`);
    } catch {
      toast.error('Could not add to cart');
    }
  };

  return (
    <Link
      to={`/product/${product.slug}`}
      className="vv-card flex items-center gap-4 p-3"
    >
      <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-[var(--color-surface-2)] flex-shrink-0">
        <img
          src={getProductImageUrl(image)}
          alt={product.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {discount > 0 && <span className="vv-badge-discount">{discount}% OFF</span>}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="text-[var(--color-foreground)] font-semibold text-sm leading-snug line-clamp-2">
          {product.name}
        </h3>
        <div className="mt-1.5 flex items-baseline gap-2">
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

      <button onClick={handleAdd} className="vv-btn-add flex-shrink-0">
        Add
        <Plus className="w-3 h-3" strokeWidth={2.5} />
      </button>
    </Link>
  );
}
