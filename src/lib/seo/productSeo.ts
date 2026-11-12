import type { ProductVariant } from '../../types/product';
import {
  getCartonVariant,
  getDefaultVariant,
  getProductSeoImages,
  getVariantAvailability,
  getVariantOfferUrl,
  resolveProductCanonical,
} from './productOffer';

// Head/JSON-LD inputs for a product page, shared by every product theme so the
// SSR head matches the bot HTML (functions/ssr-middleware.js generateProductHTML).
// Everything here describes the catalog default variant, never the shopper's
// pick: the head is then identical for every ?variant= and across themes.

export interface ProductSeoSource {
  name: string;
  slug: string;
  meta_title?: string | null;
  meta_description?: string | null;
  short_description?: string | null;
  description?: string | null;
  canonical_url?: string | null;
  brand?: { name: string; slug?: string } | null;
  rating_value?: number | null;
  review_count?: number | null;
}

export function productSeoProps(
  product: ProductSeoSource,
  variants: ProductVariant[],
  primaryHost: string,
  storeName: string,
) {
  const defaultVariant = getDefaultVariant<ProductVariant>(variants);
  const carton = getCartonVariant<ProductVariant>(variants, defaultVariant);
  const canonical = resolveProductCanonical(
    product.canonical_url,
    `https://${primaryHost}/product/${product.slug}`,
  );
  const images = getProductSeoImages(variants);
  return {
    title: product.meta_title || `${product.name} | ${storeName}`,
    description: product.meta_description || product.short_description || product.description || undefined,
    image: images[0],
    imageAlt: product.name,
    url: canonical,
    type: 'product' as const,
    price: defaultVariant ? defaultVariant.price.toString() : undefined,
    currency: 'INR',
    availability: getVariantAvailability(defaultVariant),
    offerUrl: getVariantOfferUrl(canonical, defaultVariant),
    brand: product.brand?.name,
    category: defaultVariant?.variant_type || 'Cigarettes',
    productName: product.name,
    productImages: images,
    additionalOffers: carton
      ? [{
          price: Number(carton.price),
          url: getVariantOfferUrl(canonical, carton),
          availability: getVariantAvailability(carton),
        }]
      : undefined,
    // Ratings pipeline: undefined (0 reviews) until real reviews exist.
    ratingValue: product.rating_value ?? undefined,
    reviewCount: product.review_count ?? undefined,
  };
}

// Breadcrumb model for a product page (bot parity: the brand level only when
// the brand has a slug, so every listed level has a visible link).
export function productBreadcrumbs(product: ProductSeoSource, primaryHost: string, canonical: string) {
  const site = `https://${primaryHost}`;
  return [
    { name: 'Home', url: `${site}/` },
    { name: 'Products', url: `${site}/products` },
    ...(product.brand?.slug && product.brand.name
      ? [{ name: product.brand.name, url: `${site}/brand/${product.brand.slug}` }]
      : []),
    { name: product.name, url: canonical },
  ];
}
