// Server render of the SSR'd storefront routes (P5-SSR slice 6). Flag-gated by
// SSR_ROUTES on the edge (functions/_middleware.js); the default is off.
//
// Pipeline per request:
//   1. preload the Convex queries the route's hooks read (fetchPreload)
//   2. render the React tree from the server bundle (functions/_ssr, src/entry-server.tsx)
//   3. take the built SPA shell (dist index.html via ASSETS) and inject the
//      rendered markup, Helmet head tags, theme attributes, window.__ORG__,
//      window.__PRELOAD__ and window.__SSR__ so the client hydrates in place
//
// Throws on any failure. The caller logs and falls back to the existing SPA /
// bot renderer, so a broken SSR bundle never takes the site down.

import { render, planSsrRoute, matchSsrRoute, flagCovers, fetchPreload, serializePreload, themeIdFromPreload } from './_ssr/entry-server.js';
import { requiredConvexUrl } from './lib/env.js';
import { getRequestOrg, orgScriptJson } from './lib/org.js';

// Preloads run in parallel (fetchPreload); each one gives up after this long and
// the client's live query covers it.
const PRELOAD_TIMEOUT_MS = 1500;
// Edge cache (Cache API, keyed per host + path): fresh for 60s, served stale for a
// further 300s while a background re-render refreshes it.
const SSR_FRESH_SECONDS = 60;
const SSR_STALE_SECONDS = 300;
const SSR_CACHE_CONTROL = `public, s-maxage=${SSR_FRESH_SECONDS}, stale-while-revalidate=${SSR_STALE_SECONDS}`;
// Lifetime of the Cache API entry: long enough to serve the stale window.
const SSR_STORE_CONTROL = `public, s-maxage=${SSR_FRESH_SECONDS + SSR_STALE_SECONDS}`;
const STORED_AT_HEADER = 'x-ssr-stored-at';

// Same security set the bot renderer stamps (Function responses bypass _headers).
const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), interest-cohort=()',
};

