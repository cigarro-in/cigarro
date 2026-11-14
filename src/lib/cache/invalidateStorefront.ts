import { invalidatePrefix, invalidate } from './swrCache';
import { getAccessToken } from '../auth/session';

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
    const token = getAccessToken();
    await fetch('/api/invalidate-cache', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (err) {
    console.warn('[invalidateStorefront] Cloudflare purge failed:', err);
  }
}
