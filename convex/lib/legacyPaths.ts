// Dukaan-era URL shapes that old links and search results still use on the
// smokeshop store. Pure parsing only; redirects:lookup resolves each rule
// against the store's live catalog (see convex/redirects.ts).
// Input is a path already normalized by normalizePath (lowercase, no query).

export type LegacyRule =
  | { kind: "product"; slug: string }
  | { kind: "categories"; slug: string }
  | { kind: "brand"; slug: string }
  | { kind: "category"; slug: string }
  | { kind: "page"; slug: string }
  | { kind: "bag" };

// Dead brand slugs the edge router already sends to ESSE (see functions/_middleware.js).
const DEAD_BRANDS = new Set(["ktnng", "ktng"]);

// Old Dukaan informational pages -> this store's static page.
export const LEGACY_STATIC_PAGES: Record<string, string> = {
  "privacy-policy": "/privacy",
  privacy: "/privacy",
  "terms-conditions": "/terms",
  "terms-and-conditions": "/terms",
  terms: "/terms",
  "about-us": "/about",
  "contact-us": "/contact",
  "shipping-policy": "/shipping",
  "refund-policy": "/returns",
  "return-policy": "/returns",
};

export function legacyRule(path: string): LegacyRule | null {
  // Dukaan's literal template placeholder: /[store]/bag, or its percent-encoded form.
  if (/^\/(?:\[[^\]/]*\]|%5b[^/]*%5d)\/bag$/.test(path)) return { kind: "bag" };
  let m = path.match(/^\/products\/([^/]+)$/);
  if (m) return { kind: "product", slug: m[1] };
  m = path.match(/^\/categories\/([^/]+)$/);
  if (m) return { kind: "categories", slug: m[1] };
  m = path.match(/^\/brand\/([^/]+)$/);
  if (m && !DEAD_BRANDS.has(m[1])) return { kind: "brand", slug: m[1] };
  m = path.match(/^\/category\/([^/]+)$/);
  if (m) return { kind: "category", slug: m[1] };
  m = path.match(/^\/p\/([^/]+)$/);
  if (m) return { kind: "page", slug: m[1] };
  return null;
}

// Loose match for category names that differ only in punctuation or a plural
// ("david-off" vs "davidoff", "cigarette" vs "cigarettes").
export function fuzzyKey(slug: string): string {
  return slug.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/s$/, "");
}
