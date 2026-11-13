// Per-store PWA identity for the storefront host: web app manifest, icons and the
// apple-touch / theme-color / title head tags. The store's brand comes from its
// public site settings (content:getSiteSettings). Results are cached per store for
// 60s on the Cache API, the same way org resolution is cached (lib/org.js).
//
// The admin host is not handled here: it keeps its own manifest (lib/admin-pwa.js).

import { requiredConvexUrl } from './env.js';
import { brandName } from './org.js';

export const MANIFEST_PATH = '/manifest.webmanifest';
const CACHE_TTL_SECONDS = 60;
const ICON_CACHE_TTL_SECONDS = 60 * 60 * 24;
const LOOKUP_TIMEOUT_MS = 4000;
const DEFAULT_THEME_COLOR = '#e8e0d2';
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const MIN_ICON_SIZE = 48;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// Platform icons (same files as public/manifest.json), used when the store has no
// square PNG icon of its own.
const PLATFORM_ICONS = [
  { src: '/icons/android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
  { src: '/icons/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  { src: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
];

// Only https URLs from the store's settings reach the manifest or the HTML head.
function httpsUrl(raw) {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  return /^https:\/\/[^\s"'<>]+$/i.test(value) && value.length <= 2048 ? value : null;
}

function cleanText(raw, max) {
  return typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

// Reads the first bytes of a PNG (Range request, body cancelled early) and returns
// its width when the image is square and at least MIN_ICON_SIZE, else null. Only
// PNG is checked; other formats fall back to the platform icon.
async function probeSquarePngSize(url) {
  let res;
  try {
    res = await fetch(url, { headers: { Range: 'bytes=0-31' }, signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
  } catch {
    return null;
  }
  if (!res.ok || !res.body) return null;
  const reader = res.body.getReader();
  let buf = new Uint8Array(0);
  try {
    while (buf.length < 24) {
      const { done, value } = await reader.read();
      if (done) break;
      const next = new Uint8Array(buf.length + value.length);
      next.set(buf);
      next.set(value, buf.length);
      buf = next;
    }
  } catch {
    return null;
  } finally {
    reader.cancel().catch(() => {});
  }
  if (buf.length < 24) return null;
  for (let i = 0; i < PNG_SIGNATURE.length; i++) if (buf[i] !== PNG_SIGNATURE[i]) return null;
  if (String.fromCharCode(buf[12], buf[13], buf[14], buf[15]) !== 'IHDR') return null;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  return width === height && width >= MIN_ICON_SIZE ? width : null;
}

// Cached per icon URL for a day (the image rarely changes). Null when unknown.
async function squarePngSizeCached(url, host) {
  const cache = globalThis.caches?.default;
  const key = new Request(`https://${host}/__pwa_icon_cache/${encodeURIComponent(url)}`);
  try {
    const hit = cache ? await cache.match(key) : undefined;
    if (hit) return (await hit.json()).value ?? null;
  } catch {
    // Cache is an optimisation only.
  }
  const size = await probeSquarePngSize(url);
  try {
    if (cache) {
      await cache.put(key, new Response(JSON.stringify({ value: size }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${ICON_CACHE_TTL_SECONDS}` },
      }));
    }
  } catch {
    // Cache is an optimisation only.
  }
  return size;
}

// Brand facts for one store. Never throws: on a lookup failure returns the
// platform defaults and does not cache, so the next request retries.
// Returns { brandColor, description, faviconUrl, icon: {url, size} | null }.
export async function resolveStoreBrand(env, org) {
  const host = org.primaryHost;
  const cache = globalThis.caches?.default;
  const key = new Request(`https://${host}/__pwa_brand_cache/${encodeURIComponent(org.slug)}`);
  try {
    const hit = cache ? await cache.match(key) : undefined;
    if (hit) return await hit.json();
  } catch {
    // Cache is an optimisation only.
  }

  let settings;
  try {
    const res = await fetch(`${requiredConvexUrl(env)}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'content:getSiteSettings', args: { orgSlug: org.slug }, format: 'json' }),
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });
    const body = await res.json();
    if (body.status !== 'success') throw new Error(`content:getSiteSettings failed: ${body.errorMessage || body.status}`);
    settings = body.value ?? {};
  } catch (error) {
    console.error('PWA brand unavailable, using platform defaults:', error instanceof Error ? error.message : error);
    return { brandColor: null, description: '', faviconUrl: null, icon: null };
  }

  const faviconUrl = httpsUrl(settings.brand?.faviconUrl) || httpsUrl(settings.faviconUrl);
  const logoUrl = httpsUrl(settings.brand?.logoUrl);
  const brandColor = typeof settings.brand?.brandColor === 'string' && HEX_COLOR_RE.test(settings.brand.brandColor)
    ? settings.brand.brandColor
    : null;

  // The square icon: the favicon first, then the logo. Non-square or unreadable
  // images are skipped, and the platform icon is used when none qualifies.
  let icon = null;
  for (const candidate of [faviconUrl, logoUrl]) {
    if (!candidate) continue;
    const size = await squarePngSizeCached(candidate, host);
    if (size) { icon = { url: candidate, size }; break; }
  }

  const brand = {
    brandColor,
    description: cleanText(settings.metaDescription, 300),
    faviconUrl,
    icon,
  };
  try {
    if (cache) {
      await cache.put(key, new Response(JSON.stringify(brand), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}` },
      }));
    }
  } catch {
    // Cache is an optimisation only.
  }
  return brand;
}

// The storefront web app manifest for one store. start_url and scope are the
// origin root, so the installed app opens and stays on the store's own host.
export function buildStoreManifest(org, brand) {
  const name = brandName(org);
  const color = brand.brandColor || DEFAULT_THEME_COLOR;
  const icons = brand.icon
    ? [{ src: brand.icon.url, sizes: `${brand.icon.size}x${brand.icon.size}`, type: 'image/png', purpose: 'any' }]
    : PLATFORM_ICONS;
  return {
    id: '/',
    name,
    short_name: name.slice(0, 12),
    description: brand.description || `Shop ${name} online.`,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: color,
    theme_color: color,
    lang: 'en-IN',
    categories: ['shopping', 'lifestyle'],
    icons,
  };
}

function attr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Head elements this rewrite owns. They are removed, then re-added for the store,
// so the static shell, SSR/Helmet output and bot HTML never disagree.
const OWNED_HEAD_SELECTORS = [
  'head link[rel="icon"]',
  'head link[rel="shortcut icon"]',
  'head link[rel="apple-touch-icon"]',
  'head link[rel="manifest"]',
  'head meta[name="theme-color"]',
  'head meta[name="apple-mobile-web-app-title"]',
];

// Rewrites the head of a storefront HTML response for one store. Idempotent: the
// owned tags are replaced, never duplicated.
export function rewriteStorefrontHead(res, org, brand) {
  const name = brandName(org);
  const color = brand.brandColor || DEFAULT_THEME_COLOR;
  const appIcon = brand.icon ? brand.icon.url : '/icons/apple-touch-icon.png';
  const favicon = brand.faviconUrl
    ? `<link rel="icon" href="${attr(brand.faviconUrl)}">`
    : '<link rel="icon" type="image/x-icon" href="/icons/favicon.ico"><link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png">';
  const tags = [
    `<link rel="manifest" href="${MANIFEST_PATH}">`,
    favicon,
    `<link rel="apple-touch-icon" href="${attr(appIcon)}">`,
    `<meta name="theme-color" content="${attr(color)}">`,
    `<meta name="apple-mobile-web-app-title" content="${attr(name.slice(0, 12))}">`,
  ].join('');

  let rewriter = new HTMLRewriter();
  for (const selector of OWNED_HEAD_SELECTORS) {
    rewriter = rewriter.on(selector, { element(el) { el.remove(); } });
  }
  rewriter = rewriter.on('head', { element(el) { el.append(tags, { html: true }); } });
  return rewriter.transform(res);
}
