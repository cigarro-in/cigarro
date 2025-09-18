// Cloudflare Pages middleware for SPA routing
export function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  
  // Let Cloudflare Pages handle everything - don't interfere
  return next();
}
