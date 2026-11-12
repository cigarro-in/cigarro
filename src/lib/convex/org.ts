// Store identity for the SPA. The edge injects window.__ORG__ into <head> for
// HTML responses (functions/_middleware.js), resolved from the request hostname.
// Build-time VITE_ORG_SLUG and window.location are fallbacks only.

const hasWindow = typeof window !== 'undefined';

// Admin host (admin.<root>/<storeSlug>/...): the store is the first path
// segment. It is read from the URL, so an offline-cached shell still resolves
// the right store. Mirrors adminStoreFromPath in functions/lib/org.js.
const ADMIN_RESERVED_SEGMENTS = new Set(['api', 'assets', 'icons', 'fonts', 'functions', 'admin', 'sa']);
const STORE_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;

// Citadel super-admin app on the admin host (/sa/...). No store.
export const IS_SA: boolean =
  hasWindow && window.location.hostname.split('.')[0] === 'admin' &&
  (window.location.pathname === '/sa' || window.location.pathname.startsWith('/sa/'));

export const IS_ADMIN_HOST: boolean =
  hasWindow && window.location.hostname.split('.')[0] === 'admin';

// Store named by the admin path, or null (admin root picker, or not admin host).
export const ADMIN_PATH_STORE: string | null = (() => {
  if (!IS_ADMIN_HOST) return null;
  const first = window.location.pathname.split('/')[1] || '';
  return STORE_SLUG_RE.test(first) && !ADMIN_RESERVED_SEGMENTS.has(first) ? first : null;
})();

// React Router basename on the admin host ('' everywhere else).
export const APP_BASENAME: string = ADMIN_PATH_STORE ? `/${ADMIN_PATH_STORE}` : '';

export const ORG_SLUG: string =
  ADMIN_PATH_STORE ||
  (hasWindow && window.__ORG__?.slug) ||
  import.meta.env?.VITE_ORG_SLUG ||
  'smokeshop';

export const ORG_PRIMARY_HOST: string =
  (hasWindow && window.__ORG__?.primaryHost) ||
  (hasWindow ? window.location.host : '');
