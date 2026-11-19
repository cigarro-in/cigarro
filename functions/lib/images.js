// Image URL filters for edge output (API JSON, SSR markup, JSON-LD, sitemap).
// Mirror of src/lib/images/urls.ts. Keep in sync.
//
// Dukaan import leftovers point at api.mydukaan.io / dms.mydukaan.io. They are
// treated as "no image" everywhere the edge emits an image URL.

export function isForeignPlaceholderImage(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'mydukaan.io' || host.endsWith('.mydukaan.io');
  } catch {
    return false;
  }
}

// The URL, or null when it is empty or a foreign placeholder.
export function cleanImageUrl(url) {
  if (!url || typeof url !== 'string' || isForeignPlaceholderImage(url)) return null;
  return url;
}

// A gallery with the foreign placeholders removed.
export function cleanImageUrls(urls) {
  return (Array.isArray(urls) ? urls : []).map(cleanImageUrl).filter(Boolean);
}
