import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { ConvexProviderWithAuth } from 'convex/react';
import { Session } from '@supabase/supabase-js';
import { convex } from './client';
import { supabase } from '../supabase/client';

/**
 * Bridges the existing Supabase session into Convex.
 *
 * Convex calls `fetchAccessToken({ forceRefreshToken })` whenever it needs
 * to authenticate a query/mutation. We read the current Supabase session
 * and return its access_token (refreshing when asked).
 *
 * Requires Supabase to be configured with asymmetric JWT signing keys (RS256)
 * and the issuer/jwks wired into convex/auth.config.ts.
 */
function useSupabaseAuthForConvex() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setIsLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
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
      isAuthenticated: !!session,
      fetchAccessToken,
    }),
    [isLoading, session, fetchAccessToken],
  );
}

export function ConvexSupabaseProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useSupabaseAuthForConvex}>
      {children}
    </ConvexProviderWithAuth>
  );
}
