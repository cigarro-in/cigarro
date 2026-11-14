import React, { useEffect, useState, startTransition } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { installCrashReporting } from './lib/crashReporting';
import { isReloadBlocked } from './lib/reloadGuard';
import { OrgProvider, getClientOrgInfo } from './lib/org/OrgContext';
import { themeIdFromPreload } from './lib/ssr/themeFromPreload';
import { getTheme, resolveThemeId } from './themes/registry';
import { preloadRouteFor } from './routes/AppRoutes';

installCrashReporting();

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
// Only failures for OUR bundle count. Third-party scripts (MSG91, hCaptcha,
// analytics) can throw errors that mention dynamic imports or fetch failures;
// reloading for those wipes in-flight login state.
function isOwnAssetUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    const url = new URL(raw, window.location.href);
    return url.origin === window.location.origin && url.pathname.startsWith('/assets/');
  } catch {
    return false;
  }
}
function firstUrl(text: string | null | undefined): string | null {
  return text?.match(/https?:\/\/[^\s'"`)>]+/)?.[0] ?? null;
}
function reloadOnceForFreshChunks(): void {
  // Never reload while a login dialog is open. The failure is not lost: the
  // next failing lazy import (or navigation) retries once the dialog closes.
  if (isReloadBlocked()) return;
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
  } catch {
    return;
  }
  window.location.reload();
}
// React.lazy handles rejected imports before they reach unhandledrejection.
// Vite emits this event first (for its own preloads), so existing users can
// still recover after deploys.
window.addEventListener('vite:preloadError', (event) => {
  const error = (event as Event & { payload?: { message?: string } }).payload;
  if (isChunkLoadFailure(error?.message)) reloadOnceForFreshChunks();
});
window.addEventListener('error', (event) => {
  const { message, filename } = event as ErrorEvent;
  if (!isChunkLoadFailure(message)) return;
  // filename is the script that threw; a third-party script never qualifies.
  if (isOwnAssetUrl(filename || firstUrl(message))) reloadOnceForFreshChunks();
});
window.addEventListener('unhandledrejection', (event) => {
  const reason = (event as PromiseRejectionEvent)?.reason;
  const message = typeof reason === 'string' ? reason : reason?.message;
  if (!isChunkLoadFailure(message)) return;
  if (isOwnAssetUrl(firstUrl(message) ?? firstUrl(reason?.stack))) reloadOnceForFreshChunks();
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

// Client-side navigations (history.pushState / popstate). Used as the point at
// which a pending service-worker update may be applied: the URL has already
// changed, so the reload lands on the new route.
const navigationListeners = new Set<() => void>();
let historyPatched = false;
function emitNavigation(): void {
  for (const fn of Array.from(navigationListeners)) {
    try {
      fn();
    } catch {
      // A listener must never break navigation.
    }
  }
}
function onAppNavigation(listener: () => void): () => void {
  if (!historyPatched) {
    historyPatched = true;
    const originalPush = window.history.pushState;
    window.history.pushState = function (this: History, data: unknown, unused: string, url?: string | URL | null) {
      originalPush.call(this, data, unused, url);
      emitNavigation();
    };
    window.addEventListener('popstate', emitNavigation);
  }
  navigationListeners.add(listener);
  return () => {
    navigationListeners.delete(listener);
  };
}

// Service worker updates are applied deliberately (registerType 'prompt'):
// - never while a login dialog is open (the reload would wipe the OTP flow);
// - when the tab is hidden, or on the next client-side navigation.
// The waiting worker stays inert until then, so the current page keeps working.
const UpdateSW = () => {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(_r: any) {
      // Service worker registered
    },
    onRegisterError(_error: any) {
      // Registration error
    },
    registrationOptions: {
      updateViaCache: 'none',
    },
    immediate: true,
  })

  useEffect(() => {
    if (!needRefresh) return;
    const apply = () => {
      if (isReloadBlocked()) return;
      void updateServiceWorker(true);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') apply();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const unsubscribe = onAppNavigation(apply);
    if (document.visibilityState === 'hidden') apply();
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      unsubscribe();
    };
  }, [needRefresh, updateServiceWorker])

  return null
}

// Service worker registration is not needed for the first paint: start it once
// the page has loaded and the main thread is idle.
const DeferredUpdateSW = () => {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let cancelled = false
    const start = () => {
      const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback
      const go = () => { if (!cancelled) startTransition(() => setReady(true)) }
      if (idle) idle(go, { timeout: 5000 })
      else setTimeout(go, 2000)
    }
    if (document.readyState === 'complete') start()
    else window.addEventListener('load', start, { once: true })
    return () => {
      cancelled = true
      window.removeEventListener('load', start)
    }
  }, [])
  return ready ? <UpdateSW /> : null
}

// Client entry: the router lives here, not in App, so a server entry can render
// the same <App /> inside <StaticRouter location={...}>. StaticRouter is exported
// from 'react-router' and re-exported by 'react-router-dom' (react-router 7.9.1;
// there is no 'react-router-dom/server' subpath).
const orgInfo = getClientOrgInfo();
// Server-rendered page: start from the same theme the server used (the preload
// carries the store's active_theme), so the first client render matches the markup.
const ssrThemeId = window.__SSR__ === true
  ? themeIdFromPreload(window.__PRELOAD__ ?? {}, orgInfo.slug)
  : undefined;
const routedApp = orgInfo.isSa ? (
  // Super-admin app mounts its own BrowserRouter (src/sa/SaApp.tsx).
  <App />
) : (
  <BrowserRouter basename={orgInfo.basename || undefined}>
    <App initialThemeId={ssrThemeId} />
  </BrowserRouter>
);

const appTree = (
  <React.StrictMode>
    <OrgProvider org={orgInfo}>
      {routedApp}
      <DeferredUpdateSW />
    </OrgProvider>
  </React.StrictMode>
);

// Hydrate only when the server shipped markup for this page (flag SSR_ROUTES).
// Otherwise the SPA mounts from scratch as before.
// Before hydrating, load every lazy chunk the server-rendered page shows (theme
// shell, age gate, route component). A component that suspends mid-hydration
// makes React drop the server markup and client-render (React #421): a blank
// flash and a large layout shift.
const rootEl = document.getElementById('root')!;
if (window.__SSR__ === true && rootEl.hasChildNodes()) {
  const theme = getTheme(resolveThemeId(ssrThemeId));
  const ready = theme ? preloadRouteFor(window.location.pathname.slice((orgInfo.basename || '').length) || '/', theme) : Promise.resolve();
  void ready.then(() => {
    ReactDOM.hydrateRoot(rootEl, appTree);
  });
} else {
  ReactDOM.createRoot(rootEl).render(appTree);
}
