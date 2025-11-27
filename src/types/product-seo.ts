// Simplified SEO Types - aligned with new database schema
// Most SEO is now handled at product level only (not variant level)

// Basic SEO metadata for products
export interface SEOMetadata {
  meta_title?: string;
  meta_description?: string;
  canonical_url?: string;
}

// Re-export from main product types for backward compatibility
export type { Product, ProductVariant, Brand, Category } from './product';

// Structured data for Google
export interface StructuredDataProduct {
  '@context': 'https://schema.org';
  '@type': 'Product';
  name: string;
  description: string;
  brand: {
    '@type': 'Brand';
    name: string;
  };
  image: string[];
  offers: {
    '@type': 'Offer';
    price: number;
    priceCurrency: 'INR';
    availability: 'https://schema.org/InStock' | 'https://schema.org/OutOfStock';
    url: string;
  };
}

// URL management for variants (without page reload)
export interface VariantURLState {
  productSlug: string;
  variantSlug?: string;
  canonicalUrl: string;
  metaTitle: string;
  metaDescription: string;
}
