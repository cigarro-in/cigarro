import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { useRegisterSW } from 'virtual:pwa-register/react'

// Suppress react-beautiful-dnd defaultProps deprecation warning
// This is a known issue with the library and React 18+
const originalError = console.error;
console.error = (...args) => {
  if (args[0]?.includes?.('defaultProps will be removed')) {
    return;
  }
  originalError.apply(console, args);
};

// Deploy-skew recovery: an open tab from a previous deployment may keep
// running old code whose lazy chunks no longer exist on the CDN (aggressive
// SW updates can evict them mid-session). A single reload fetches a fresh
// index.html; the session flag prevents reload loops (e.g. offline).
const CHUNK_RELOAD_KEY = 'cigarro-chunk-reload';
function isChunkLoadFailure(message: unknown): boolean {
  if (typeof message !== 'string') return false;
  return /dynamically imported module|Loading chunk \d+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message);
}
function reloadOnceForFreshChunks(): void {
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
  } catch {
    return;
  }
  window.location.reload();
}
window.addEventListener('error', (event) => {
  if (isChunkLoadFailure((event as ErrorEvent)?.message)) reloadOnceForFreshChunks();
});
window.addEventListener('unhandledrejection', (event) => {
  const reason = (event as PromiseRejectionEvent)?.reason;
  const message = typeof reason === 'string' ? reason : reason?.message;
  if (isChunkLoadFailure(message)) reloadOnceForFreshChunks();
});
// Clear the guard once the app boots cleanly so the *next* deploy can
// recover the same way (a crashed boot never reaches here — no loop).
setTimeout(() => {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    // ignore storage failures
  }
}, 8000);

const UpdateSW = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(_r: any) {
      // Service worker registered
    },
    onRegisterError(_error: any) {
      // Registration error
    },
    registrationOptions: {
      updateViaCache: 'always',
    },
    immediate: true,
    onNeedRefresh: () => {
      // Need refresh callback
    },
  })

  const close = () => {
    setNeedRefresh(false)
  }

  useEffect(() => {
    if (needRefresh) {
      updateServiceWorker(true)
    }
  }, [needRefresh, updateServiceWorker])

  return null
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <UpdateSW />
  </React.StrictMode>,
)
