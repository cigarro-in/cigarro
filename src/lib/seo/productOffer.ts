import type { ProductVariant } from '../../types/product';

// ============================================================================
// Single source of truth for "which variant does the offer describe?"
// Used by ProductPage (meta + JSON-LD + visible UI). The Cloudflare
// prerender (functions/ssr-middleware.js) and the ?format=json feed mirror
// the same rule in plain JS: is_default flag, then a deterministic fallback.
// ============================================================================

export function getActiveVariants<T extends { is_active?: boolean }>(
  variants: T[] | undefined | null
): T[] {
  return (variants || []).filter((v) => v && v.is_active !== false);
}

// Explicit default first; otherwise a stable sort so the pick does not
// depend on database return order.
export function getDefaultVariant<T extends {
  is_active?: boolean;
  is_default?: boolean;
  variant_slug?: string;
  variant_name?: string;
  id?: string;
}>(variants: T[] | undefined | null): T | null {
  const active = getActiveVariants(variants);
  if (active.length === 0) return null;
  const flagged = active.find((v) => v.is_default === true);
  if (flagged) return flagged;
  const key = (v: T) => String(v.variant_slug || v.variant_name || v.id || '');
  return [...active].sort((a, b) => key(a).localeCompare(key(b)))[0] ?? null;
}

// Same stock rule as the ?format=json feed (functions/ssr-middleware.js
// stockStatusOf): track_inventory === false means "don't track" → available.
export function isVariantInStock(
  variant: Pick<ProductVariant, 'stock' | 'track_inventory'> | null | undefined
): boolean {
  if (!variant) return false;
  if (variant.track_inventory === false) return true;
  return Number(variant.stock ?? 0) > 0;
}

export type OfferAvailability = 'in stock' | 'out of stock';

export function getVariantAvailability(
  variant: Pick<ProductVariant, 'stock' | 'track_inventory'> | null | undefined
): OfferAvailability {
  return isVariantInStock(variant) ? 'in stock' : 'out of stock';
}

export function getSchemaAvailabilityUrl(
  variant: Pick<ProductVariant, 'stock' | 'track_inventory'> | null | undefined
): string {
  return `https://schema.org/${isVariantInStock(variant) ? 'InStock' : 'OutOfStock'}`;
}

function variantKey(variant: {
  variant_slug?: string;
  variant_name?: string;
} | null | undefined): string | null {
  if (!variant) return null;
  const raw = variant.variant_slug || variant.variant_name;
  if (!raw) return null;
  return String(raw).toLowerCase().trim().replace(/\s+/g, '-');
}

// Offer URL names the exact variant (?variant=packet) while the canonical
// page URL stays clean. Used for JSON-LD offers.url.
export function getVariantOfferUrl(
  canonicalUrl: string,
  variant: { variant_slug?: string; variant_name?: string } | null | undefined
): string {
  if (!canonicalUrl) return canonicalUrl;
  const key = variantKey(variant);
  if (!key) return canonicalUrl;
  const sep = canonicalUrl.includes('?') ? '&' : '?';
  return `${canonicalUrl}${sep}variant=${encodeURIComponent(key)}`;
}

function variantLabel(variant: { variant_name?: string } | null | undefined): string {
  return variant?.variant_name || 'Default variant';
}

export interface VariantDiscount {
  mrp: number;
  save: number;
  pct: number;
}

// Discount display model: shown only when compare_at_price is a genuine
// higher MRP. Never fabricate a discount (schema/policy compliance).
export function getVariantDiscount(
  variant: Pick<ProductVariant, 'price' | 'compare_at_price'> | null | undefined
): VariantDiscount | null {
  const price = Number(variant?.price ?? NaN);
  const mrp = Number(variant?.compare_at_price ?? NaN);
  if (!Number.isFinite(price) || !Number.isFinite(mrp)) return null;
  if (mrp <= price || price < 0) return null;
  const save = mrp - price;
  return { mrp, save, pct: Math.round((save / mrp) * 100) };
}

// Honest cross-variant note, e.g. "Packet out of stock — Carton available".
// Null when the given variant is in stock or nothing else is available.
export function getVariantStockNote<
  T extends { variant_name?: string; stock?: number; track_inventory?: boolean }
>(
  selected: T | null | undefined,
  allVariants: T[] | undefined | null
): string | null {
  if (!selected || isVariantInStock(selected)) return null;
  const alt = getActiveVariants(
    (allVariants || []) as Array<T & { is_active?: boolean }>
  ).find((v) => v !== selected && isVariantInStock(v));
  if (!alt) return `${variantLabel(selected)} out of stock`;
  return `${variantLabel(selected)} out of stock — ${variantLabel(alt)} available`;
}

// ============================================================================
// Bot-parity SEO rules (functions/ssr-middleware.js generateProductHTML). The
// SSR page and the bot HTML must agree on these, so they live here once.
// ============================================================================

// Variant key used in ?variant=<key> and offer URLs (same normalisation as
// getVariantOfferUrl). Null when the variant has neither slug nor name.
export function getVariantKey(variant: {
  variant_slug?: string;
  variant_name?: string;
} | null | undefined): string | null {
  return variantKey(variant);
}

// Carton offer: a carton-type variant (not the default) with a genuine higher
// MRP. Bots index both price points. Null when there is none.
export function getCartonVariant<T extends {
  id?: string;
  variant_type?: string;
  price?: number;
  compare_at_price?: number | null;
}>(variants: T[] | undefined | null, defaultVariant: T | null): T | null {
  return getActiveVariants(
    (variants || []) as Array<T & { is_active?: boolean }>,
  ).find((v) =>
    v !== defaultVariant &&
    v.variant_type === 'carton' &&
    Number.isFinite(Number(v.price)) && Number(v.price) >= 0 &&
    Number.isFinite(Number(v.compare_at_price)) &&
    Number(v.compare_at_price) > Number(v.price),
  ) ?? null;
}

// Product share/JSON-LD images: every active variant's images in catalog
// order (bot parity). Empty when the product has no images.
export function getProductSeoImages(
  variants: Array<{ images?: string[]; is_active?: boolean }> | undefined | null,
): string[] {
  const all = getActiveVariants(variants).flatMap((v) => (v.images || []).filter(Boolean));
  // Hero/banner art sometimes sits in a variant's image list (imported catalogs).
  // Prefer the product's own photos as the share/JSON-LD image; keep a hero
  // only when nothing else exists.
  const own = all.filter((u) => !/\/hero_images\//.test(u));
  return own.length > 0 ? own : all;
}

// Canonical URL for a product page. The stored canonical is trusted only when
// it is an https URL on this host and does not point at another product, brand,
// category or blog detail page (drifted rows). Otherwise the page's own URL.
const CATALOG_DETAIL_PATH = /^\/(product|brand|category|blog)\/[^/]+$/;
export function resolveProductCanonical(stored: string | null | undefined, selfUrl: string): string {
  if (typeof stored !== 'string' || !stored.trim()) return selfUrl;
  let candidate: URL;
  let self: URL;
  try {
    candidate = new URL(stored.trim());
    self = new URL(selfUrl);
  } catch {
    return selfUrl;
  }
  if (candidate.protocol !== 'https:' || candidate.hostname !== self.hostname) return selfUrl;
  const path = candidate.pathname.replace(/\/+$/, '') || '/';
  const selfPath = self.pathname.replace(/\/+$/, '') || '/';
  if (path !== selfPath && CATALOG_DETAIL_PATH.test(path)) return selfUrl;
  return candidate.href;
}
