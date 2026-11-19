// Per-store PWA identity for the storefront host: web app manifest, icons and the
// apple-touch / theme-color / title head tags. The store's brand comes from its
// public site settings (content:getSiteSettings) and its hero slides
// (content:listHeroSlides). Results are cached per store for a day on the Cache
// API, the same way org resolution is cached (lib/org.js).
//
// The admin host is not handled here: it keeps its own manifest (lib/admin-pwa.js).
//
// Mirror of src/lib/storeSettings.ts (resolveShareImage, storeHomeTitle). Keep the
// two in step: the client, SSR and the edge must pick the same share image and title.

import { requiredConvexUrl } from './env.js';
import { brandName } from './org.js';
import { LEGACY_ORG_SLUG } from './legacyOrg.js';

export const MANIFEST_PATH = '/manifest.webmanifest';
// Brand name/icons change rarely; a long TTL keeps this Convex lookup off the
// HTML path. A rebrand can lag up to this long per colo.
const CACHE_TTL_SECONDS = 86400;
const ICON_CACHE_TTL_SECONDS = 60 * 60 * 24;
const LOOKUP_TIMEOUT_MS = 4000;
const DEFAULT_THEME_COLOR = '#e8e0d2';
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const MIN_ICON_SIZE = 48;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
// Bump when the cached brand shape changes (old entries are then ignored).
const BRAND_CACHE_PREFIX = '__pwa_brand_cache_v2';

