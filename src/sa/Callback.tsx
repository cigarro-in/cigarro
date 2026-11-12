import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Signing in...</div>;
  }
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div role="alert" className="max-w-sm space-y-4 text-center">
        <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-[13px] font-semibold text-red-700">
          {error}
        </p>
        <a href={CITADEL_HUB_URL} className="inline-flex h-11 items-center rounded-xl border px-6 font-semibold">
          Back to Citadel
        </a>
      </div>
    </div>
  );
}
