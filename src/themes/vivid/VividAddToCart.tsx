import { forwardRef, useRef, useState } from 'react';
import { Check, Loader2, Minus, Plus, ShoppingCart } from 'lucide-react';
import { useCartLine } from '../../hooks/data/useCartLine';
import { useActionFeedback } from './useActionFeedback';
import { flyProductToCart } from './cartFlight';

interface Props {
  productId: string;
  /** The variant this control adds and steps. Undefined for products without variants. */
  variantId?: string;
  /** Thumbnail URL for the drop animation (same image the card shows). */
  imageUrl?: string;
  /** Adds the item. Called only when the product is not yet in the cart. */
  onAdd: () => Promise<unknown>;
  /** card: compact row in a product list. lg: product page buy box. */
  size?: 'card' | 'lg';
  /** lg only: how many to add on the first press (picker shown until the item is in the cart). */
  addQuantity?: number;
  onAddQuantityChange?: (next: number) => void;
}

const MAX_QTY = 99;

/**
 * Add control that becomes a quantity stepper once the product is in the cart.
 * At quantity 0 it is the Add button again. Pressing Add runs the product drop
 * animation to the cart icon. Stepper edits go straight to the cart line.
 */
export function VividAddToCart({
  productId,
  variantId,
  imageUrl,
  onAdd,
  size = 'card',
  addQuantity = 1,
  onAddQuantityChange,
}: Props) {
  const { quantity, setQuantity } = useCartLine(productId, variantId);
  const add = useActionFeedback();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const error = add.error || stepError;

  const handleAdd = (e: React.MouseEvent) => {
    // The card is a link: the control must not navigate or open the product.
    e.preventDefault();
    e.stopPropagation();
    if (add.busy) return;
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect && imageUrl) flyProductToCart(imageUrl, rect);
    void add.run(onAdd, 'Could not add');
  };

  const step = (next: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setStepError(null);
    setQuantity(next).catch(() => setStepError('Could not update quantity. Try again.'));
  };

  if (quantity > 0) {
    return (
      <div className={`flex flex-col gap-1 ${size === 'lg' ? 'items-start' : 'items-end'}`}>
        <Stepper qty={quantity} size={size} onDecrement={step(quantity - 1)} onIncrement={step(Math.min(MAX_QTY, quantity + 1))} />
        {error && <ErrorText message={error} size={size} />}
      </div>
    );
  }

  if (size === 'lg') {
    return (
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full overflow-hidden">
            <button
              type="button"
              onClick={() => onAddQuantityChange?.(Math.max(1, addQuantity - 1))}
              className="w-11 h-11 grid place-items-center text-[var(--color-foreground)]"
              aria-label="Decrease"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center text-[var(--color-foreground)] font-semibold">{addQuantity}</span>
            <button
              type="button"
              onClick={() => onAddQuantityChange?.(addQuantity + 1)}
              className="w-11 h-11 grid place-items-center text-[var(--color-foreground)]"
              aria-label="Increase"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <AddButton ref={btnRef} state={add.state} busy={add.busy} onClick={handleAdd} size="lg" />
        </div>
        {error && <ErrorText message={error} size="lg" />}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1 flex-shrink-0 max-w-[104px]">
      <AddButton ref={btnRef} state={add.state} busy={add.busy} onClick={handleAdd} size="card" />
      {error && <ErrorText message={error} size="card" />}
    </div>
  );
}

const AddButton = forwardRef<
  HTMLButtonElement,
  {
    state: 'idle' | 'pending' | 'done' | 'error';
    busy: boolean;
    onClick: (e: React.MouseEvent) => void;
    size: 'card' | 'lg';
  }
>(function AddButton({ state, busy, onClick, size }, ref) {
  const label = state === 'pending' ? 'Adding' : state === 'error' ? 'Retry' : size === 'lg' ? 'Add to Cart' : 'Add';
  if (size === 'lg') {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-live="polite"
        data-state={state}
        className="flex-1 vv-btn-primary inline-flex items-center justify-center gap-2 h-11"
      >
        {state === 'pending' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
        {label}
      </button>
    );
  }
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-live="polite"
      data-state={state}
      className={`vv-btn-add ${state === 'error' ? 'vv-btn-add--error' : ''}`}
    >
      {state === 'pending' ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : state === 'done' ? (
        <Check className="w-3.5 h-3.5" strokeWidth={3} />
      ) : (
        <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
      )}
      {label}
    </button>
  );
});

function Stepper({
  qty,
  size,
  onDecrement,
  onIncrement,
}: {
  qty: number;
  size: 'card' | 'lg';
  onDecrement: (e: React.MouseEvent) => void;
  onIncrement: (e: React.MouseEvent) => void;
}) {
  const lg = size === 'lg';
  const btn = `${lg ? 'w-11 h-11' : 'w-9 h-9'} grid place-items-center text-[var(--vv-brand)] hover:bg-[var(--vv-brand-soft)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors`;
  return (
    <div
      role="group"
      aria-label={`${qty} in cart`}
      className={`inline-flex items-center rounded-full border border-[var(--vv-brand)] bg-[var(--vv-bg-elevated)] overflow-hidden ${lg ? 'h-11' : 'h-9'}`}
    >
      <button type="button" onClick={onDecrement} className={btn} aria-label="Decrease quantity">
        <Minus className={lg ? 'w-4 h-4' : 'w-3.5 h-3.5'} strokeWidth={2.5} />
      </button>
      <span
        aria-live="polite"
        className={`text-center font-bold text-[var(--color-foreground)] tabular-nums ${lg ? 'min-w-[2.5rem] text-base' : 'min-w-[2rem] text-sm'}`}
      >
        {qty}
      </span>
      <button
        type="button"
        onClick={onIncrement}
        disabled={qty >= MAX_QTY}
        className={btn}
        aria-label="Increase quantity"
      >
        <Plus className={lg ? 'w-4 h-4' : 'w-3.5 h-3.5'} strokeWidth={2.5} />
      </button>
    </div>
  );
}

function ErrorText({ message, size }: { message: string; size: 'card' | 'lg' }) {
  return (
    <span role="alert" className={`leading-tight text-[var(--vv-danger)] text-right ${size === 'lg' ? 'text-sm' : 'text-[11px]'}`}>
      {message}
    </span>
  );
}
