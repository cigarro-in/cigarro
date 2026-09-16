import { Minus, Plus } from 'lucide-react';

interface QuantityStepperProps {
  quantity: number;
  onChange: (next: number) => void;
  /** Lowest value the stepper emits. 0 = decrement-to-zero (parent removes). Default 1. */
  min?: number;
  /** Highest value the stepper emits. Default 99 (matches cart MAX_CART_QUANTITY). */
  max?: number;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** Container visuals (border/bg/rounded) — supplied per surface so themes don't churn. */
  className?: string;
  /** Applied to both step buttons. */
  buttonClassName?: string;
  valueClassName?: string;
  decrementLabel?: string;
  incrementLabel?: string;
}

const SIZES = {
  sm: { btn: 'w-6 h-6', icon: 'w-3 h-3', value: 'w-6 text-[11px]' },
  md: { btn: 'w-9 h-9', icon: 'w-3.5 h-3.5', value: 'w-8 text-sm' },
  lg: { btn: 'w-8 h-8', icon: 'w-3 h-3', value: 'w-8 text-sm' },
} as const;

// Single shared quantity control for every cart surface (CartPage,
// MiniCart, MobileCheckoutPage, VividCart, VividCartPanel). Standardizes
// clamping, min/max, disabled and a11y — callers keep their own visuals
// and their own remove semantics via min (1 = clamp, 0 = emit-to-remove).
export function QuantityStepper({
  quantity,
  onChange,
  min = 1,
  max = 99,
  disabled = false,
  size = 'md',
  className = '',
  buttonClassName = '',
  valueClassName = '',
  decrementLabel = 'Decrease quantity',
  incrementLabel = 'Increase quantity',
}: QuantityStepperProps) {
  const s = SIZES[size];

  return (
    <div className={`inline-flex items-center overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, quantity - 1))}
        disabled={disabled || quantity <= min}
        className={`${s.btn} flex items-center justify-center transition-colors disabled:opacity-30 ${buttonClassName}`}
        aria-label={decrementLabel}
      >
        <Minus className={s.icon} />
      </button>
      <span className={`${s.value} text-center font-semibold ${valueClassName}`} aria-live="polite">
        {quantity}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, quantity + 1))}
        disabled={disabled || quantity >= max}
        className={`${s.btn} flex items-center justify-center transition-colors disabled:opacity-30 ${buttonClassName}`}
        aria-label={incrementLabel}
      >
        <Plus className={s.icon} />
      </button>
    </div>
  );
}
