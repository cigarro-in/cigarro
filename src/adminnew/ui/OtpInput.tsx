import { forwardRef, useState } from 'react';
import { cn } from '../../components/ui/utils';

/**
 * Segmented one-time-code input. One real <input> (transparent, on top of the
 * boxes) carries the value, so paste, SMS autofill (autocomplete=one-time-code)
 * and backspace all behave natively. `onComplete` fires when all digits are in.
 */
export const OtpInput = forwardRef<
  HTMLInputElement,
  {
    length?: number;
    value: string;
    onChange: (value: string) => void;
    onComplete?: (value: string) => void;
    disabled?: boolean;
    invalid?: boolean;
    autoFocus?: boolean;
    describedBy?: string;
  }
>(function OtpInput({ length = 6, value, onChange, onComplete, disabled, invalid, autoFocus, describedBy }, ref) {
  const [focused, setFocused] = useState(false);
  const update = (raw: string) => {
    const clean = raw.replace(/\D/g, '').slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
  };
  const activeIndex = Math.min(value.length, length - 1);

  return (
    <div className="relative">
      <div className="flex justify-between gap-2" aria-hidden>
        {Array.from({ length }, (_, i) => {
          const char = value[i] ?? '';
          const isActive = focused && i === activeIndex && !disabled;
          return (
            <div
              key={i}
              className={cn(
                'flex h-12 w-full max-w-12 items-center justify-center rounded-[var(--admin-radius)] border bg-[var(--admin-surface)] text-xl font-semibold tabular-nums text-[var(--admin-text)] transition-[border-color,box-shadow] duration-100',
                invalid
                  ? 'border-[var(--admin-critical)]'
                  : isActive
                    ? 'border-[var(--admin-focus)] ring-2 ring-[var(--admin-focus)]/20'
                    : 'border-[var(--admin-border-strong)]',
                disabled && 'opacity-60',
              )}
            >
              {char}
              {isActive && !char && <span className="h-5 w-px animate-pulse bg-[var(--admin-text)]" />}
            </div>
          );
        })}
      </div>
      <input
        ref={ref}
        value={value}
        onChange={(e) => update(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        enterKeyHint="done"
        pattern="[0-9]*"
        maxLength={length}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label={`${length}-digit code`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent opacity-0 outline-none [font-size:16px]"
      />
    </div>
  );
});
