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

// Returns:
//   {slug, id, name, primaryHost, isPrimary, redirectTo, admin?, fallback?}  known host
//   null                                                                   unknown host (Convex reachable)
// Never throws.
export async function resolveRequestOrg(request, env) {
  const host = requestHost(request);

  // Admin host is app-only and keeps the default org, with no lookup.
  if (host.split('.')[0] === 'admin') {
    return {
      slug: getOrgSlug(env),
      id: null,
      name: FALLBACK_STORE_NAME,
      primaryHost: host.replace(/^admin\./, ''),
      admin: true,
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

// Injected into <head> of HTML pages so the SPA knows its store.
export function orgScriptJson(org) {
  return JSON.stringify({
    slug: org.slug,
    id: org.id ?? null,
    name: org.name,
    primaryHost: org.primaryHost,
  }).replace(/</g, '\\u003c');
}
