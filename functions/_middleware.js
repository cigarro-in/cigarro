// Cloudflare Pages middleware for SPA routing
export function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  
  // Only handle SPA routing for specific cases, let _redirects handle the rest
  // This prevents redirect loops
  if (url.pathname === '/' || (!url.pathname.includes('.') && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/_'))) {
    return new Response(null, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
      }
    });
  }
  
  return next();
}
