import type { AssetUsage, UsageContext } from '../../../../lib/images/usage';

// "Where used" groups, worked out from the DB references (adminCatalog:imageUsageBatch),
// never from folders: the storage layout is flat (<store>/images/).
export type UsageFilter = 'all' | 'products' | 'categories' | 'brands' | 'blogs' | 'site' | 'unused';

export const USAGE_FILTERS: { id: UsageFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'products', label: 'Products' },
  { id: 'categories', label: 'Categories' },
  { id: 'brands', label: 'Brands' },
  { id: 'blogs', label: 'Blogs' },
  { id: 'site', label: 'Site' },
  { id: 'unused', label: 'Unused' },
];

const KIND_GROUP: Record<string, UsageFilter> = {
  variant: 'products',
  combo: 'products',
  category: 'categories',
  collection: 'categories',
  brand: 'brands',
  blog: 'blogs',
  hero: 'site',
  section: 'site',
  site: 'site',
  'homepage-config': 'site',
};

const KIND_LABEL: Record<string, string> = {
  variant: 'Product',
  combo: 'Combo',
  category: 'Category',
  collection: 'Collection',
  brand: 'Brand',
  blog: 'Blog post',
  hero: 'Hero slide',
  section: 'Homepage section',
  site: 'Store settings',
  'homepage-config': 'Homepage',
  cart: 'Saved cart',
  order: 'Past order',
};

// Field names from the usage query, in words a shop owner uses.
const DETAIL_LABEL: Record<string, string> = {
  imageUrl: 'banner',
  mobileImageUrl: 'phone banner',
  productImageUrl: 'product image',
  smallImageUrl: 'small image',
  'og image': 'share image',
  config: 'section image',
  'item snapshot': 'order photo',
  'cart image': 'cart photo',
};

/** Does this image belong under a filter chip? Unknown usage matches only "All". */
export function matchesUsage(u: AssetUsage | undefined, filter: UsageFilter): boolean {
  if (filter === 'all') return true;
  if (!u || u.total < 0) return false;
  if (filter === 'unused') return u.total === 0;
  return u.contexts.some((c) => KIND_GROUP[c.kind] === filter);
}

export function contextTitle(c: UsageContext): string {
  if (c.kind === 'site') return 'Store settings';
  return c.label;
}

export function contextSubtitle(c: UsageContext): string {
  const kind = KIND_LABEL[c.kind] ?? 'Used';
  const detail = c.detail ? DETAIL_LABEL[c.detail] ?? c.detail : '';
  if (c.kind === 'site') return detail ? detail.charAt(0).toUpperCase() + detail.slice(1) : kind;
  return detail ? `${kind} · ${detail}` : kind;
}

/** Short status for a tile: "Unused", "Used in 3 places", or null while unknown. */
export function usageShort(u: AssetUsage | undefined): string | null {
  if (!u || u.total < 0) return null;
  if (u.total === 0) return 'Unused';
  return u.total === 1 ? 'Used once' : `Used in ${u.total} places`;
}
