// Cloudflare Pages middleware for SPA routing and SSR
import { onRequest as ssrMiddleware } from './ssr-middleware.js';

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  
  // Skip middleware for /functions/* routes - let them handle directly
  if (url.pathname.startsWith('/functions/')) {
    return next();
  }
  
  // Apply SSR middleware for bots (must match BOT_USER_AGENTS in ssr-middleware.js —
  // search crawlers + social/AI preview bots, otherwise link previews hit the age-gate SPA)
  const userAgent = request.headers.get('user-agent') || '';
  const botUserAgents = ['googlebot', 'google-extended', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider', 'bytespider', 'yandexbot', 'facebookexternalhit', 'twitterbot', 'rogerbot', 'linkedinbot', 'embedly', 'quora link preview', 'showyoubot', 'outbrain', 'pinterest', 'slackbot', 'vkshare', 'w3c_validator', 'whatsapp', 'gptbot', 'oai-searchbot', 'chatgpt-user', 'claudebot', 'claude-web', 'anthropic', 'perplexity', 'meta-externalagent', 'meta-externalfetch', 'applebot', 'amazonbot'];
  const isBot = botUserAgents.some(bot => userAgent.toLowerCase().includes(bot));

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
    return ssrMiddleware(context);
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
    url.pathname === '/legal' ||
    url.pathname.startsWith('/product/') ||
    url.pathname.startsWith('/category/') ||
    url.pathname.startsWith('/brand/') ||
    url.pathname.startsWith('/blog/')
  )) {
    return ssrMiddleware(context);
  }
  
  // Let Cloudflare Pages handle everything else (normal SPA routing)
  return next();
}
