// Store pages that can be overridden from the admin (Content > Pages).
// Each slug is the built-in storefront route that renders when no published
// row exists. Titles and default text live in src/lib/content/builtinPages.ts.
// Keep the slugs in sync with STORE_PAGE_SLUGS in convex/storePages.ts.
export const STORE_PAGES = [
  { slug: 'about', path: '/about' },
  { slug: 'contact', path: '/contact' },
  { slug: 'legal', path: '/legal' },
  { slug: 'terms', path: '/terms' },
  { slug: 'privacy', path: '/privacy' },
  { slug: 'shipping', path: '/shipping' },
  { slug: 'returns', path: '/returns' },
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
