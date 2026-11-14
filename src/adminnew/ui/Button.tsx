import { forwardRef, useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { Check, Loader2, X } from 'lucide-react';
import { cn } from '../../components/ui/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'plain' | 'critical';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';
/** Button feedback state. Replaces toasts: the button itself confirms the result. */
export type ButtonState = 'idle' | 'loading' | 'success' | 'error';

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--admin-primary)] text-[var(--admin-text-on-primary)] hover:bg-[var(--admin-primary-hover)] active:bg-[var(--admin-primary-active)] border border-transparent',
  secondary:
    'bg-[var(--admin-surface)] text-[var(--admin-text)] border border-[var(--admin-border-strong)] hover:bg-[var(--admin-surface-hover)] shadow-[0_1px_0_rgba(20,20,30,0.04)]',
  plain:
    'bg-transparent text-[var(--admin-text)] border border-transparent hover:bg-[var(--admin-surface-hover)]',
  critical:
    'bg-[var(--admin-critical)] text-white hover:bg-[var(--admin-critical-hover)] border border-transparent',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-[15px] gap-2',
  icon: 'size-9 p-0',
};

export interface ButtonProps extends Omit<ComponentProps<'button'>, 'ref'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shorthand for state="loading". */
  loading?: boolean;
  /** Feedback state; success/error swap the label in place without changing width. */
  state?: ButtonState;
  successLabel?: ReactNode;
  errorLabel?: ReactNode;
  /** Leading icon (lucide component instance). */
  icon?: ReactNode;
  fullWidth?: boolean;
  asChild?: boolean;
}

/**
 * Admin button. Variants: primary (one per view), secondary, plain, critical.
 * Feedback without toasts: pass `state` from useButtonFeedback() (or `loading`).
 * Labels are stacked in one grid cell so the width never jumps between states.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading,
    state = 'idle',
    successLabel = 'Saved',
    errorLabel = 'Failed',
    icon,
    fullWidth,
    asChild,
    className,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref,
) {
  const effective: ButtonState = loading ? 'loading' : state;
  const classes = cn(
    'relative inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-[var(--admin-radius)] font-medium transition-colors duration-100',
    'disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
    VARIANT[variant],
    SIZE[size],
    fullWidth && 'w-full',
    effective === 'success' && variant !== 'primary' && 'text-[var(--admin-success)]',
    effective === 'error' && variant !== 'critical' && variant !== 'primary' && 'text-[var(--admin-critical)]',
    className,
  );

  if (asChild) {
    return (
      <Slot ref={ref} data-slot="button" className={classes} {...props}>
        {children}
      </Slot>
    );
  }

  const layer = (visible: boolean, content: ReactNode) => (
    <span
      aria-hidden={!visible}
      className={cn('col-start-1 row-start-1 inline-flex items-center justify-center gap-[inherit]', !visible && 'invisible')}
    >
      {content}
    </span>
  );

  return (
    <button
      ref={ref}
      type={type}
      data-slot="button"
      data-state={effective}
      aria-busy={effective === 'loading' || undefined}
      disabled={disabled || effective === 'loading'}
      className={classes}
      {...props}
    >
      <span className="grid items-center justify-items-center" style={{ gap: 'inherit' }}>
        {layer(
          effective === 'idle',
          <>
            {icon}
            {children}
          </>,
        )}
        {layer(effective === 'loading', <Loader2 className="animate-spin" aria-label="Loading" />)}
        {layer(
          effective === 'success',
          <>
            <Check />
            {successLabel}
          </>,
        )}
        {layer(
          effective === 'error',
          <>
            <X />
            {errorLabel}
          </>,
        )}
      </span>
    </button>
  );
});

export interface ActionError {
  message: string;
  /** Convex error code (`error.data.code`) when present. */
  code?: string;
}

export const STALE_CLIENT_MESSAGE = 'Something changed on our side. Refresh the page and try again.';

// A Convex call fails with no ConvexError code when the deployed function's args
// or name changed under an open page (ArgumentValidationError, "Server Error",
// "Could not find public function"). The raw text carries a Request ID, which
// users cannot act on.
const STALE_CLIENT_PATTERN = /ArgumentValidationError|Could not find public function|Server Error|Called by client|\[Request ID:/i;

export function isStaleClientError(err: unknown): boolean {
  const anyErr = err as { data?: unknown; message?: unknown } | null;
  if (!anyErr || typeof anyErr !== 'object') return false;
  if (anyErr.data && typeof anyErr.data === 'object' && (anyErr.data as { code?: unknown }).code) return false;
  return typeof anyErr.message === 'string' && STALE_CLIENT_PATTERN.test(anyErr.message);
}

/** Turns any thrown value (Convex, fetch, Error) into { message, code }. */
export function toActionError(err: unknown, fallback = 'Something went wrong. Try again.'): ActionError {
  if (isStaleClientError(err)) {
    console.error('[stale client] Convex call failed; the deployed function may have changed.', err);
    return { message: STALE_CLIENT_MESSAGE };
  }
  const anyErr = err as { data?: { code?: string; message?: string } | string; message?: string; code?: string } | null;
  const data = anyErr && typeof anyErr.data === 'object' ? anyErr.data : undefined;
  const code = data?.code ?? anyErr?.code;
  const message =
    data?.message ||
    (typeof anyErr?.data === 'string' ? anyErr.data : undefined) ||
    (anyErr?.message ? anyErr.message.replace(/^\[CONVEX[^\]]*\]\s*/, '').replace(/^Uncaught (ConvexError|Error):\s*/, '') : '') ||
    fallback;
  return { message, code: code || undefined };
}

/**
 * Button feedback for async actions (the toast replacement).
 *
 *   const save = useButtonFeedback();
 *   <Button variant="primary" state={save.state} onClick={() => save.run(() => mutate(args))}>Save</Button>
 *   {save.error && <Banner tone="critical">{save.error.message}</Banner>}
 *
 * success/error revert to idle after `resetMs` (error message stays until the next run or reset()).
 */
export function useButtonFeedback({ resetMs = 1800 }: { resetMs?: number } = {}) {
  const [state, setState] = useState<ButtonState>('idle');
  const [error, setError] = useState<ActionError | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const settle = useCallback(
    (next: ButtonState) => {
      if (!mounted.current) return;
      setState(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => mounted.current && setState('idle'), resetMs);
    },
    [resetMs],
  );

  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      if (timer.current) clearTimeout(timer.current);
      setError(null);
      setState('loading');
      try {
        const result = await fn();
        settle('success');
        return result;
      } catch (err) {
        if (mounted.current) setError(toActionError(err));
        settle('error');
        return undefined;
      }
    },
    [settle],
  );

  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setState('idle');
    setError(null);
  }, []);

  return { state, error, run, reset, busy: state === 'loading' };
}
