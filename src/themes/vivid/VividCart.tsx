import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, ShoppingBag } from 'lucide-react';
import { useCart } from '../../hooks/useCart';
import { useAuth, useAuthDialog } from '../../hooks/useAuth';
import { QuantityStepper } from '../../components/cart/QuantityStepper';
import { useInlineStatus, InlineStatus } from '../../components/common/InlineStatus';
import { getProductImageUrl } from '../../lib/images/urls';
import { trackViewCart } from '../../lib/analytics/ga';

const formatPrice = (n: number) => n.toLocaleString('en-IN');

export default function VividCart() {
  const { items, totalPrice, totalItems, updateQuantity, removeFromCart } = useCart();
  const { user } = useAuth();
  const { requestAuth } = useAuthDialog();
  const navigate = useNavigate();
  const { status: opStatus, setError: setOpError } = useInlineStatus();

  // GA4 view_cart: once per distinct cart content.
  const cartSentRef = useRef<string | null>(null);
  useEffect(() => {
    if (items.length === 0) return;
    const key = items.map((i: any) => `${i.id}:${i.variant_id || ''}:${i.combo_id || ''}:${i.quantity}`).join('|');
    if (cartSentRef.current === key) return;
    cartSentRef.current = key;
    trackViewCart(items, totalPrice);
  }, [items, totalPrice]);

  const handleCheckout = () => {
    if (!user) {
      requestAuth({ onSuccess: () => navigate('/checkout') });
      return;
    }
    navigate('/checkout');
  };

  if (items.length === 0) {
    return (
      <div className="max-w-screen-md mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-[var(--color-surface)] flex items-center justify-center mx-auto mb-4">
          <ShoppingBag className="w-7 h-7 text-[var(--color-muted-foreground)]" />
        </div>
        <h1 className="text-xl font-bold text-[var(--color-foreground)] mb-2">Your cart is empty</h1>
        <p className="text-[var(--color-muted-foreground)] text-sm mb-6">
          Add a few products to get started.
        </p>
        <Link to="/products" className="vv-btn-primary inline-block">
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-screen-md mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-[var(--color-foreground)] mb-4">
        Cart ({totalItems})
      </h1>

      <InlineStatus status={opStatus} />

      <div className="space-y-3">
        {items.map((item) => {
          const price = item.variant_price || item.combo_price || item.price || 0;
          const image = (item as any).image || (item as any).variant_images?.[0];
          return (
            <div
              key={`${item.id}-${item.variant_id || ''}-${item.combo_id || ''}`}
              className="vv-card flex gap-3 p-3 items-center"
            >
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-[var(--color-surface-2)] flex-shrink-0">
                <img
                  src={getProductImageUrl(image)}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[var(--color-foreground)] font-medium text-sm truncate">
                  {item.name}
                </p>
                <p className="text-[var(--color-muted-foreground)] text-xs">
                  ₹{formatPrice(price)}
                </p>
                <QuantityStepper
                  quantity={item.quantity}
                  onChange={(next) =>
                    updateQuantity(item.id, next, item.variant_id, item.combo_id).catch(() =>
                      setOpError('Failed to update quantity'),
                    )
                  }
                  min={0}
                  size="sm"
                  className="mt-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-full"
                  buttonClassName="text-[var(--color-foreground)]"
                  valueClassName="text-[var(--color-foreground)] text-xs"
                />
              </div>
              <div className="text-right flex flex-col items-end gap-2">
                <span className="text-[var(--color-foreground)] font-bold text-sm">
                  ₹{formatPrice(price * item.quantity)}
                </span>
                <button
                  onClick={() => removeFromCart(item.id, item.variant_id, item.combo_id)}
                  className="text-[var(--color-muted)] hover:text-[var(--color-primary)]"
                  aria-label="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 vv-card p-4">
        <div className="flex items-center justify-between text-sm text-[var(--color-muted-foreground)] mb-1">
          <span>Subtotal</span>
          <span>₹{formatPrice(totalPrice)}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-[var(--color-muted-foreground)] mb-3">
          <span>Delivery</span>
          <span>Calculated at checkout</span>
        </div>
        <div className="border-t border-[var(--color-border)] pt-3 flex items-center justify-between mb-4">
          <span className="text-[var(--color-foreground)] font-bold">Total</span>
          <span className="text-[var(--color-foreground)] font-black text-lg">
            ₹{formatPrice(totalPrice)}
          </span>
        </div>
        <button
          onClick={handleCheckout}
          className="vv-btn-primary w-full h-11 text-sm"
        >
          {user ? 'Proceed to Checkout' : 'Sign in to checkout'}
        </button>
      </div>

    </div>
  );
}
