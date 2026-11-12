// Serves /robots.txt per store. The Sitemap line and the agent pointers use the
// store's primary host (lib/org.js), so each domain advertises its own sitemap.

import { getRequestOrg, brandName } from './lib/org.js';

export function onRequest(context) {
  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  const host = new URL(context.request.url).hostname;
  if (host.endsWith('.pages.dev')) {
    return new Response('User-agent: *\nDisallow: /\n', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
    });
  }

  const org = getRequestOrg(context);
  const site = `https://${org.primaryHost}`;
  const body = [
    `# ${brandName(org)} - Premium Cigarette Marketplace`,
    '# Last updated: December 2025',
    '#',
    `# AI shopping agents: start at ${site}/agents`,
    `# Store manual for LLMs: ${site}/llms.txt`,
    '',
    `Sitemap: ${site}/sitemap.xml`,
    '',
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin/',
    'Disallow: /api/',
    'Disallow: /checkout',
    'Disallow: /payment',
    'Disallow: /orders',
    'Disallow: /wishlist',
    'Disallow: /cart',
    'Disallow: /profile',
    'Disallow: /login',
    'Disallow: /register',
    'Disallow: /reset-password',
    'Disallow: /verify-email',
    '',
  ].join('\n');

  return new Response(context.request.method === 'HEAD' ? null : body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
