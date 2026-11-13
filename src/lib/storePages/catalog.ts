// Store pages that can be overridden from the admin (Content > Pages).
// Each slug is the built-in storefront route that renders when no published
// row exists. Keep the slugs in sync with STORE_PAGE_SLUGS in convex/storePages.ts.
export const STORE_PAGES = [
  { slug: 'about', title: 'About us', path: '/about' },
  { slug: 'contact', title: 'Contact', path: '/contact' },
  { slug: 'legal', title: 'Policies hub', path: '/legal' },
  { slug: 'terms', title: 'Terms of service', path: '/terms' },
  { slug: 'privacy', title: 'Privacy policy', path: '/privacy' },
  { slug: 'shipping', title: 'Shipping policy', path: '/shipping' },
  { slug: 'returns', title: 'Returns and refunds', path: '/returns' },
] as const;

export type StorePageSlug = (typeof STORE_PAGES)[number]['slug'];

export function storePageBySlug(slug: string) {
  return STORE_PAGES.find((p) => p.slug === slug) ?? null;
}

// Custom pages (any slug the admin creates) are served at /pages/<slug>. The
// slug rule matches convex/storePages.ts (SLUG_PATTERN).
export const CUSTOM_PAGE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function customPagePath(slug: string): string {
  return `/pages/${slug}`;
}

export function isBuiltInStorePageSlug(slug: string): boolean {
  return storePageBySlug(slug) !== null;
}