// SSR_ROUTES is a comma list of patterns: an exact path ("/") or a one-segment
// wildcard ("/product/*"). Empty or unset = SSR off.
export function ssrRoutesFromEnv(env) {
  return String(env?.SSR_ROUTES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// True when a flag pattern covers the path AND the server bundle has a route
// for it (src/entry-server.tsx). A flag alone never enables an unported path.
export function isSsrEnabledFor(pathname, env) {
  return ssrRoutesFromEnv(env).some((pattern) => flagCovers(pattern, pathname))
    && matchSsrRoute(pathname) !== null;
}

// Store shape the client reads from window.__ORG__ (themeId is not part of it).
function orgInfoFor(org) {
  return {
    slug: org.slug,
    id: org.id ?? undefined,
    name: org.name || '',
    primaryHost: org.primaryHost,
    siteName: org.siteName ?? undefined,
    isAdminHost: false,
    isSa: false,
    basename: '',
  };
}

// Built SPA shell (hashed client assets). "/index.html" may 308 to "/" on Pages,
// so follow one redirect to "/".
async function loadShell(context) {
  const { env, request } = context;
  const base = new URL(request.url);
  let res = await env.ASSETS.fetch(new Request(new URL('/index.html', base)));
  if (res.status >= 300 && res.status < 400) {
    res = await env.ASSETS.fetch(new Request(new URL('/', base)));
  }
  if (!res.ok) throw new Error(`SSR shell unavailable: HTTP ${res.status}`);
  return res.text();
}

// Head elements the Helmet output replaces. The static index.html copies would
// otherwise duplicate title, description, canonical and social tags.
const STATIC_HEAD_TO_REPLACE = [
  'title',
  'meta[name="robots"]',
  'meta[name="description"]',
  'meta[name="keywords"]',
  'meta[name="title"]',
  'link[rel="canonical"]',
  'meta[property^="og:"]',
  'meta[name^="twitter:"]',
];

function injectIntoShell(shell, { html, head, htmlAttrs, org, preload, orgScript }) {
  const headHasJsonLd = /application\/ld\+json/.test(head);
  // The shell's <noscript> block (a static h1 and nav for no-JS clients) would
  // add a second <h1> to the SSR markup. The server render already has the page
  // content, so the fallback is dropped on this path.
  // Helmet tags (title, meta, LCP image preload hints) go before the preload
  // payload: that script can be hundreds of KB, and hints placed after it are
  // discovered late by the browser's preload scanner.
  const inject = [
    `<script>window.__ORG__=${orgScript};window.__SSR__=true;</script>`,
    head,
    serializePreload(preload),
  ].join('');
  let rewriter = new HTMLRewriter()
    .on('noscript', {
      element(el) {
        el.remove();
      },
    })
    .on('html', {
      element(el) {
        for (const [name, value] of Object.entries(htmlAttrs)) el.setAttribute(name, value);
      },
    })
    .on('#root', {
      element(el) {
        el.setInnerContent(html, { html: true });
      },
    })
    .on('head', {
      element(el) {
        el.append(inject, { html: true });
      },
    });
  for (const sel of STATIC_HEAD_TO_REPLACE) {
    rewriter = rewriter.on(`head ${sel}`, { element(el) { el.remove(); } });
  }
  if (headHasJsonLd) {
    rewriter = rewriter.on('head script[type="application/ld+json"]', { element(el) { el.remove(); } });
  }
  return rewriter.transform(new Response(shell, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
}

// Query parameters the rendered page depends on. /products reads its filter,
// sort and search state from the URL (src/pages/products/ProductsPage.tsx); other
// routes read only ?variant=. Every other parameter is ignored, so tracking
// parameters never fragment the cache.
const PRODUCTS_RENDER_KEYS = ['category', 'brand', 'price', 'sort', 'q', 'search', 'variant'];
const VARIANT_RENDER_KEYS = ['variant'];

function renderQueryFor(url) {
  const keys = url.pathname === '/products' ? PRODUCTS_RENDER_KEYS : VARIANT_RENDER_KEYS;
  const out = new URLSearchParams();
  for (const key of keys) {
    const value = url.searchParams.get(key);
    if (value) out.set(key, value);
  }
  const query = out.toString();
  return query ? `?${query}` : '';
}

// Cache key: host + path + the render query (see renderQueryFor).
function ssrCacheKey(url) {
  return new Request(`https://${url.host}${url.pathname}${renderQueryFor(url)}`);
}

// Path the page is rendered for: the same pathname + query the cache key holds.
function renderPathFor(url) {
  return url.pathname + renderQueryFor(url);
}

// Full server render (Convex preload, React, shell injection). Throws on failure.
async function renderPage(context, url, orgInfo, org, orgScript) {
  const { env } = context;
  const plan = planSsrRoute(url.pathname, orgInfo, url.search);
  if (!plan) throw new Error(`no SSR route for ${url.pathname}`);
  const convexUrl = requiredConvexUrl(env);
  let raw = await fetchPreload(convexUrl, plan.requests, { timeoutMs: PRELOAD_TIMEOUT_MS });
  // Second stage: reads that need a first-stage row (blog related posts).
  const followUp = plan.followUpRequests(raw);
  if (followUp.length > 0) {
    raw = { ...raw, ...(await fetchPreload(convexUrl, followUp, { timeoutMs: PRELOAD_TIMEOUT_MS })) };
  }
  const preload = plan.trimPreload(raw);
  const themeId = themeIdFromPreload(preload, orgInfo.slug);

  const rendered = await render({ url: renderPathFor(url), org: orgInfo, preload, themeId });
  const shell = await loadShell(context);

  const transformed = await injectIntoShell(shell, {
    html: rendered.html,
    head: rendered.head,
    htmlAttrs: rendered.htmlAttrs,
    org,
    preload,
    orgScript,
  });
  return { body: await transformed.text(), status: rendered.status };
}

// Response for a rendered page. 404s (missing or inactive entity) are never
// cached and get the same no-store, noindex headers the bot renderer sends.
function pageResponse(method, { body, status }, cacheState) {
  const notFound = status === 404;
  const headers = new Headers({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': notFound ? 'no-store' : SSR_CACHE_CONTROL,
    'X-SSR': '1',
    // Carries window.__ORG__ (see the shell script). The service worker caches only these.
    'X-Org-Injected': '1',
    'x-ssr-cache': cacheState,
    ...(notFound ? { 'X-Robots-Tag': 'noindex, follow' } : {}),
    ...SECURITY_HEADERS,
  });
  return new Response(method === 'HEAD' ? null : body, { status, headers });
}

// Cached copy served to the visitor (the stored Cache-Control is for the cache only).
function cachedResponse(method, cached, cacheState) {
  return cached.text().then((body) => pageResponse(method, { body, status: 200 }, cacheState));
}

// Entry point. Returns a Response for the SSR'd path or throws.
export async function ssrRender(context) {
  const { request, env } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') throw new Error('SSR is GET-only');
  if (typeof HTMLRewriter === 'undefined') throw new Error('HTMLRewriter unavailable');

  const url = new URL(request.url);
  const org = getRequestOrg(context);
  const orgInfo = orgInfoFor(org);
  const orgScript = orgScriptJson(org);

  // Only anonymous GETs use the edge cache. Storefront HTML is the same for every
  // visitor (auth lives in localStorage), so an Authorization header is the only
  // signal that a response must not be shared.
  const cache = globalThis.caches?.default;
  const cacheable = request.method === 'GET' && !request.headers.get('authorization') && cache;
  if (!cacheable) {
    const page = await renderPage(context, url, orgInfo, org, orgScript);
    return pageResponse(request.method, page, 'bypass');
  }

  const key = ssrCacheKey(url);
  const cached = await cache.match(key).catch(() => undefined);
  if (cached) {
    const storedAt = Number(cached.headers.get(STORED_AT_HEADER) || 0);
    const ageSeconds = (Date.now() - storedAt) / 1000;
    if (ageSeconds < SSR_FRESH_SECONDS) {
      return cachedResponse(request.method, cached, 'hit');
    }
    if (ageSeconds < SSR_FRESH_SECONDS + SSR_STALE_SECONDS) {
      // Stale: answer now, refresh the entry after the response is sent.
      context.waitUntil(
        renderPage(context, url, orgInfo, org, orgScript)
          .then((page) => storePage(context, cache, key, page))
          .catch((error) => console.error('SSR background refresh failed:', url.pathname, error instanceof Error ? error.message : error)),
      );
      return cachedResponse(request.method, cached, 'stale');
    }
  }

  const page = await renderPage(context, url, orgInfo, org, orgScript);
  await storePage(context, cache, key, page);
  return pageResponse(request.method, page, 'miss');
}

// Stores a 200 page in the Cache API with its render time (freshness is judged
// from the stored time, not from the cache's own TTL).
async function storePage(context, cache, key, page) {
  if (page.status !== 200) return;
  // A fallback org (legacy host, Convex down) is never stored.
  if (context.data?.org?.fallback) return;
  const entry = new Response(page.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': SSR_STORE_CONTROL,
      [STORED_AT_HEADER]: String(Date.now()),
    },
  });
  context.waitUntil(cache.put(key, entry).catch(() => {}));
}
