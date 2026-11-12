import { APP_BASENAME } from '../../lib/convex/org';

/**
 * Admin route helpers.
 *
 * Admin routes are router-relative. On the admin host the React Router basename
 * is `/<store>` (APP_BASENAME in src/lib/convex/org.ts), so `navigate('/orders')`
 * lands on `https://admin.cigarro.in/<store>/orders`. Pass router-relative paths
 * to navigate/Link/NavLink; use adminAbsoluteUrl() only for URLs handed to
 * other hosts (OAuth returnTo).
 */

/** Router-relative admin path: guarantees a leading slash. */
export function adminPath(p: string): string {
  return p.startsWith('/') ? p : `/${p}`;
}

/** Absolute URL (origin + store basename + path) for places outside the router. */
export function adminAbsoluteUrl(p: string): string {
  return `${window.location.origin}${APP_BASENAME}${adminPath(p)}`;
}
