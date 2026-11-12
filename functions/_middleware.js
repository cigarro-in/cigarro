// Cloudflare Pages middleware for SPA routing and SSR.
// The store is resolved from the request hostname once per request (lib/org.js)
// and stored on context.data.org for every downstream handler.
import { onRequest as ssrMiddleware, isUnknownRoutePath } from './ssr-middleware.js';
import { persistCrash } from './lib/crash-logs.js';
import { resolveRequestOrg, getRequestOrg, orgScriptJson, isAdminHostname } from './lib/org.js';
import { buildAdminManifest, fetchStoreBrandColor, storeManifestPath } from './lib/admin-pwa.js';
import { applyRedirect } from './lib/redirects.js';

export async function onRequest(context) {
  const response = await handleRequest(context);
  // *.pages.dev aliases and previews duplicate the store: never index them.
  const host = new URL(context.request.url).hostname;
  return host.endsWith('.pages.dev') ? withNoindex(response) : response;
}

async function handleRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Never throws: unknown hosts resolve to null, Convex failures to the default org.
  const org = await resolveRequestOrg(request, env);
  context.data = context.data || {};
  context.data.org = org;

  if (url.pathname === '/api/crash-logs') return context.next();

  // Admin store lookup failed: refuse rather than act on the default store.
  if (org?.unavailable) {
    return new Response('Store lookup unavailable, try again shortly', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'Retry-After': '30',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  // Unknown host (Convex reachable, no such domain) or unknown admin store: plain noindex 404.
  if (org === null) {
    return new Response('Store not found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  // Alias host (e.g. a registered www domain) folds onto the store's primary host.
  if (org.redirectTo) {
    return Response.redirect(`https://${org.redirectTo}${url.pathname}${url.search}`, 301);
  }

  const onAdminHost = isAdminHostname(url.hostname);

  // Admin host: /admin/... is the pre-store address. Send it to the default store.
  if (onAdminHost && (url.pathname === '/admin' || url.pathname.startsWith('/admin/'))) {
    return Response.redirect(`https://${url.host}/${org.slug}${url.pathname}${url.search}`, 302);
  }

  // Storefront: /admin moved to the per-store admin app on admin.<root>.
  if (!onAdminHost && (url.pathname === '/admin' || url.pathname.startsWith('/admin/'))) {
    const isRoot = url.pathname === '/admin' || url.pathname === '/admin/';
    const target = isRoot
      ? `/${org.slug}/`
      : `/${org.slug}/admin${url.pathname.slice('/admin'.length)}`;
    return Response.redirect(`https://admin.${org.primaryHost}${target}${url.search}`, 302);
  }

  // Per-store admin manifest (the store is the path segment, validated above).
  if (org.storePath && url.pathname === storeManifestPath(org.slug)) {
    const brandColor = await fetchStoreBrandColor(context.env, org.slug);
    return withNoindex(new Response(JSON.stringify(buildAdminManifest(org, brandColor)), {
      headers: {
        'Content-Type': 'application/manifest+json; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    }));
  }

  // Storefront per-store redirects (301/302/410 from Convex). Document-style GETs
  // only: assets, API and function routes never consult the redirect table.
  if (!onAdminHost && (request.method === 'GET' || request.method === 'HEAD') && isRedirectCandidate(url.pathname)) {
    const redirected = await applyRedirect(request, org, env, {
      waitUntil: context.waitUntil.bind(context),
    });
    if (redirected) return redirected;
  }

  try {
    const response = await routeRequest(context);
    if (response.status >= 500) {
      context.waitUntil((async () => {
        let detail = '';
        // Only inspect bounded JSON error fields, never successful response data.
        if (response.headers.get('content-type')?.includes('application/json')) {
          const reader = response.clone().body?.getReader();
          if (reader) {
            const chunks = [];
            let size = 0;
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              size += value.length;
              if (size > 4000) { void reader.cancel(); break; }
              chunks.push(value);
            }
            if (size <= 4000) {
              try {
                const text = chunks.map(chunk => new TextDecoder().decode(chunk)).join('');
                const body = JSON.parse(text);
                detail = [body.error, body.details].filter(value => typeof value === 'string').join(': ');
              } catch { /* Non-JSON errors still get the status and request ID. */ }
            }
          }
        }
        await persistCrash(context, { message: `HTTP ${response.status}${detail ? ': ' + detail : ''}`, status: response.status });
      })().catch(() => persistCrash(context, { message: `HTTP ${response.status}`, status: response.status })));
    }
    return response;
  } catch (error) {
    context.waitUntil(persistCrash(context, {
      message: error instanceof Error ? error.message : 'Unhandled Cloudflare error',
      stack: error instanceof Error ? error.stack : '', status: 500,
    }));
    throw error;
  }
}

// True for page-like paths: no file extension, not under API, functions or assets.
function isRedirectCandidate(pathname) {
  if (pathname === '/api' || pathname.startsWith('/api/')) return false;
  if (pathname.startsWith('/functions/') || pathname.startsWith('/assets/')) return false;
  return !/\.[^/]+$/.test(pathname);
}

// Copy a response with X-Robots-Tag: noindex, nofollow (upstream headers may be immutable).
function withNoindex(res) {
  const headers = new Headers(res.headers);
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

// Passes a request on to the static SPA. HTML documents get the store injected
// into <head> as window.__ORG__ so the client knows its org without env vars.
// Only this path is rewritten; prerendered bot HTML from ssr-middleware is not.
async function nextWithOrg(context) {
  const res = await context.next();
  const type = res.headers.get('content-type') || '';
  if (!type.includes('text/html') || typeof HTMLRewriter === 'undefined') return res;
  const org = getRequestOrg(context);
  const script = `<script>window.__ORG__=${orgScriptJson(org)}</script>`;
  let rewriter = new HTMLRewriter()
    .on('head', { element(el) { el.append(script, { html: true }); } });
  // Admin store path: point the install manifest at this store's own app.
  if (org.storePath) {
    const manifestHref = storeManifestPath(org.slug);
    rewriter = rewriter.on('link[rel="manifest"]', {
      element(el) { el.setAttribute('href', manifestHref); },
    });
  }
  return rewriter.transform(res);
}

async function routeRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const next = () => nextWithOrg(context);

  // Admin host is app-only: never prerender, never index. Stamp noindex.
  if (url.hostname.split('.')[0] === 'admin') {
    const res = await next();
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return res;
  }

  // Skip middleware for /functions/* routes - let them handle directly
  if (url.pathname.startsWith('/functions/')) {
    return next();
  }

  // API responses are Function responses (they bypass _headers): never index.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    return withNoindex(await next());
  }

  // Apply SSR middleware for bots (must match BOT_USER_AGENTS in ssr-middleware.js —
  // search crawlers + social/AI preview bots, otherwise link previews hit the age-gate SPA)
  const userAgent = request.headers.get('user-agent') || '';
  const botUserAgents = ['googlebot', 'google-extended', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider', 'bytespider', 'yandexbot', 'facebookexternalhit', 'twitterbot', 'rogerbot', 'linkedinbot', 'embedly', 'quora link preview', 'showyoubot', 'outbrain', 'pinterest', 'slackbot', 'vkshare', 'w3c_validator', 'whatsapp', 'gptbot', 'oai-searchbot', 'chatgpt-user', 'claudebot', 'claude-web', 'anthropic', 'perplexity', 'meta-externalagent', 'meta-externalfetch', 'applebot', 'amazonbot'];
  const isBot = botUserAgents.some(bot => userAgent.toLowerCase().includes(bot));

  // The SSR handler gets the same context, with next() routed through the org injector.
  const ssrContext = { request, env: context.env, data: context.data, next };

  // Bare /blog is not a route (listing lives at /blogs, posts at
  // /blog/:slug): permanent redirect for every UA so no crawler or user
  // lands on the empty SPA shell. Host-relative: safe on localhost too.
  if (url.pathname === '/blog' || url.pathname === '/blog/') {
    return Response.redirect(new URL('/blogs', url).toString(), 301);
  }

  // Dead brand slugs: ktnng ("KTnnG", deleted typo of KT&G) and ktng never
  // existed as real brands — consolidate their residual traffic/links onto
  // ESSE (KT&G's brand). Host-relative: safe on localhost too.
  if (url.pathname === '/brand/ktnng' || url.pathname === '/brand/ktnng/' ||
      url.pathname === '/brand/ktng' || url.pathname === '/brand/ktng/') {
    return Response.redirect(new URL('/brand/esse', url).toString(), 301);
  }

  // Explicit ?format=json|md on read-only catalog routes: any UA.
  // (ssr-middleware.js re-validates route + format; data = public catalog only)
  const formatParam = (url.searchParams.get('format') || '').toLowerCase();
  const isAgentFormatRoute =
    url.pathname === '/agents' ||
    url.pathname === '/products' ||
    url.pathname.startsWith('/product/');
  if ((formatParam === 'json' || formatParam === 'md') && isAgentFormatRoute) {
    return ssrMiddleware(ssrContext);
  }

  if (isBot && (
    url.pathname === '/' ||
    url.pathname === '/about' ||
    url.pathname === '/contact' ||
    url.pathname === '/agents' ||
    url.pathname === '/products' ||
    url.pathname === '/categories' ||
    url.pathname === '/brands' ||
    url.pathname === '/blogs' ||
    url.pathname === '/terms' ||
    url.pathname === '/privacy' ||
    url.pathname === '/shipping' ||
    url.pathname === '/returns' ||
    url.pathname === '/legal' ||
    url.pathname.startsWith('/product/') ||
    url.pathname.startsWith('/category/') ||
    url.pathname.startsWith('/brand/') ||
    url.pathname.startsWith('/blog/')
  )) {
    return ssrMiddleware(ssrContext);
  }

  // Bots hitting a path that matches no SPA route get the branded soft 404
  // from ssr-middleware (never the 200 SPA shell). Humans are untouched.
  if (isBot && isUnknownRoutePath(url.pathname)) {
    return ssrMiddleware(ssrContext);
  }

  // Let Cloudflare Pages handle everything else (normal SPA routing)
  return next();
}
