// Client entry. The store identity must be settled before any module that reads
// it is evaluated (convex/org.ts, the router, the app), so the app itself is
// loaded from ./boot only after ensureStoreIdentity() resolves.
import { ensureStoreIdentity } from './lib/org/ensureStoreIdentity';

// index.html flags admin hosts before paint (data-admin-boot). Clear it on any
// other host, such as a storefront that happens to serve /sa. Inline check so
// no org module is evaluated before the store identity settles.
if (location.hostname.split('.')[0] !== 'admin') document.documentElement.removeAttribute('data-admin-boot');

void (async () => {
  const ready = await ensureStoreIdentity();
  if (!ready) {
    const root = document.getElementById('root');
    if (root) root.textContent = 'This store is temporarily unavailable. Please try again shortly.';
    return;
  }
  await import('./boot');
})();
