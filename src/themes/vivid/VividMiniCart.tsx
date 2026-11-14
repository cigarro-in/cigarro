import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Trash2 } from 'lucide-react';
import { QuantityStepper } from '../../components/cart/QuantityStepper';
import { getProductImageUrl } from '../../lib/images/urls';
import { VividCartButton } from './VividHeaderParts';
import { useVividCartActions } from './useVividCartActions';

const PANEL_ID = 'vv-mini-cart';
const formatPrice = (n: number) => n.toLocaleString('en-IN');

/**
 * Desktop cart. The header cart icon opens a dropdown anchored under it.
 * It closes on outside click, Escape, or when a link inside it is followed.
 */
export function VividMiniCart() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const { items, totalItems, totalPrice, getCartItemPrice, user, opError, proceed, changeQty, remove } =
    useVividCartActions(close);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: Event) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <VividCartButton
        count={totalItems}
        onClick={() => setOpen((o) => !o)}
        expanded={open}
        controls={PANEL_ID}
      />

      {open && (
        <div
          id={PANEL_ID}
          role="dialog"
          aria-label="Shopping cart"
          className="absolute right-0 top-full mt-2 z-50 w-[380px] max-w-[92vw] overflow-hidden rounded-[var(--vv-radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--vv-shadow-lg)]"
        >
          <div className="px-4 py-3 border-b border-[var(--color-border)]">
            <h2 className="font-bold text-base text-[var(--color-foreground)]">
              Shopping cart{totalItems > 0 && <span className="font-medium text-[var(--color-muted-foreground)]"> ({totalItems})</span>}
            </h2>
          </div>

          {opError && <p role="alert" className="px-4 pt-3 vv-inline-error">{opError}</p>}

          {items.length === 0 ? (
            <div className="flex flex-col items-center text-center px-6 py-8">
              <div className="w-14 h-14 rounded-full bg-[var(--color-surface-2)] grid place-items-center mb-3">
                <ShoppingBag className="w-6 h-6 text-[var(--color-muted)]" />
              </div>
              <p className="font-semibold text-sm text-[var(--color-foreground)]">Your cart is empty</p>
              <p className="text-xs text-[var(--color-muted-foreground)] mt-1 mb-4">Add some products to get started.</p>
              <Link to="/products" onClick={close} className="vv-btn-primary">
                Continue shopping
              </Link>
            </div>
          ) : (
            <>
              <div className="max-h-[360px] overflow-y-auto overscroll-contain divide-y divide-[var(--color-border)]">
                {items.map((item, index) => {
                  const linePrice = getCartItemPrice(item) * item.quantity;
                  const image = (item as any).product_variants?.[0]?.images?.[0] || (item as any).gallery_images?.[0] || (item as any).image;
                  return (
                    <div key={`mini-${item.id || index}-${item.variant_id || 'base'}-${item.combo_id || 'none'}`} className="flex gap-3 p-3">
                      <div className="w-14 h-14 rounded-[var(--vv-radius-md)] overflow-hidden bg-[var(--color-surface-2)] flex-shrink-0">
                        <img src={getProductImageUrl(image)} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--color-foreground)] leading-snug line-clamp-2">
                          {item.name}
                        </p>
                        {item.variant_name && (
                          <p className="text-xs text-[var(--color-muted-foreground)] truncate">{item.variant_name}</p>
                        )}
                        {item.combo_name && (
                          <p className="text-xs font-semibold text-[var(--color-primary)]">Combo pack</p>
                        )}
                        <div className="mt-1.5 flex items-center justify-between gap-2">
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
                <button type="button" onClick={proceed} className="vv-btn-primary w-full h-11">
                  {user ? 'Checkout' : 'Sign in to checkout'}
                </button>
                <Link
                  to="/cart"
                  onClick={close}
                  className="flex min-h-[44px] items-center justify-center text-sm font-semibold text-[var(--color-foreground)] underline underline-offset-4"
                >
                  View cart
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
