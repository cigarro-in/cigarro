// Request -> store (org) resolution for Cloudflare Pages Functions.
//
// The hostname decides the store. _middleware.js resolves once per request and
// stores the result on context.data.org; every handler reads it from there via
// getRequestOrg(context). The Convex lookup (domains:resolveByHost) is cached
// per hostname for 60s. If Convex is unreachable or the function is not deployed
// yet, we degrade to the env default org instead of taking the site down.

import { requiredConvexUrl, getOrgSlug } from './env.js';

const CACHE_TTL_SECONDS = 60;
const LOOKUP_TIMEOUT_MS = 4000;
// Store name used only when Convex cannot tell us. Matches the storefront brand.
const FALLBACK_STORE_NAME = 'Cigarro';

// Lowercase, no trailing dot, no port. IPv6 literals keep their brackets.
export function normalizeHost(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/:\d+$/, '');
}

function requestHost(request) {
  return normalizeHost(new URL(request.url).host);
}

// Preview and local hosts are never registered in orgDomains. Treat "unknown"
// as "use the default org" there instead of a 404.
function isDevHost(host) {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' ||
    host.endsWith('.pages.dev') || host.endsWith('.localhost');
}

// Used whenever the edge cannot ask Convex. Mirrors the pre-domains behaviour.
export function fallbackOrg(request, env) {
  return {
    slug: getOrgSlug(env),
    id: null,
    name: FALLBACK_STORE_NAME,
    primaryHost: requestHost(request),
    fallback: true,
  };
}

// The org for this request as set by _middleware.js, or the env fallback when
// a handler runs without it (for example if middleware was bypassed).
export function getRequestOrg(context) {
  return context.data?.org || fallbackOrg(context.request, context.env);
}

// Admin host store addressing: admin.<root>/<storeSlug>/... The first path
// segment is the store. These first segments are app or API paths, never stores.
const ADMIN_RESERVED_SEGMENTS = new Set(['api', 'assets', 'icons', 'fonts', 'functions', 'admin', 'sa']);
const STORE_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;

export function isAdminHostname(host) {
  return normalizeHost(host).split('.')[0] === 'admin';
}

// Citadel super-admin app: admin.<root>/sa/... It is not a store, so no store is
// injected and the page is never indexed.
export function isSaPath(pathname) {
  const p = String(pathname || '');
  return p === '/sa' || p.startsWith('/sa/');
}

// Store slug named by an admin-host path, or null (root, API, assets, legacy /admin).
export function adminStoreFromPath(pathname) {
  const first = String(pathname || '').split('/')[1] || '';
  if (!STORE_SLUG_RE.test(first) || ADMIN_RESERVED_SEGMENTS.has(first)) return null;
  return first;
}

// Returns:
//   {slug, id, name, primaryHost, isPrimary, redirectTo, admin?, storePath?, fallback?}  known host
//   {unavailable: true}   admin store lookup failed (never guess a store)
//   null                  unknown host or unknown admin store (Convex reachable)
// Never throws.
export async function resolveRequestOrg(request, env) {
  const host = requestHost(request);

  // Admin host: the store comes from the path. Root, API and asset requests
  // keep the default org, with no lookup (the SPA picker or login names a store).
  if (isAdminHostname(host)) {
    const slug = adminStoreFromPath(new URL(request.url).pathname);
    if (slug) return resolveAdminStore(env, host, slug);
    return {
      slug: getOrgSlug(env),
      id: null,
      name: FALLBACK_STORE_NAME,
      primaryHost: host.replace(/^admin\./, ''),
      admin: true,
      storePath: false,
    };
  }

  const cached = await readCache(host);
  if (cached !== undefined) {
    return cached === null && isDevHost(host) ? fallbackOrg(request, env) : cached;
  }

  let resolved;
  try {
    resolved = await lookupHost(env, host);
  } catch (error) {
    console.error('Org resolution unavailable, using default org:', error instanceof Error ? error.message : error);
    return fallbackOrg(request, env);
  }

  const org = resolved ? mapResolved(resolved, host) : null;
  await writeCache(host, org);
  return org === null && isDevHost(host) ? fallbackOrg(request, env) : org;
}

