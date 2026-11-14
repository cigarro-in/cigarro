import { requiredConvexUrl } from '../lib/env.js';
import { getRequestOrg } from '../lib/org.js';
// Cache invalidation endpoint: POST https://<store host>/api/invalidate-cache
//                              POST https://admin.<root>/api/invalidate-cache (X-Store: <slug>)
//
// Two modes:
//  1. Real purge (preferred): when CLOUDFLARE_API_TOKEN (Zone:Cache Purge)
//     and CLOUDFLARE_ZONE_ID env vars are set, purges the given paths (or a
//     default set of key pages) on every active hostname of the store via the
//     Cloudflare purge_cache API. Purge-by-URL only works for hostnames in the
//     zone (cigarro.in); other hostnames are skipped with a logged note.
//  2. Warm fallback: otherwise re-fetches key endpoints with cache-busting
//     headers so the next visitor triggers a fresh edge fetch.
//
// Always clears the SSR page cache (caches.default) for each store host and
// path, keyed the way functions/ssr-render.js keys them. That cache is per
// colo, so it only clears the colo that serves this request.
//
// Store: on the admin host the request names the store in X-Store (the admin
// path carries no store on /api/*). The edge honours it only there, and
// requireAdmin still checks membership in that named store. On a storefront
// host the store is the one the hostname resolves to.
//
// Auth: requires a session JWT for an admin/owner user
// (Authorization: Bearer <access_token>), verified against Convex
// memberships via adminStats:checkMyAdmin. The customJwt bridge yields the
// same subject the SPA uses. Set PURGE_REQUIRE_ADMIN=false to disable
// (not recommended).

// Purge paths for each store host. Built per request (see purgeUrls).
const DEFAULT_PURGE_PATHS = [
  '/',
  '/products',
  '/brands',
  '/categories',
  '/blogs',
  '/sitemap.xml',
  '/api/homepage-data',
  '/api/categories',
  '/api/products',
  '/api/brands',
];

// Cloudflare zone that owns the purge (CLOUDFLARE_ZONE_ID). Hostnames outside
// it cannot be purged by URL with that token.
const PURGE_ZONE_ROOT = 'cigarro.in';
// purge_cache by URL accepts a bounded batch per request (30 on Free/Pro plans).
const PURGE_BATCH = 30;
const STORE_HEADER_RE = /^[a-z0-9-]{1,50}$/;
const LOOKUP_TIMEOUT_MS = 4000;
const MAX_BODY_URLS = 100;

function json(payload, status, cors) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

// The store this request acts for, or null when an admin-host request names none.
function requestedStoreSlug(request, context) {
  const org = getRequestOrg(context);
  if (!org.admin) return String(org.slug);
  const named = (request.headers.get('X-Store') || '').trim().toLowerCase();
  return STORE_HEADER_RE.test(named) ? named : null;
}

async function requireAdmin(request, env, orgSlug) {
  if (env.PURGE_REQUIRE_ADMIN === 'false') return { ok: true };
  const convexUrl = requiredConvexUrl(env);
  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return { ok: false, error: 'Missing session' };
  try {
    const res = await fetch(`${convexUrl}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        path: 'adminStats:checkMyAdmin',
        args: { orgSlug },
        format: 'json',
      }),
    });
    const body = await res.json().catch(() => null);
    if (body?.status === 'success' && body.value?.ok) return { ok: true };
    return { ok: false, error: 'Admin only' };
  } catch (err) {
    return { ok: false, error: 'Auth check failed' };
  }
}

// Every active public hostname of the store (primary, aliases, managed subdomain).
async function storeHostnames(env, orgSlug) {
  const res = await fetch(`${requiredConvexUrl(env)}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: 'organizations:activeHostnamesBySlug',
      args: { slug: orgSlug },
      format: 'json',
    }),
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  });
  const body = await res.json().catch(() => null);
  if (body?.status !== 'success' || !Array.isArray(body.value)) {
    throw new Error(`organizations:activeHostnamesBySlug failed: ${body?.errorMessage || body?.status || res.status}`);
  }
  return body.value.filter((h) => typeof h === 'string' && h.length > 0);
}

function inPurgeZone(host) {
  return host === PURGE_ZONE_ROOT || host.endsWith(`.${PURGE_ZONE_ROOT}`);
}

