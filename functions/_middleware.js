// Cloudflare Pages middleware for SPA routing and SSR
import { onRequest as ssrMiddleware } from './ssr-middleware.js';

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  
  // Skip middleware for /functions/* routes - let them handle directly
  if (url.pathname.startsWith('/functions/')) {
    return next();
  }
  
  // Apply SSR middleware for bots (handles product, category, brand pages)
  const userAgent = request.headers.get('user-agent') || '';
  const botUserAgents = ['googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider', 'yandexbot'];
  const isBot = botUserAgents.some(bot => userAgent.toLowerCase().includes(bot));
  
  if (isBot && (
    url.pathname === '/' ||
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