// Platform icons (same files as public/manifest.json). Only the legacy store
// (oldsmokeshop, Cigarro's own brand) may use them; other stores get their own.
const PLATFORM_ICONS = [
  { src: '/icons/android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
  { src: '/icons/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  { src: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
];

const isLegacyOrg = (org) => org?.slug === LEGACY_ORG_SLUG;

// Only https URLs from the store's settings reach the manifest or the HTML head.
function httpsUrl(raw) {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  return /^https:\/\/[^\s"'<>]+$/i.test(value) && value.length <= 2048 ? value : null;
}

// Generated app icons from siteSettings.appIcons (see the admin Store details page).
// Returns { icon192, icon512, maskable512, apple180 } with each entry an https URL or null.
function storeAppIcons(raw) {
  const icons = raw && typeof raw === 'object' ? raw : {};
  const out = {
    icon192: httpsUrl(icons.icon192),
    icon512: httpsUrl(icons.icon512),
    maskable512: httpsUrl(icons.maskable512),
    apple180: httpsUrl(icons.apple180),
  };
  return Object.values(out).some(Boolean) ? out : null;
}

function cleanText(raw, max) {
  return typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

// The store's link-preview image, in priority order: brand.shareImageUrl, the first
// hero slide, the logo, the site icon. Only the legacy store falls back to the
// platform /og-default.jpg. Null means the page carries no og:image.
export function resolveShareImage(input, org) {
  const picked =
    input.shareImageUrl || input.heroImageUrl || input.logoUrl || input.faviconUrl || null;
  if (picked) return picked;
  return isLegacyOrg(org) ? `https://${org.primaryHost}/og-default.jpg` : null;
}

// Store home title: "<name> | <meta title>" when the store has its own meta title
// (the title alone when it already names the store), else "<name> | Cigarettes and
// Tobacco Products Online".
export function storeHomeTitle(name, metaTitle) {
  const custom = typeof metaTitle === 'string' ? metaTitle.trim() : '';
  if (!name) return custom || 'Cigarettes and Tobacco Products Online';
  if (custom && custom !== name) return custom.includes(name) ? custom : `${name} | ${custom}`;
  return `${name} | Cigarettes and Tobacco Products Online`;
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

async function convexQuery(env, path, args) {
  const res = await fetch(`${requiredConvexUrl(env)}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, args, format: 'json' }),
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  });
  const body = await res.json();
  if (body.status !== 'success') throw new Error(`${path} failed: ${body.errorMessage || body.status}`);
  return body.value;
}

// Platform defaults for a store whose settings cannot be read (not cached).
function unavailableBrand(org) {
  return {
    brandColor: null,
    description: '',
    metaTitle: '',
    faviconUrl: null,
    logoUrl: null,
    shareImage: resolveShareImage({}, org),
    icon: null,
    appIcons: null,
  };
}

// Brand facts for one store. Never throws: on a lookup failure returns the
// platform defaults and does not cache, so the next request retries.
// Returns { brandColor, description, metaTitle, faviconUrl, logoUrl, shareImage,
//           icon: {url, size} | null, appIcons | null }.
export async function resolveStoreBrand(env, org) {
  const host = org.primaryHost;
  const cache = globalThis.caches?.default;
  const key = new Request(`https://${host}/${BRAND_CACHE_PREFIX}/${encodeURIComponent(org.slug)}`);
  try {
    const hit = cache ? await cache.match(key) : undefined;
    if (hit) return await hit.json();
  } catch {
    // Cache is an optimisation only.
  }

  let settings;
  try {
    settings = (await convexQuery(env, 'content:getSiteSettings', { orgSlug: org.slug })) ?? {};
  } catch (error) {
    console.error('PWA brand unavailable, using platform defaults:', error instanceof Error ? error.message : error);
    return unavailableBrand(org);
  }

  // The first hero slide is the share-image fallback. A failed lookup still
  // serves the brand, but is not cached, so the hero is picked up on a later request.
  let heroImageUrl = null;
  let complete = true;
  try {
    const slides = await convexQuery(env, 'content:listHeroSlides', { orgSlug: org.slug });
    heroImageUrl = httpsUrl(Array.isArray(slides) ? slides[0]?.imageUrl : null);
  } catch (error) {
    complete = false;
    console.error('PWA hero lookup failed:', error instanceof Error ? error.message : error);
  }

  const faviconUrl = httpsUrl(settings.brand?.faviconUrl) || httpsUrl(settings.faviconUrl);
  const logoUrl = httpsUrl(settings.brand?.logoUrl);
  const brandColor = typeof settings.brand?.brandColor === 'string' && HEX_COLOR_RE.test(settings.brand.brandColor)
    ? settings.brand.brandColor
    : null;
  const shareImage = resolveShareImage(
    { shareImageUrl: httpsUrl(settings.brand?.shareImageUrl), heroImageUrl, logoUrl, faviconUrl },
    org,
  );

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
    metaTitle: cleanText(settings.metaTitle, 120),
    faviconUrl,
    logoUrl,
    shareImage,
    icon,
    appIcons: storeAppIcons(settings.appIcons),
  };
  try {
    if (cache && complete) {
      await cache.put(key, new Response(JSON.stringify(brand), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}` },
      }));
    }
  } catch {
    // Cache is an optimisation only.
  }
  return brand;
}

// Manifest icons for one store: its square icon, then its generated app icons.
// Platform icons only for the legacy store; other stores with no icon get none.
function storeManifestIcons(org, brand) {
  if (brand.icon) {
    return [{ src: brand.icon.url, sizes: `${brand.icon.size}x${brand.icon.size}`, type: 'image/png', purpose: 'any' }];
  }
  const a = brand.appIcons;
  const icons = [];
  if (a?.icon192) icons.push({ src: a.icon192, sizes: '192x192', type: 'image/png', purpose: 'any' });
  if (a?.icon512) icons.push({ src: a.icon512, sizes: '512x512', type: 'image/png', purpose: 'any' });
  if (a?.maskable512) icons.push({ src: a.maskable512, sizes: '512x512', type: 'image/png', purpose: 'maskable' });
  if (icons.length) return icons;
  return isLegacyOrg(org) ? PLATFORM_ICONS : [];
}

// The storefront web app manifest for one store. start_url and scope are the
// origin root, so the installed app opens and stays on the store's own host.
export function buildStoreManifest(org, brand) {
  const name = brandName(org);
  const color = brand.brandColor || DEFAULT_THEME_COLOR;
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
    icons: storeManifestIcons(org, brand),
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
  // The store's own apple icon. The platform icon only for the legacy store.
  const appIcon = brand.appIcons?.apple180 || brand.icon?.url || (isLegacyOrg(org) ? '/icons/apple-touch-icon.png' : null);
  // Fixed, same-origin favicon URLs (functions/lib/favicon.js serves them per store).
  // The stored faviconUrl (a webp) is never a favicon link: Google needs square PNG/ICO.
  const favicon = '<link rel="icon" href="/favicon.ico"><link rel="icon" href="/favicon-192.png" sizes="192x192">';
  const tags = [
    `<link rel="manifest" href="${MANIFEST_PATH}">`,
    favicon,
    appIcon ? `<link rel="apple-touch-icon" href="${attr(appIcon)}">` : '',
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

// Static index.html head (shared by every store) rewritten for the SPA shell of
// one store: title, description, author, canonical, Open Graph and Twitter tags
// carry the store's own name and host. Only applied to the shell (not to SSR or
// bot HTML, which already carry Helmet's per-page tags). Returns the rewriter.
export function applyStaticStoreHead(rewriter, org, brand) {
  const name = brandName(org);
  const title = storeHomeTitle(name, brand.metaTitle);
  const description = brand.description || `Browse ${name} products online.`;
  const home = `https://${org.primaryHost}/`;
  const image = brand.shareImage || null;
  const set = (attrName, value) => ({ element(el) { el.setAttribute(attrName, value); } });
  const drop = { element(el) { el.remove(); } };
  let r = rewriter
    .on('title', { element(el) { el.setInnerContent(title); } })
    .on('meta[name="description"]', set('content', description))
    .on('meta[name="author"]', set('content', name))
    .on('link[rel="canonical"]', set('href', home))
    .on('meta[property="og:url"]', set('content', home))
    .on('meta[name="twitter:url"]', set('content', home))
    .on('meta[property="og:title"]', set('content', title))
    .on('meta[name="twitter:title"]', set('content', title))
    .on('meta[property="og:description"]', set('content', description))
    .on('meta[name="twitter:description"]', set('content', description))
    .on('meta[property="og:site_name"]', set('content', name));
  if (image) {
    r = r
      .on('meta[property="og:image"]', set('content', image))
      .on('meta[name="twitter:image"]', set('content', image))
      .on('meta[property="og:image:alt"]', set('content', name))
      .on('meta[name="twitter:image:alt"]', set('content', name));
    // The 1200x630 size is known only for the legacy store's shipped default image.
    if (image !== `https://${org.primaryHost}/og-default.jpg`) {
      r = r.on('meta[property="og:image:width"]', drop).on('meta[property="og:image:height"]', drop);
    }
  } else {
    // No store image: drop the platform image tags rather than point at another brand's file.
    r = r
      .on('meta[property="og:image"]', drop)
      .on('meta[name="twitter:image"]', drop)
      .on('meta[property="og:image:alt"]', drop)
      .on('meta[name="twitter:image:alt"]', drop)
      .on('meta[property="og:image:width"]', drop)
      .on('meta[property="og:image:height"]', drop);
  }
  return r;
}
