// Display-name → URL-slug fallback. `&` becomes "and" to match DB slugs
// (e.g. benson-and-hedges); collapse + trim so "Camel (Pack of 10)"
// becomes "camel-pack-of-10", never with leading/trailing dashes.
// Prefer the DB slug whenever one exists — this is a fallback only.
export function slugify(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
