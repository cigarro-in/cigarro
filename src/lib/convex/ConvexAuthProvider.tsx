import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { ConvexProviderWithAuth } from 'convex/react';
import { convex } from './client';
import { getAccessToken } from '../auth/session';

/**
 * Auth bridge (own ES256 JWT only).
 *
 * Convex calls `fetchAccessToken({ forceRefreshToken })` whenever it needs
 * to authenticate a query/mutation. Our JWT lives in localStorage (30d,
 * OTP-renewed). `cigarro:auth-changed` (fired by store/clearSession) bumps
 * the tick so the client re-auths same-tab — `storage` events are cross-tab
 * only and never fire in the tab that wrote.
 */
function useOwnAuthForConvex() {
  const [isLoading, setIsLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onStorage = () => setTick((t) => t + 1);
    const onAuthChanged = () => setTick((t) => t + 1);
    window.addEventListener('storage', onStorage);
    window.addEventListener('cigarro:auth-changed', onAuthChanged);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('cigarro:auth-changed', onAuthChanged);
    };
  }, []);

  // NOTE: `tick` must stay in these deps. Convex re-runs `setAuth` only
  // when `fetchAccessToken` identity changes — a stable reference here
  // means the client never picks up a new token without a full refresh
  // (the login-then-refresh dance). Notify bumps tick -> new reference.
  const fetchAccessToken = useCallback(
    async (_: { forceRefreshToken: boolean }) => getAccessToken(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick],
  );

  return useMemo(
    () => ({
      isLoading,
      isAuthenticated: true,
      fetchAccessToken,
    }),
    // tick re-resolves auth state on session changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isLoading, fetchAccessToken, tick],
  );
}

export function ConvexAuthProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useOwnAuthForConvex}>
      {children}
    </ConvexProviderWithAuth>
  );
}
