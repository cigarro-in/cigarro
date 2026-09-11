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
