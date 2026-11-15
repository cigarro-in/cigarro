// Per-store installable admin app. Each store gets its own manifest at
// /<slug>/manifest.webmanifest on the admin host, so installs are separate
// apps (own name, start_url and scope). The storefront manifest is untouched.

import { brandName } from './org.js';

const DEFAULT_THEME_COLOR = '#e8e0d2';
// Mirrors --admin-bg in src/adminnew/styles/admin.css (light), the admin splash background.
const ADMIN_BACKGROUND_COLOR = '#f4f4f5';

export function storeManifestPath(slug) {
  return `/${slug}/manifest.webmanifest`;
}

// `brand` is resolveStoreBrand() from lib/pwa.js: { brandColor, icon: {url, size} | null, appIcons | null }.
export function buildAdminManifest(store, brand) {
  const themeColor = brand?.brandColor || DEFAULT_THEME_COLOR;
  const base = `/${store.slug}/`;
  const name = brandName(store);
  return {
    id: base,
    name: `${name} Admin`,
    short_name: name.slice(0, 12),
    description: `Admin app for ${name}.`,
    start_url: base,
    scope: base,
    display: 'standalone',
    background_color: ADMIN_BACKGROUND_COLOR,
    theme_color: themeColor,
    lang: 'en-IN',
    categories: ['business', 'shopping'],
    icons: storeIcons(brand),
  };
}

// The store's generated app icons (siteSettings.appIcons) when it has them; else the
// favicon/logo and the platform icons.
function storeIcons(brand) {
  const generated = brand?.appIcons;
  if (generated) {
    const list = [
      generated.icon192 && { src: generated.icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
      generated.icon512 && { src: generated.icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
      generated.maskable512 && { src: generated.maskable512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ].filter(Boolean);
    if (list.length) return list;
  }
  return [
    // The store's own square icon first (favicon or logo), when it has one.
    ...(brand?.icon
      ? [{ src: brand.icon.url, sizes: `${brand.icon.size}x${brand.icon.size}`, type: 'image/png', purpose: 'any' }]
      : []),
    { src: '/icons/android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: '/icons/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    { src: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
  ];
}
