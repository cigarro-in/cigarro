import { Link } from 'react-router-dom';
import { ShoppingBag, Minus, Plus, Trash2 } from 'lucide-react';
import { useCart } from '../../hooks/useCart';
import { getProductImageUrl } from '../../lib/supabase/storage';

const formatPrice = (n: number) => n.toLocaleString('en-IN');

export function VividCartPanel() {
  const { items, totalPrice, totalItems, updateQuantity, removeFromCart } = useCart();

  return (
    <aside className="vv-card sticky top-20 overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <h3 className="text-[var(--color-foreground)] font-bold text-base">Cart {totalItems > 0 && `(${totalItems})`}</h3>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[var(--color-surface-2)] grid place-items-center">
            <ShoppingBag className="w-6 h-6 text-[var(--color-muted)]" />
          </div>
          <p className="text-[var(--color-foreground)] font-semibold text-sm">Your cart is empty</p>
          <p className="text-[var(--color-muted-foreground)] text-xs mt-1">
            Looks like you haven't made your choice yet.
          </p>
        </div>
      ) : (
        <>
          <div className="max-h-[420px] overflow-y-auto divide-y divide-[var(--color-border)]">
            {items.map((item) => {
              const price = item.variant_price || item.combo_price || item.price || 0;
              const image = (item as any).image || (item as any).variant_images?.[0];
              return (
                <div key={`${item.id}-${item.variant_id || ''}`} className="p-3 flex gap-3 items-center">
                  <div className="w-12 h-12 rounded-md overflow-hidden bg-[var(--color-surface-2)] flex-shrink-0">
                    <img src={getProductImageUrl(image)} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[var(--color-foreground)] text-xs font-semibold truncate">{item.name}</p>
                    <p className="text-[var(--color-muted-foreground)] text-[11px]">₹{formatPrice(price)}</p>
                    <div className="mt-1 inline-flex items-center rounded-md border border-[var(--color-border)]">
                      <button
                        onClick={() => updateQuantity(item.id, Math.max(0, item.quantity - 1), item.variant_id, item.combo_id)}
                        className="w-6 h-6 grid place-items-center text-[var(--color-foreground)]"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-[11px] font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1, item.variant_id, item.combo_id)}
                        className="w-6 h-6 grid place-items-center text-[var(--color-foreground)]"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id, item.variant_id, item.combo_id)}
                    className="text-[var(--color-muted)] hover:text-[var(--color-accent)]"
                    aria-label="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="p-4 border-t border-[var(--color-border)]">
            <div className="flex items-center justify-between text-sm mb-3">
              <span className="text-[var(--color-muted-foreground)]">Subtotal</span>
              <span className="text-[var(--color-foreground)] font-bold">₹{formatPrice(totalPrice)}</span>
            </div>
            <Link to="/cart" className="vv-btn-primary w-full block text-center">
              View Cart
            </Link>
          </div>
        </>
      )}
    </aside>
  );
}
