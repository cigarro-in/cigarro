// Cloudflare Pages middleware for SPA routing
export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  
  // Skip middleware for /functions/* routes - let them handle directly
  if (url.pathname.startsWith('/functions/')) {
    return next();
  }
  
  // Let Cloudflare Pages handle everything else
  return next();
}
