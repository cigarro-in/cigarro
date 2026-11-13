import { useCallback, useEffect, useRef, useState } from 'react';

// Shared replacement for sonner toasts (Phase 3: no toasts anywhere).
// Errors render inline near the action that failed (role="alert");
// confirmations render as an inline state (role="status").
// Confirmations are persistent by default. Pass `okAutoDismissMs` to make
// them transient: they clear after that delay, and only one transient notice
// is live across all instances at a time (a new one replaces the old one).
export interface InlineStatusState {
  kind: 'error' | 'ok' | null;
  message: string;
}

export interface UseInlineStatusOptions {
  okAutoDismissMs?: number;
}

const EMPTY: InlineStatusState = { kind: null, message: '' };

// Dismiss callbacks of every mounted hook that opted into transient notices.
const transientDismissers = new Set<() => void>();

export function useInlineStatus(options: UseInlineStatusOptions = {}) {
  const { okAutoDismissMs } = options;
  const [status, setStatus] = useState<InlineStatusState>(EMPTY);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    clearTimer();
    setStatus(EMPTY);
  }, [clearTimer]);

  // Only clears this instance if it is showing something, so other instances
  // dismissing themselves never triggers a needless re-render.
  const dismissSelf = useCallback(() => {
    clearTimer();
    setStatus((prev) => (prev.kind ? EMPTY : prev));
  }, [clearTimer]);

  useEffect(() => {
    if (!okAutoDismissMs) return;
    transientDismissers.add(dismissSelf);
    return () => {
      transientDismissers.delete(dismissSelf);
      clearTimer();
    };
  }, [okAutoDismissMs, dismissSelf, clearTimer]);

  const setError = useCallback(
    (message: string) => {
      clearTimer();
      setStatus({ kind: 'error', message });
    },
    [clearTimer],
  );

  const setOk = useCallback(
    (message: string) => {
      clearTimer();
      if (okAutoDismissMs) {
        transientDismissers.forEach((dismiss) => {
          if (dismiss !== dismissSelf) dismiss();
        });
      }
      setStatus({ kind: 'ok', message });
      if (okAutoDismissMs) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          setStatus(EMPTY);
        }, okAutoDismissMs);
      }
    },
    [clearTimer, dismissSelf, okAutoDismissMs],
  );

  return { status, setError, setOk, clear };
}

export function InlineStatus({
  status,
  onRetry,
  retryLabel,
  onDismiss,
}: {
  status: InlineStatusState;
  onRetry?: () => void;
  retryLabel?: string;
  onDismiss?: () => void;
}) {
  if (!status.kind) return null;
  const isError = status.kind === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={
        (isError
          ? 'rounded-xl border border-red-300 bg-red-50 px-3 py-2.5'
          : 'rounded-xl border border-green-300 bg-green-50 px-3 py-2.5') +
        (onDismiss ? ' flex items-start gap-2' : '')
      }
    >
      <p
        className={
          (isError ? 'text-[13px] font-semibold text-red-700' : 'text-[13px] font-semibold text-green-800') +
          (onDismiss ? ' flex-1 min-w-0' : '')
        }
      >
        {status.message}
      </p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className={
            (isError ? 'text-red-700' : 'text-green-800') +
            ' flex-shrink-0 leading-none px-1 text-base hover:opacity-70'
          }
        >
          ×
        </button>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 h-9 px-4 rounded-lg bg-neutral-900 text-white text-[13px] font-semibold hover:bg-neutral-700 active:scale-[0.98] transition"
        >
          {retryLabel || 'Retry'}
        </button>
      )}
    </div>
  );
}
