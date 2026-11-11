type CrashSource = 'app' | 'convex';
interface CrashContext {
  source?: CrashSource;
  componentStack?: string | null;
  operation?: string;
}

const seen = new Set<string>();
let attempts = 0;
const MAX_REPORTS = 20;

export function reportCrash(error: unknown, context: CrashContext = {}): void {
  // Separate HTTP transport: a broken Convex websocket must not break logging.
  if (!import.meta.env.PROD || typeof window === 'undefined') return;
  try {
    const message = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';
    const source = context.source || (/\[CONVEX|ConvexError/.test(message) ? 'convex' : 'app');
    const fingerprint = `${source}:${message.slice(0, 2000)}`;
    if (attempts >= MAX_REPORTS || seen.has(fingerprint)) return;
    seen.add(fingerprint);
    attempts++;
    const body = JSON.stringify({
      source, message: message.slice(0, 2000),
      stack: error instanceof Error ? error.stack?.slice(0, 6000) : undefined,
      componentStack: context.componentStack?.slice(0, 6000),
      path: window.location.pathname,
      build: new URL(import.meta.url).pathname,
      operation: context.operation || 'unhandled',
    });
    void fetch('/api/crash-logs', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body, keepalive: true, credentials: 'omit',
    }).catch(() => { /* Offline/reporting failures must never cascade. */ });
  } catch { /* Reporting cannot crash the app. */ }
}

export function installCrashReporting(): void {
  window.addEventListener('error', event => {
    if (event instanceof ErrorEvent) {
      reportCrash(event.error || event.message, { operation: 'window.error' });
    }
  });
  window.addEventListener('unhandledrejection', event => {
    reportCrash(event.reason, { operation: 'unhandledrejection' });
  });
  window.addEventListener('vite:preloadError', event => {
    reportCrash((event as Event & { payload?: unknown }).payload, { operation: 'lazy-import' });
  });
}
