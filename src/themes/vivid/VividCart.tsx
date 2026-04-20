import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useCart } from '../../hooks/useCart';
import { useAuth } from '../../hooks/useAuth';
import { PhoneAuthDialog } from '../../components/auth/PhoneAuthDialog';
import { getProductImageUrl } from '../../lib/supabase/storage';

const formatPrice = (n: number) => n.toLocaleString('en-IN');

export default function VividCart() {
  const { items, totalPrice, totalItems, updateQuantity, removeFromCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);

  const handleCheckout = () => {
    if (!user) {
      setAuthOpen(true);
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
                <div className="mt-2 inline-flex items-center bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-full">
                  <button
                    onClick={() => updateQuantity(item.id, Math.max(0, item.quantity - 1), item.variant_id, item.combo_id)}
                    className="w-7 h-7 grid place-items-center text-[var(--color-foreground)]"
                    aria-label="Decrease"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-7 text-center text-[var(--color-foreground)] text-xs font-semibold">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1, item.variant_id, item.combo_id)}
                    className="w-7 h-7 grid place-items-center text-[var(--color-foreground)]"
                    aria-label="Increase"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
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

      <PhoneAuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        onAuthSuccess={() => navigate('/checkout')}
      />
    </div>
  );
}
