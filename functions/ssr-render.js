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

const PRELOAD_TIMEOUT_MS = 3000;
const SSR_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';

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
  'meta[name="description"]',
  'meta[name="keywords"]',
  'meta[name="title"]',
  'link[rel="canonical"]',
  'meta[property^="og:"]',
  'meta[name^="twitter:"]',
];

function injectIntoShell(shell, { html, head, htmlAttrs, org, preload, orgScript }) {
  const headHasJsonLd = /application\/ld\+json/.test(head);
  const inject = [
    `<script>window.__ORG__=${orgScript};window.__SSR__=true;</script>`,
    serializePreload(preload),
    head,
  ].join('');
  let rewriter = new HTMLRewriter()
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

// Entry point. Returns a Response for the SSR'd path or throws.
export async function ssrRender(context) {
  const { request, env } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') throw new Error('SSR is GET-only');
  if (typeof HTMLRewriter === 'undefined') throw new Error('HTMLRewriter unavailable');

  const url = new URL(request.url);
  const org = getRequestOrg(context);
  const orgInfo = orgInfoFor(org);
  const orgScript = orgScriptJson(org);

  const plan = planSsrRoute(url.pathname, orgInfo);
  if (!plan) throw new Error(`no SSR route for ${url.pathname}`);
  const preload = plan.trimPreload(
    await fetchPreload(requiredConvexUrl(env), plan.requests, { timeoutMs: PRELOAD_TIMEOUT_MS }),
  );
  const themeId = themeIdFromPreload(preload, orgInfo.slug);

  const rendered = await render({ url: url.pathname + url.search, org: orgInfo, preload, themeId });
  const shell = await loadShell(context);

  const transformed = await injectIntoShell(shell, {
    html: rendered.html,
    head: rendered.head,
    htmlAttrs: rendered.htmlAttrs,
    org,
    preload,
    orgScript,
  });
  const body = await transformed.text();

  // Missing or inactive entity: same no-store, noindex 404 the bot renderer sends.
  const notFound = rendered.status === 404;
  const headers = new Headers({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': notFound ? 'no-store' : SSR_CACHE_CONTROL,
    'X-SSR': '1',
    ...(notFound ? { 'X-Robots-Tag': 'noindex, follow' } : {}),
    ...SECURITY_HEADERS,
  });
  return new Response(request.method === 'HEAD' ? null : body, { status: rendered.status, headers });
}
