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

  // 2. Cloudflare edge cache (only meaningful in production)
  // The edge injects the store's primary host; absent in dev, so dev never purges.
  const primaryHost = typeof window !== 'undefined' ? window.__ORG__?.primaryHost : undefined;
  const isProduction =
    !!primaryHost && window.location.hostname === primaryHost.split(':')[0];
  if (!isProduction) return;

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