// Paths to purge, from body.urls (full URLs or absolute paths; the host is
// replaced by each store host) or the default key pages.
function purgePaths(body) {
  if (!Array.isArray(body?.urls) || body.urls.length === 0) return DEFAULT_PURGE_PATHS;
  const paths = new Set();
  for (const raw of body.urls.slice(0, MAX_BODY_URLS)) {
    if (typeof raw !== 'string') continue;
    let path = null;
    if (raw.startsWith('/') && !raw.startsWith('//')) {
      path = raw;
    } else if (/^https?:\/\//i.test(raw)) {
      try {
        const u = new URL(raw);
        path = u.pathname + u.search;
      } catch {
        path = null;
      }
    }
    if (path && path.length <= 512) paths.add(path);
  }
  return paths.size > 0 ? [...paths] : DEFAULT_PURGE_PATHS;
}

async function realPurge(urls, env) {
  const token = env.CLOUDFLARE_API_TOKEN;
  const zone = env.CLOUDFLARE_ZONE_ID;
  if (!token || !zone) return null;
  let ok = true;
  const details = [];
  for (let i = 0; i < urls.length; i += PURGE_BATCH) {
    const batch = urls.slice(i, i + PURGE_BATCH);
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: batch }),
      }
    );
    const data = await res.json().catch(() => ({}));
    const batchOk = res.ok && data.success !== false;
    ok = ok && batchOk;
    details.push({ status: res.status, success: batchOk, errors: data.errors ?? null });
  }
  return { ok, detail: details };
}

// Drops the SSR page entries for these URLs from this colo's Cache API.
async function clearSsrCache(urls) {
  const cache = globalThis.caches?.default;
  if (!cache) return 0;
  let cleared = 0;
  for (const url of urls) {
    try {
      if (await cache.delete(new Request(url))) cleared += 1;
    } catch {
      // Cache is an optimisation only.
    }
  }
  return cleared;
}

async function warmUrls(urls) {
  return await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
          },
          cf: { cacheTtl: 0, cacheEverything: false },
        });
        return { url, success: response.ok, status: response.status };
      } catch (err) {
        return { url, success: false, error: err.message };
      }
    })
  );
}

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Store',
  };
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, corsHeaders);
  }

  const orgSlug = requestedStoreSlug(request, context);
  if (!orgSlug) {
    return json({ error: 'Store not named (X-Store required on the admin host)' }, 400, corsHeaders);
  }

  const gate = await requireAdmin(request, env, orgSlug);
  if (!gate.ok) {
    return json({ error: gate.error || 'Unauthorized' }, 401, corsHeaders);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  let hosts;
  try {
    hosts = await storeHostnames(env, orgSlug);
  } catch (err) {
    console.error('Store hostnames unavailable:', err instanceof Error ? err.message : err);
    return json({ error: 'Store hostnames unavailable; try again' }, 503, corsHeaders);
  }
  if (hosts.length === 0) {
    return json(
      { success: true, mode: 'none', message: 'Store has no active hostnames; nothing to purge.', results: [] },
      200,
      corsHeaders
    );
  }

  const skipped = hosts.filter((h) => !inPurgeZone(h));
  for (const host of skipped) {
    console.log(`invalidate-cache: ${host} is outside zone ${PURGE_ZONE_ROOT}; skipped for URL purge`);
  }
  const zoneHosts = hosts.filter(inPurgeZone);
  const paths = purgePaths(body);
  const urls = zoneHosts.flatMap((host) => paths.map((path) => `https://${host}${path}`));
  const allUrls = hosts.flatMap((host) => paths.map((path) => `https://${host}${path}`));

  const ssrCleared = await clearSsrCache(allUrls);

  // Real purge when credentials exist, warm fallback otherwise.
  const purge = urls.length > 0
    ? await realPurge(urls, env).catch((err) => ({
        ok: false,
        detail: String(err?.message || err),
      }))
    : null;
  if (purge) {
    return json(
      {
        success: purge.ok,
        mode: 'purge',
        message: purge.ok
          ? `Purged ${urls.length} URLs on ${zoneHosts.length} host(s) from edge cache.`
          : 'Cloudflare purge API failed — see detail.',
        hosts,
        skippedHosts: skipped,
        ssrCacheCleared: ssrCleared,
        detail: purge.detail,
        results: urls.map((url) => ({ url, success: purge.ok })),
      },
      purge.ok ? 200 : 502,
      corsHeaders
    );
  }

  const results = await warmUrls(allUrls);
  const successCount = results.filter((r) => r.success).length;
  return json(
    {
      success: true,
      mode: 'warm',
      message:
        `No purge credentials configured — warmed ${successCount}/${allUrls.length} ` +
        `endpoints instead. Add CLOUDFLARE_API_TOKEN + CLOUDFLARE_ZONE_ID for true purges.`,
      hosts,
      skippedHosts: skipped,
      ssrCacheCleared: ssrCleared,
      results,
    },
    200,
    corsHeaders
  );
}
