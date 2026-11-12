import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { InlineStatus, useInlineStatus } from '../components/common/InlineStatus';
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
  const status = useInlineStatus();

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
        if (!cancelled) status.setError(e.message);
      });
    return () => {
      cancelled = true;
    };
    // status is stable enough for this one-shot effect; tick drives refreshes.
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
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Checking session...</div>;
  }

  if (state.kind === 'missing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center space-y-4">
          <p className="text-lg font-bold">Super admin</p>
          <p className="text-sm text-muted-foreground">
            {state.reason ?? 'Open this app from Citadel to sign in.'}
          </p>
          <a
            href={CITADEL_HUB_URL}
            className="inline-flex h-11 items-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground"
          >
            Open from Citadel
          </a>
          <InlineStatus status={status.status} />
        </div>
      </div>
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
      <div className="min-h-screen bg-background">
        <header className="border-b px-4 py-3 flex flex-wrap items-center gap-4">
          <span className="font-bold">Cigarro super admin</span>
          <nav className="flex gap-3 text-sm">
            <a href="/sa/stores" className="underline-offset-4 hover:underline">Stores</a>
            <a href="/sa/domains" className="underline-offset-4 hover:underline">Domains</a>
            <a href="/sa/platform" className="underline-offset-4 hover:underline">Platform config</a>
          </nav>
          <div className="ml-auto">
            <Button variant="secondary" onClick={() => void signOut()}>Sign out</Button>
          </div>
        </header>
        {!writeOpen && (
          <div role="status" className="border-b bg-amber-50 px-4 py-2 text-sm text-amber-900">
            Read-only. Write access expired. Re-launch from Citadel to edit.
          </div>
        )}
        <main className="mx-auto max-w-5xl p-4 space-y-6">
          <Outlet />
        </main>
      </div>
    </SaContext.Provider>
  );
}
