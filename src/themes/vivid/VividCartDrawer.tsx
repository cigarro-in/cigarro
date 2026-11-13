import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Trash2, X } from 'lucide-react';
import { useCart } from '../../hooks/useCart';
import { useAuth, useAuthDialog } from '../../hooks/useAuth';
import { QuantityStepper } from '../../components/cart/QuantityStepper';
import { getProductImageUrl } from '../../lib/images/urls';

interface Props {
  open: boolean;
  onClose: () => void;
}

const formatPrice = (n: number) => n.toLocaleString('en-IN');

/**
 * Cart drawer from the header cart button. Same structure as the classic
 * MiniCart: title and count on top, lines in the middle, subtotal and
 * checkout at the bottom. Restyled with vivid tokens, and the cart's own
 * copy of the price logic is not repeated here (getCartItemPrice).
 */
export function VividCartDrawer({ open, onClose }: Props) {
  const { items, totalPrice, totalItems, updateQuantity, removeFromCart, getCartItemPrice } = useCart();
  const { user } = useAuth();
  const { requestAuth } = useAuthDialog();
  const navigate = useNavigate();
  const [opError, setOpError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const proceed = () => {
    onClose();
    if (user) {
      navigate('/checkout');
    } else {
      requestAuth({ onSuccess: () => navigate('/checkout') });
    }
  };

  const changeQty = (productId: string, next: number, variantId?: string, comboId?: string) => {
    setOpError(null);
    updateQuantity(productId, next, variantId, comboId).catch(() => setOpError('Could not update quantity. Try again.'));
  };

  const remove = (productId: string, variantId?: string, comboId?: string) => {
    setOpError(null);
    removeFromCart(productId, variantId, comboId).catch(() => setOpError('Could not remove this item. Try again.'));
  };

  return (
    <div className={`fixed inset-0 z-[70] ${open ? '' : 'invisible pointer-events-none'}`} aria-hidden={!open}>
      <div
        className={`absolute inset-0 bg-[var(--vv-bg-overlay)] transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className={`absolute right-0 top-0 bottom-0 w-[min(400px,92vw)] flex flex-col bg-[var(--color-surface)] border-l border-[var(--color-border)] shadow-[var(--vv-shadow-lg)] transition-transform duration-200 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center gap-2 h-16 px-3 border-b border-[var(--color-border)]">
          <button type="button" onClick={onClose} className="vv-icon-btn" aria-label="Close cart">
            <X className="w-5 h-5" />
          </button>
          <h2 className="font-bold text-base text-[var(--color-foreground)]">
            Shopping cart{totalItems > 0 && <span className="text-[var(--color-muted-foreground)] font-medium"> ({totalItems})</span>}
          </h2>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10">
            <div className="w-16 h-16 rounded-full bg-[var(--color-surface-2)] grid place-items-center mb-4">
              <ShoppingBag className="w-7 h-7 text-[var(--color-muted)]" />
            </div>
            <p className="font-semibold text-[var(--color-foreground)]">Your cart is empty</p>
            <p className="text-sm text-[var(--color-muted-foreground)] mt-1 mb-6">Add some products to get started.</p>
            <Link to="/products" onClick={onClose} className="vv-btn-primary">
              Continue shopping
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-[var(--color-border)]">
              {opError && (
                <p role="alert" className="px-4 pt-3 vv-inline-error">{opError}</p>
              )}
              {items.map((item, index) => {
                const linePrice = getCartItemPrice(item) * item.quantity;
                const image = (item as any).product_variants?.[0]?.images?.[0] || (item as any).gallery_images?.[0] || (item as any).image;
                return (
                  <div key={`cart-${item.id || index}-${item.variant_id || 'base'}-${item.combo_id || 'none'}`} className="flex gap-3 p-4">
                    <div className="w-16 h-16 rounded-[var(--vv-radius-md)] overflow-hidden bg-[var(--color-surface-2)] flex-shrink-0">
                      <img src={getProductImageUrl(image)} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-foreground)] leading-snug line-clamp-2">
                        {item.name}
                        {item.variant_name && <span className="font-normal text-[var(--color-muted-foreground)]"> ({item.variant_name})</span>}
                      </p>
                      {item.combo_name && (
                        <p className="text-xs font-semibold text-[var(--color-primary)] mt-0.5">Combo pack</p>
                      )}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <QuantityStepper
                          quantity={item.quantity}
                          onChange={(next) => changeQty(item.id, next, item.variant_id, item.combo_id)}
                          min={1}
                          size="sm"
                          className="rounded-[var(--vv-radius-md)] border border-[var(--color-border)]"
                          buttonClassName="text-[var(--color-foreground)]"
                          valueClassName="text-[var(--color-foreground)]"
                        />
                        <span className="text-sm font-bold text-[var(--color-foreground)]">₹{formatPrice(linePrice)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(item.id, item.variant_id, item.combo_id)}
                      className="vv-icon-btn -mr-2 self-start"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-[var(--color-border)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--color-foreground)]">Subtotal</span>
                <span className="font-bold text-lg text-[var(--color-foreground)]">₹{formatPrice(totalPrice)}</span>
              </div>
              <p className="text-xs text-[var(--color-muted-foreground)]">Delivery is calculated at checkout.</p>
              <button type="button" onClick={proceed} className="vv-btn-primary w-full h-11">
                {user ? 'Proceed to checkout' : 'Sign in to checkout'}
              </button>
              <Link to="/cart" onClick={onClose} className="flex min-h-[44px] items-center justify-center text-sm font-semibold text-[var(--color-foreground)] underline underline-offset-4">
                View full cart
              </Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
