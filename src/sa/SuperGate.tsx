import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Banner, Button, Skeleton } from '../adminnew/ui';
import { AuthFrame } from './saUi';
import { SaShell } from './SaShell';
import {
  CITADEL_HUB_URL,
  clearStoredSa,
  fetchMe,
  logoutSa,
  readStoredSa,
  type StoredSa,
} from './session';

// Session context for every page under the gate. `writeOpen` is recomputed
// from the write window, so banners flip without a reload.
export interface SaContextValue {
  token: string;
  adminId: string;
  writeOpen: boolean;
  writeExpiresAt: number | null;
  signOut: () => Promise<void>;
}

const SaContext = createContext<SaContextValue | null>(null);

export function useSa(): SaContextValue {
  const ctx = useContext(SaContext);
  if (!ctx) throw new Error('useSa must be used under SuperGate');
  return ctx;
}

type GateState =
  | { kind: 'checking' }
  | { kind: 'missing'; reason?: string }
  | { kind: 'ready'; token: string; adminId: string; write: boolean; writeExpiresAt: number | null };

const RECHECK_MS = 60_000;

export function SuperGate() {
  const [state, setState] = useState<GateState>({ kind: 'checking' });
  const [tick, setTick] = useState(0);
  const navigate = useNavigate();
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Re-read /me once a minute: keeps the idle clock alive and refreshes the
  // write window. A 401 drops the session.
  useEffect(() => {
    let cancelled = false;
    const stored: StoredSa | null = readStoredSa();
    if (!stored) {
      setState({ kind: 'missing' });
      return;
    }
    fetchMe(stored.token)
      .then((me) => {
        if (cancelled) return;
        if (!me) {
          clearStoredSa();
          setState({ kind: 'missing', reason: 'Your Citadel session ended.' });
          return;
        }
        setState({
          kind: 'ready',
          token: stored.token,
          adminId: me.adminId,
          write: me.write,
          writeExpiresAt: me.writeExpiresAt,
        });
      })
      .catch((e: Error) => {
        if (!cancelled) setFetchError(e.message);
      });
    return () => {
      cancelled = true;
    };
    // tick drives refreshes; the effect is intentionally keyed on it alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  useEffect(() => {
    if (state.kind !== 'ready') return;
    const id = window.setInterval(() => setTick((t) => t + 1), RECHECK_MS);
    return () => window.clearInterval(id);
  }, [state.kind]);

  const signOut = useCallback(async () => {
    if (state.kind === 'ready') await logoutSa(state.token);
    clearStoredSa();
    setState({ kind: 'missing' });
    navigate('/sa', { replace: true });
  }, [state, navigate]);

  if (state.kind === 'checking') {
    return (
      <AuthFrame>
        <div className="space-y-3" aria-busy="true" aria-label="Checking session">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          {fetchError && <Banner tone="critical">{fetchError}</Banner>}
        </div>
      </AuthFrame>
    );
  }

  if (state.kind === 'missing') {
    const message = state.reason ?? 'Open this app from Citadel to sign in.';
    return (
      <AuthFrame>
        <h1 className="text-xl font-semibold text-[var(--admin-text)]">Super admin</h1>
        <p className="mt-1 text-sm text-[var(--admin-text-muted)]">{message}</p>
        <div className="mt-5 flex flex-col gap-3">
          <Button asChild variant="primary" size="lg" fullWidth>
            <a href={CITADEL_HUB_URL}>Open from Citadel</a>
          </Button>
          {fetchError && <Banner tone="critical">{fetchError}</Banner>}
        </div>
      </AuthFrame>
    );
  }

  const writeOpen = state.write && !!state.writeExpiresAt && state.writeExpiresAt > Date.now();
  const value: SaContextValue = {
    token: state.token,
    adminId: state.adminId,
    writeOpen,
    writeExpiresAt: state.writeExpiresAt,
    signOut,
  };

  return (
    <SaContext.Provider value={value}>
      <SaShell adminId={state.adminId} writeOpen={writeOpen} onSignOut={() => void signOut()}>
        <Outlet />
      </SaShell>
    </SaContext.Provider>
  );
}
