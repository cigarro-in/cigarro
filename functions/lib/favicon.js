// Storefront favicons at fixed, crawlable URLs: /favicon.ico and /favicon-192.png.
// Each serves the store's own generated PNG icon (siteSettings.appIcons, via
// resolveStoreBrand) when it has one, else the platform icon. Responses are direct
// 200s, never redirects, because Google fetches the favicon from this URL.
// Any fetch or parse failure falls back to the platform icon.

import { resolveStoreBrand } from './pwa.js';

export const FAVICON_ICO_PATH = '/favicon.ico';
export const FAVICON_PNG_PATH = '/favicon-192.png';

const PLATFORM_ICO = '/icons/favicon.ico';
const PLATFORM_PNG_192 = '/icons/android-chrome-192x192.png';
const CACHE_CONTROL = 'public, max-age=86400';
const FETCH_TIMEOUT_MS = 5000;
const MAX_BYTES = 1024 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function isFaviconPath(pathname) {
  return pathname === FAVICON_ICO_PATH || pathname === FAVICON_PNG_PATH;
}

// Store icon candidates in preference order. 192px is a multiple of 48 (Google's
// favicon size rule), so it comes first; 512px is only a fallback for /favicon.ico.
// After the generated PNGs comes the store's own uploaded site icon (any image
// format), so a store never shows the platform icon while it has one of its own.
function storeIconCandidates(brand) {
  const appIcons = brand?.appIcons || {};
  const list = [appIcons.icon192, appIcons.icon512];
  return [...list.filter(Boolean).map((url) => ({ url, png: true })),
    ...(brand?.faviconUrl ? [{ url: brand.faviconUrl, png: false }] : [])];
}

// Fetches the store's uploaded icon (webp, png, ico, svg...). Returns
// { bytes, contentType } or null.
async function fetchAnyImage(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (!contentType.startsWith('image/')) return null;
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return null;
    return { bytes, contentType };
  } catch {
    return null;
  }
}

// Fetches a store PNG and checks its signature. Returns the bytes or null.
async function fetchStoreIcon(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    const declared = Number(res.headers.get('content-length') || 0);
    if (declared > MAX_BYTES) return null;
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength < PNG_SIGNATURE.length || bytes.byteLength > MAX_BYTES) return null;
    const head = new Uint8Array(bytes, 0, PNG_SIGNATURE.length);
    for (let i = 0; i < PNG_SIGNATURE.length; i++) if (head[i] !== PNG_SIGNATURE[i]) return null;
    return bytes;
  } catch {
    return null;
  }
}

function iconResponse(request, body, contentType) {
  return new Response(request.method === 'HEAD' ? null : body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': CACHE_CONTROL,
    },
  });
}

// The platform icon, served from the static assets binding.
async function platformIcon(context, pathname) {
  const { request, env } = context;
  if (!env?.ASSETS) return null;
  const isIco = pathname === FAVICON_ICO_PATH;
  try {
    const res = await env.ASSETS.fetch(new Request(new URL(isIco ? PLATFORM_ICO : PLATFORM_PNG_192, request.url)));
    if (!res.ok || !res.body) return null;
    return iconResponse(request, res.body, isIco ? 'image/x-icon' : 'image/png');
  } catch {
    return null;
  }
}

// Serves a favicon path for one storefront. The caller has already resolved the org
// and checked that the host is not admin.
export async function serveFavicon(context, org) {
  const { request, env } = context;
  const pathname = new URL(request.url).pathname;

  try {
    const brand = await resolveStoreBrand(env, org);
    for (const { url, png } of storeIconCandidates(brand)) {
      if (png) {
        const bytes = await fetchStoreIcon(url);
        // Generated icons are PNG (signature checked above), even at /favicon.ico.
        if (bytes) return iconResponse(request, bytes, 'image/png');
      } else {
        const image = await fetchAnyImage(url);
        if (image) return iconResponse(request, image.bytes, image.contentType);
      }
    }
  } catch (error) {
    console.error('Favicon: store icon unavailable, using platform icon:', error instanceof Error ? error.message : error);
  }

  const fallback = await platformIcon(context, pathname);
  if (fallback) return fallback;
  return new Response('Not found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
