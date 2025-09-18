// Cloudflare Pages middleware for SPA routing
export function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  
  // Handle SPA routing - redirect all non-file requests to index.html
  if (!url.pathname.includes('.') && !url.pathname.startsWith('/api/')) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/index.html'
      }
    });
  }
  
  return next();
}
