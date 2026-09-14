import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { ConvexProviderWithAuth } from 'convex/react';
import { convex } from './client';
import { supabase } from '../supabase/client';
import { getAccessToken } from '../auth/session';

/**
 * Auth Phase 2 bridge (dual-client soak).
 *
 * Convex calls `fetchAccessToken({ forceRefreshToken })` whenever it needs
 * to authenticate a query/mutation. Our own JWT (localStorage, 30d,
 * OTP-renewed) goes first; the legacy Supabase session is the fallback
 * while the dual-issuer soak runs. After the soak, delete the Supabase
 * branch below and this comment.
 */
function useDualAuthForConvex() {
  const [isLoading, setIsLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setIsLoading(false);
    });
    // Re-resolve auth state when the legacy session changes (soak only).
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      setTick((t) => t + 1);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const onStorage = () => setTick((t) => t + 1);
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      const ours = getAccessToken();
      if (ours) return ours;
      if (forceRefreshToken) {
        const { data } = await supabase.auth.refreshSession();
        return data.session?.access_token ?? null;
      }
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    },
    [],
  );

  return useMemo(
    () => ({
      isLoading,
      isAuthenticated: true,
      fetchAccessToken,
    }),
    // tick re-resolves auth state on session/storage changes (soak only).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isLoading, fetchAccessToken, tick],
  );
}

export function ConvexSupabaseProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useDualAuthForConvex}>
      {children}
    </ConvexProviderWithAuth>
  );
}
