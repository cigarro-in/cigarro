// How to fix each SEO health check, and where its Fix button goes. Keyed by the
// check id from convex/seoHealth.ts. Fix goes to the first failing item (the
// exact product, category or post); fallbackPath is used only when a check
// has no items.

export const SEO_HOW_TO: Record<string, string> = {
  meta_title_missing: 'Open the product, category or post and fill in its meta title.',
  meta_description_missing: 'Open each listed page and write a meta description of up to 160 characters.',
  title_too_long: 'Shorten the meta title to 60 characters or fewer.',
  title_too_short: 'Lengthen the meta title so it says what the page is, about 30 to 60 characters.',
  description_too_long: 'Trim the meta description to 160 characters or fewer.',
  duplicate_titles: 'Give each listed page its own meta title.',
  duplicate_slugs: 'Rename the slug on one of the matching pages so each is unique.',
  product_no_images: 'Upload at least one image on the product variant.',
  image_alt_missing: 'Add alt text to the variant image.',
  thin_content: 'Expand the description or post body to at least 50 words.',
  out_of_stock_indexed: 'Restock the product, or set it inactive if it will not come back.',
  redirect_chains: 'Point each redirect straight at the final page instead of through another redirect.',
  redirect_targets_missing: 'Point the redirect at a live page, or delete it.',
  domain_status:
    'Domains are set up by the platform team. Ask them to activate the domain and check that its CNAME points to cigarro.pages.dev.',
  store_logo_missing: 'Upload the store logo under Store details. It appears in the header, structured data and invoices.',
  site_icon_missing: 'Upload a square site icon (favicon) under Store details. Browser tabs and bookmarks use it.',
};

export const SEO_FALLBACK_PATH: Record<string, string> = {
  meta_title_missing: '/products',
  meta_description_missing: '/products',
  title_too_long: '/products',
  title_too_short: '/products',
  description_too_long: '/products',
  duplicate_titles: '/products',
  duplicate_slugs: '/products',
  product_no_images: '/products',
  image_alt_missing: '/products',
  thin_content: '/products',
  out_of_stock_indexed: '/products',
  redirect_chains: '/seo/redirects',
  redirect_targets_missing: '/seo/redirects',
  domain_status: '/settings/advanced',
  store_logo_missing: '/settings/store',
  site_icon_missing: '/settings/store',
};

/**
 * The backend points domain items at "/settings". Domains are not edited in
 * the store admin, so send them to the Advanced section, which holds the
 * store's domain-related settings.
 */
export function normalizeSeoPath(path: string): string {
  return path === '/settings' ? '/settings/advanced' : path;
}

export function seoFixPath(checkId: string, firstItemPath: string | undefined): string {
  return normalizeSeoPath(firstItemPath ?? SEO_FALLBACK_PATH[checkId] ?? '/');
}
