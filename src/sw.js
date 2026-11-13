// Service worker (vite-plugin-pwa injectManifest). The build-time manifest holds
// only static assets. index.html is never precached: a precached shell has no
// edge-injected window.__ORG__, so it can name the wrong store.
//
// Navigations are network-first. Each successful storefront navigation is cached
// under its own URL, so this origin's offline copy is always this store's page.
// The edge marks a page with X-Org-Injected only when it carries window.__ORG__.
import { precacheAndRoute, cleanupOutdatedCaches, matchPrecache } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';

// Must stay false: the waiting worker activates only when the app applies it.
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
clientsClaim();

// Admin host and the /sa super-admin app are never stored in the pages cache.
function isAdminOrSa(url) {
  return url.hostname.split('.')[0] === 'admin' || url.pathname === '/sa' || url.pathname.startsWith('/sa/');
}

const pagesStrategy = new NetworkFirst({
  cacheName: 'pages',
  networkTimeoutSeconds: 3,
  plugins: [
    new CacheableResponsePlugin({
      statuses: [200],
      headers: { 'X-Org-Injected': '1' },
    }),
    new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 }),
  ],
});

registerRoute(
  ({ request, url }) => request.mode === 'navigate' && !isAdminOrSa(url),
  async (options) => {
    try {
      // Network first. On timeout or failure, the cached copy of this same URL.
      return await pagesStrategy.handle(options);
    } catch {
      // Offline page miss: this origin's cached home page, never another store.
      const home = await caches.open('pages').then((cache) => cache.match(new URL('/', self.location.origin).href));
      if (home) return home;
      const offline = await matchPrecache('/offline.html');
      if (offline) return offline;
      return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  },
);

// API catalogue responses: stale-while-revalidate, never on the admin host.
registerRoute(
  ({ url }) =>
    url.hostname.split('.')[0] !== 'admin' &&
    /\/api\/(homepage-data|products|categories|brands)/i.test(url.pathname),
  new StaleWhileRevalidate({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// Google Fonts.
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-stylesheets',
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  }),
);
registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);
