import { useCallback, useEffect, useRef, useState } from 'react';

export type FeedbackState = 'idle' | 'pending' | 'done' | 'error';

/**
 * Button-level feedback for a customer action. No toasts or popups: the button
 * itself shows pending, done (for `doneMs`) or error, and the error message is
 * returned so the caller can render it inline under the button.
 */
export function useActionFeedback(doneMs = 2000) {
  const [state, setState] = useState<FeedbackState>('idle');
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const run = useCallback(
    async (action: () => Promise<unknown>, errorMessage: string): Promise<boolean> => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setState('pending');
      setError(null);
      try {
        await action();
        if (!mountedRef.current) return true;
        setState('done');
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          if (mountedRef.current) setState('idle');
        }, doneMs);
        return true;
      } catch {
        if (mountedRef.current) {
          setState('error');
          setError(errorMessage);
        }
        return false;
      }
    },
    [doneMs],
  );

  return { state, error, busy: state === 'pending', run };
}
