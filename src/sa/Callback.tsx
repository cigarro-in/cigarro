import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banner, Button, Skeleton } from '../adminnew/ui';
import { AuthFrame } from './saUi';
import { CITADEL_HUB_URL, exchangeLaunchToken, writeStoredSa } from './session';

// Route: /sa/callback. Citadel redirects here with the launch JWT in the
// URL fragment (#t=...). The fragment never reaches a server log.
export function Callback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  // StrictMode runs effects twice; the token is single-use, so only the first
  // run may exchange it.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const match = /(?:^#|&)t=([^&]+)/.exec(window.location.hash);
    // Remove the token from the address bar before anything else.
    window.history.replaceState(null, '', window.location.pathname);
    if (!match) {
      setError('No launch token found. Open this app from Citadel.');
      return;
    }
    const launchToken = decodeURIComponent(match[1]);

    exchangeLaunchToken(launchToken)
      .then((session) => {
        writeStoredSa(session);
        navigate('/sa/stores', { replace: true });
      })
      .catch((e: Error) => setError(e.message || 'Sign-in failed.'));
  }, [navigate]);

  if (!error) {
    return (
      <AuthFrame>
        <h1 className="text-xl font-semibold text-[var(--admin-text)]">Signing in</h1>
        <div className="mt-5 space-y-3" aria-busy="true" aria-label="Signing in">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame>
      <h1 className="text-xl font-semibold text-[var(--admin-text)]">Sign-in failed</h1>
      <div className="mt-5 flex flex-col gap-3">
        <Banner tone="critical">{error}</Banner>
        <Button asChild variant="secondary" size="lg" fullWidth>
          <a href={CITADEL_HUB_URL}>Back to Citadel</a>
        </Button>
      </div>
    </AuthFrame>
  );
}
