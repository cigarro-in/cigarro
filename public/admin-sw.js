// Admin push service worker. Registered by the store admin app only, with scope
// /<store>/ on the admin host (src/adminnew/features/notifications). It has no
// fetch handler, so admin pages and API calls are never intercepted or cached
// here. The storefront worker (/sw.js, scope /) is a separate registration and
// is not affected.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = typeof data.title === 'string' && data.title ? data.title : 'Cigarro Admin';
  const tag = typeof data.tag === 'string' ? data.tag : undefined;
  const options = {
    body: typeof data.body === 'string' ? data.body : '',
    tag,
    // The store logo when the payload has one (https), else the admin default icon.
    icon: typeof data.icon === 'string' && data.icon ? data.icon : '/icons/android-chrome-192x192.png',
    // Android status-bar glyph: monochrome, transparent (public/icons).
    badge: '/icons/notification-badge-96.png',
    // A new order with the same tag replaces the old alert and alerts again.
    renotify: Boolean(tag),
    // Vibration on Android. The sound is the OS default: web push cannot set a ringtone.
    vibrate: [200, 100, 200],
    requireInteraction: false,
    silent: false,
    actions: [{ action: 'view', title: 'View order' }],
    data: { url: typeof data.url === 'string' ? data.url : null },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = event.notification.data && event.notification.data.url;
  if (!raw) return;
  const target = new URL(raw, self.location.origin);
  // Only this admin origin is ever opened from a notification.
  if (target.origin !== self.location.origin) return;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // The first path segment is the store: reuse an open tab of that store.
    const store = target.pathname.split('/')[1];
    const base = `${target.origin}/${store}/`;
    const sameStore = windows.find((client) => client.url.startsWith(base));
    if (sameStore && 'focus' in sameStore) {
      await sameStore.focus();
      if ('navigate' in sameStore) await sameStore.navigate(target.href);
      return;
    }
    await self.clients.openWindow(target.href);
  })());
});
