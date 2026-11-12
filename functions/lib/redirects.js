// Per-store 301/302/410 redirects at the edge.
//
// Wired into functions/_middleware.js for storefront hosts. The middleware passes
// { waitUntil: context.waitUntil.bind(context) } as the 4th argument so the hit
// counter write finishes after the response is sent.
//
// Lookups go to Convex redirects:lookup, cached 60s in the Cache API (misses
// are cached too). Any failure returns null, so the page renders as usual.

import { requiredConvexUrl } from './env.js';

const CACHE_SECONDS = 60;
const CACHE_HOST = 'https://redirect-cache.internal';
const HIT_THROTTLE_MS = 60_000;
const HIT_THROTTLE_MAX_KEYS = 5000;

// Per-isolate throttle: each store+path is counted at most once per window.
const recentHits = new Map();

function shouldCountHit(orgSlug, path, now = Date.now()) {
  const key = `${orgSlug}\n${path}`;
  const last = recentHits.get(key);
  if (last !== undefined && now - last < HIT_THROTTLE_MS) return false;
  if (recentHits.size >= HIT_THROTTLE_MAX_KEYS) recentHits.clear();
  recentHits.set(key, now);
  return true;
}

// Mirror of normalizePath in convex/lib/redirectPaths.ts. Keep in sync.
export function normalizeLookupPath(pathname) {
  let s = String(pathname || '').trim();
  const q = s.search(/[?#]/);
  if (q >= 0) s = s.slice(0, q);
  if (!s.startsWith('/')) s = '/' + s;
  s = s.replace(/\/{2,}/g, '/').toLowerCase();
  if (s.length > 1) s = s.replace(/\/+$/, '');
  return s;
}

async function convexCall(env, kind, path, args) {
  const res = await fetch(`${requiredConvexUrl(env)}/api/${kind}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, args, format: 'json' }),
  });
  if (!res.ok) throw new Error(`${path} HTTP ${res.status}`);
  const body = await res.json();
  if (body.status !== 'success') throw new Error(`${path} failed`);
  return body.value ?? null;
}

async function cachedLookup(env, orgSlug, path) {
  const cache = globalThis.caches?.default;
  const key = new Request(
    `${CACHE_HOST}/${encodeURIComponent(orgSlug)}?p=${encodeURIComponent(path)}`,
  );
  if (cache) {
    const cached = await cache.match(key);
    if (cached) return cached.json();
  }
  const value = await convexCall(env, 'query', 'redirects:lookup', { orgSlug, path });
  if (cache) {
    await cache.put(
      key,
      new Response(JSON.stringify(value), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `max-age=${CACHE_SECONDS}`,
        },
      }),
    );
  }
  return value;
}

function gonePage() {
  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="robots" content="noindex"><title>Page removed</title></head>' +
    '<body><h1>This page has been removed</h1>' +
    '<p><a href="/">Return to the homepage</a></p></body></html>';
  return new Response(html, {
    status: 410,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Robots-Tag': 'noindex',
      'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
    },
  });
}

// Returns a 301/302/410 Response for a redirected path, or null (render normally).
export async function applyRedirect(request, org, env, options = {}) {
  try {
    if (!request || (request.method !== 'GET' && request.method !== 'HEAD')) return null;
    const orgSlug = org?.slug;
    if (!orgSlug) return null;

    const url = new URL(request.url);
    const path = normalizeLookupPath(url.pathname);
    const rule = await cachedLookup(env, orgSlug, path);
    if (!rule) return null;

    // Fire-and-forget hit counter, throttled per isolate. The Convex mutation
    // only increments an existing row, so unknown paths never write.
    if (typeof options.waitUntil === 'function' && shouldCountHit(orgSlug, path)) {
      const hitWrite = convexCall(env, 'mutation', 'redirects:hit', {
        orgSlug,
        fromPath: path,
      }).catch(() => {});
      options.waitUntil(hitWrite);
    }

    if (rule.status === 410) return gonePage();

    // Preserve the request query string on the target.
    const dest = new URL(rule.toPath, url.origin);
    for (const [k, val] of url.searchParams) dest.searchParams.append(k, val);

    return new Response(null, {
      status: rule.status === 302 ? 302 : 301,
      headers: {
        Location: dest.toString(),
        'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
      },
    });
  } catch {
    // Fail open: a Convex or parsing error must never break the page.
    return null;
  }
}
