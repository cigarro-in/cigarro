import { invalidatePrefix, invalidate } from './swrCache';

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
  const isProduction =
    typeof window !== 'undefined' && window.location.hostname === 'cigarro.in';
  if (!isProduction) return;

  try {
    await fetch('/api/invalidate-cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.warn('[invalidateStorefront] Cloudflare purge failed:', err);
  }
}