// Store named by an admin-host path. Cached per store for 60s like hostnames.
async function resolveAdminStore(env, host, slug) {
  const cacheKey = `${host}/_store/${slug}`;
  const cached = await readCache(cacheKey);
  if (cached !== undefined) return cached === null ? null : adminStoreOrg(cached, host);

  let row;
  try {
    row = await lookupOrgBySlug(env, slug);
  } catch (error) {
    console.error('Admin store lookup unavailable:', error instanceof Error ? error.message : error);
    return { unavailable: true };
  }
  const store = row ? { slug: row.slug, id: row._id ?? null, name: row.name } : null;
  await writeCache(cacheKey, store);
  return store ? adminStoreOrg(store, host) : null;
}

function adminStoreOrg(store, host) {
  return {
    slug: store.slug,
    id: store.id ?? null,
    name: store.name,
    primaryHost: host.replace(/^admin\./, ''),
    admin: true,
    storePath: true,
  };
}

// Active store by slug (organizations:getBySlug returns null when unknown or inactive).
async function lookupOrgBySlug(env, slug) {
  const res = await fetch(`${requiredConvexUrl(env)}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'organizations:getBySlug', args: { slug }, format: 'json' }),
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  });
  const body = await res.json();
  if (body.status !== 'success') throw new Error(`organizations:getBySlug failed: ${body.errorMessage || body.status}`);
  return body.value ?? null;
}

function mapResolved(row, host) {
  return {
    slug: row.slug,
    id: row.orgId ?? null,
    name: row.name,
    primaryHost: row.primaryHost || host,
    isPrimary: row.isPrimary === true,
    redirectTo: row.redirectTo || null,
  };
}

// Throws on any failure (network, missing function, validator error).
async function lookupHost(env, host) {
  const baseUrl = requiredConvexUrl(env);
  const res = await fetch(`${baseUrl}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'domains:resolveByHost', args: { hostname: host }, format: 'json' }),
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  });
  const body = await res.json();
  if (body.status !== 'success') throw new Error(`domains:resolveByHost failed: ${body.errorMessage || body.status}`);
  return body.value;
}

// The Cache API is keyed by URL on the same zone, so use the request's own host.
function cacheRequest(host) {
  return new Request(`https://${host}/__org_resolve_cache`);
}

async function readCache(host) {
  try {
    const cache = globalThis.caches?.default;
    if (!cache) return undefined;
    const hit = await cache.match(cacheRequest(host));
    if (!hit) return undefined;
    const data = await hit.json();
    return data.value;
  } catch {
    return undefined;
  }
}

async function writeCache(host, value) {
  try {
    const cache = globalThis.caches?.default;
    if (!cache) return;
    await cache.put(cacheRequest(host), new Response(JSON.stringify({ value }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
      },
    }));
  } catch {
    // Cache is an optimisation only.
  }
}

// Store-facing brand name for every edge output (titles, JSON-LD, robots, PWA):
// the storefront siteName from content:getSiteSettings when set, else the
// organizations.name (an internal label such as "Smokeshop").
export function brandName(org) {
  return org?.siteName || org?.name || FALLBACK_STORE_NAME;
}

// Fetches the store's siteName once per request (cached 60s per store on the
// Cache API, like hostnames). Returns null when unset or unknown; never throws.
export async function resolveSiteName(env, org) {
  const cache = globalThis.caches?.default;
  const key = new Request(`https://${org.primaryHost}/__site_name_cache/${encodeURIComponent(org.slug)}`);
  try {
    const hit = cache ? await cache.match(key) : undefined;
    if (hit) return (await hit.json()).value ?? null;
  } catch {
    // Cache is an optimisation only.
  }

  let siteName;
  try {
    const res = await fetch(`${requiredConvexUrl(env)}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'content:getSiteSettings', args: { orgSlug: org.slug }, format: 'json' }),
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });
    const body = await res.json();
    if (body.status !== 'success') throw new Error(`content:getSiteSettings failed: ${body.errorMessage || body.status}`);
    const raw = body.value?.siteName;
    siteName = typeof raw === 'string' && raw.trim() ? raw.trim() : null;
  } catch (error) {
    // Not cached, so the next request retries. The caller falls back to org.name.
    console.error('Site name unavailable, using org name:', error instanceof Error ? error.message : error);
    return null;
  }

  try {
    if (cache) {
      await cache.put(key, new Response(JSON.stringify({ value: siteName }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}` },
      }));
    }
  } catch {
    // Cache is an optimisation only.
  }
  return siteName;
}

// Injected into <head> of HTML pages so the SPA knows its store.
export function orgScriptJson(org) {
  return JSON.stringify({
    slug: org.slug,
    id: org.id ?? null,
    name: org.name,
    siteName: org.siteName ?? null,
    primaryHost: org.primaryHost,
  }).replace(/</g, '\\u003c');
}
