import { invalidatePrefix, invalidate } from './swrCache';
import { getAccessToken } from '../auth/session';
import { ORG_SLUG } from '../convex/org';

/**
 * Invalidate storefront caches after admin edits.
 * - Clears in-memory + localStorage SWR cache entries
 * - Pings the Cloudflare purge function (production only — no-op in dev)
 *
 * Call this after any admin action that mutates homepage data, hero slides,
 * section configurations, products, or categories.
 */
export async function invalidateStorefront() {
  // 1. Client cache
  invalidate('homepage:v1');
  invalidatePrefix('products:');

  // 2. Cloudflare edge cache. Admin runs on admin.<root>/<store>, not on the store's
  // primary host, so the check must not compare hostnames: that skipped every purge.
  // Only local development hosts skip it.
  if (typeof window === 'undefined') return;
  const host = window.location.hostname;
  const isLocal =
    host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.localhost');
  if (isLocal) return;

  try {
    // On the admin host the store comes from the admin path (ORG_SLUG). X-Store names
    // it so the edge purges that store's hostnames and checks membership in it.
    const token = getAccessToken();
    const res = await fetch('/api/invalidate-cache', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ORG_SLUG ? { 'X-Store': ORG_SLUG } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) console.warn('[invalidateStorefront] edge purge returned', res.status);
  } catch (err) {
    console.warn('[invalidateStorefront] Cloudflare purge failed:', err);
  }
}
