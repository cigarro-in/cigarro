// Image URL helper (R2/CDN only — no Supabase).
//
// Live URLs are absolute `https://cdn.cigarro.in/asset_images/...` and pass
// through untouched. Relative keys resolve under `asset_images/` on the CDN.
// The old Supabase buckets are empty (verified 2026-09-14) — team/heritage
// photos show the placeholder until real files land on R2 as:
//   asset_images/{rajesh,maria,david,elena}.jpg,
//   asset_images/DSC07229_FULL_1.webp

const CDN_BASE = (import.meta.env.VITE_CDN_BASE_URL || 'https://cdn.cigarro.in').replace(/\/$/, '');
const PLACEHOLDER = 'https://placehold.co/600x600/f5f5f5/a3a3a3?text=No+Image';

function resolve(imagePath?: string): string {
  if (!imagePath) return PLACEHOLDER;
  if (imagePath.startsWith('http')) {
    // Rewrite legacy Supabase URLs that already carry the R2 key.
    const i = imagePath.indexOf('/asset_images/');
    if (i >= 0) return `${CDN_BASE}${imagePath.slice(i)}`;
    return imagePath;
  }
  const key = imagePath.replace(/^\/+/, '');
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
