// Storefront web app manifest, per store. The store comes from the request host
// (_middleware.js sets context.data.org). The admin host has its own manifest and
// does not use this route.

import { getRequestOrg } from './lib/org.js';
import { resolveStoreBrand, buildStoreManifest } from './lib/pwa.js';

export async function onRequest(context) {
  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const org = getRequestOrg(context);
  if (!org || org.admin || org.unavailable) {
    return new Response('Not found', { status: 404, headers: { 'X-Robots-Tag': 'noindex, nofollow' } });
  }
  const brand = await resolveStoreBrand(context.env, org);
  const body = JSON.stringify(buildStoreManifest(org, brand));
  return new Response(context.request.method === 'HEAD' ? null : body, {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
