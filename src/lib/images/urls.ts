// Image URL helper (R2/CDN only).
//
// Absolute URLs pass through untouched. Relative keys resolve under
// `asset_images/` on the CDN: legacy bare names only. New keys are `<store>/images/…`.
//
// Foreign placeholders: rows imported from Dukaan can still point at
// api.mydukaan.io / dms.mydukaan.io (their default "category" image and
// similar). Those are never shown; they resolve to the normal no-image
// placeholder, the same as an empty value.

const CDN_BASE = (import.meta.env.VITE_CDN_BASE_URL || 'https://cdn.cigarro.in').replace(/\/$/, '');
const PLACEHOLDER = 'https://placehold.co/600x600/f5f5f5/a3a3a3?text=No+Image';

// Mirror of isForeignPlaceholderImage in functions/lib/images.js. Keep in sync.
export function isForeignPlaceholderImage(url?: string | null): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'mydukaan.io' || host.endsWith('.mydukaan.io');
  } catch {
    return false;
  }
}

// Returns the URL, or '' when it is empty or a foreign placeholder.
export function cleanImageUrl(url?: string | null): string {
  if (!url || isForeignPlaceholderImage(url)) return '';
  return url;
}

// Same as cleanImageUrl for a list (gallery images).
export function cleanImageUrls(urls?: readonly (string | null | undefined)[] | null): string[] {
  return (urls ?? []).map((u) => cleanImageUrl(u)).filter((u): u is string => u !== '');
}

function resolve(imagePath?: string): string {
  const clean = cleanImageUrl(imagePath);
  if (!clean) return PLACEHOLDER;
  if (clean.startsWith('http')) return clean;
  const key = clean.replace(/^\/+/, '');
  return key.includes('/') ? `${CDN_BASE}/${key}` : `${CDN_BASE}/asset_images/${key}`;
}

export function getProductImageUrl(imagePath?: string): string {
  return resolve(imagePath);
}

export function getBlogImageUrl(imagePath?: string): string {
  return resolve(imagePath);
}

export function getTeamImageUrl(imagePath?: string): string {
  return resolve(imagePath);
}

export function getBrandHeritageImageUrl(imagePath?: string): string {
  return resolve(imagePath);
}
