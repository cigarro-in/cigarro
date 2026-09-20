import { useCallback, useState } from 'react';

// Shared replacement for sonner toasts (Phase 3: no toasts anywhere).
// Errors render inline near the action that failed (role="alert");
// confirmations render as a persistent inline state (role="status"),
// never a transient popup. Theme-agnostic: plain tailwind palette so it
// works in both storefront themes and admin.
export interface InlineStatusState {
  kind: 'error' | 'ok' | null;
  message: string;
}

export function useInlineStatus() {
  const [status, setStatus] = useState<InlineStatusState>({ kind: null, message: '' });
  const setError = useCallback(
    (message: string) => setStatus({ kind: 'error', message }),
    [],
  );
  const setOk = useCallback((message: string) => setStatus({ kind: 'ok', message }), []);
  const clear = useCallback(() => setStatus({ kind: null, message: '' }), []);
  return { status, setError, setOk, clear };
}

export function InlineStatus({
  status,
  onRetry,
  retryLabel,
}: {
  status: InlineStatusState;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  if (!status.kind) return null;
  const isError = status.kind === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={
        isError
          ? 'rounded-xl border border-red-300 bg-red-50 px-3 py-2.5'
          : 'rounded-xl border border-green-300 bg-green-50 px-3 py-2.5'
      }
    >
      <p className={isError ? 'text-[13px] font-semibold text-red-700' : 'text-[13px] font-semibold text-green-800'}>
        {status.message}
      </p>
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
