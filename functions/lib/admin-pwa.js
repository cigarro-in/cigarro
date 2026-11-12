// Per-store installable admin app. Each store gets its own manifest at
// /<slug>/manifest.webmanifest on the admin host, so installs are separate
// apps (own name, start_url and scope). The storefront manifest is untouched.

import { requiredConvexUrl } from './env.js';

const DEFAULT_THEME_COLOR = '#e8e0d2';
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function storeManifestPath(slug) {
  return `/${slug}/manifest.webmanifest`;
}

// Brand colour from the store's public site settings, or null (never throws).
export async function fetchStoreBrandColor(env, slug) {
  try {
    const res = await fetch(`${requiredConvexUrl(env)}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'content:getSiteSettings', args: { orgSlug: slug }, format: 'json' }),
      signal: AbortSignal.timeout(4000),
    });
    const body = await res.json();
    if (body.status !== 'success') return null;
    const color = body.value?.brand?.brandColor;
    return typeof color === 'string' && HEX_COLOR_RE.test(color) ? color : null;
  } catch {
    return null;
  }
}

export function buildAdminManifest(store, brandColor) {
  const themeColor = brandColor || DEFAULT_THEME_COLOR;
  const base = `/${store.slug}/`;
  return {
    id: base,
    name: `${store.name} Admin`,
    short_name: String(store.name).slice(0, 12),
    description: `Admin app for ${store.name}.`,
    start_url: base,
    scope: base,
    display: 'standalone',
    background_color: DEFAULT_THEME_COLOR,
    theme_color: themeColor,
    lang: 'en-IN',
    categories: ['business', 'shopping'],
    icons: [
      { src: '/icons/android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icons/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      { src: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
