// Professional Product Management with Enhanced SEO Types

export interface SEOMetadata {
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  canonical_url?: string;
  og_title?: string;
  og_description?: string;
  og_image?: string;
  twitter_title?: string;
  twitter_description?: string;
  twitter_image?: string;
  structured_data?: Record<string, any>;
  seo_score?: number;
}

export interface ProductSEO extends SEOMetadata {
  id: string;
  name: string;
  slug: string;
  brand: string;
  price: number;
  description: string;
  stock: number;
  is_active: boolean;
  rating: number;
  review_count: number;
  origin: string;
  pack_size: string;
  specifications: Record<string, string>;
  gallery_images: string[];
  image_alt_text: string;
  created_at: string;
  updated_at: string;
}

export interface VariantSEO {
  id: string;
  product_id: string;
  variant_name: string;
  variant_slug: string;
  variant_type: 'packaging' | 'color' | 'size' | 'material' | 'flavor' | 'other';
  price: number;
  stock: number;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  attributes: Record<string, string>;
  is_active: boolean;
  sort_order: number;
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  og_title?: string;
  og_description?: string;
  structured_data?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ProductImageSEO {
  id: string;
  product_id?: string;
  variant_id?: string;
  image_url: string;
  webp_url?: string;
  thumbnail_url?: string;
  medium_url?: string;
  title?: string;
  alt_text?: string;
  caption?: string;
  meta_description?: string;
  focal_point: {
    x: number;
    y: number;
  };
  image_width?: number;
  image_height?: number;
  file_size?: number;
  format?: string;
  lazy_load: boolean;
  sort_order: number;
  is_primary: boolean;
  assigned_to_variants?: string[]; // Array of variant IDs this image is assigned to
  created_at: string;
}

export interface ProductReview {
  id: string;
  product_id: string;
  variant_id?: string;
  user_id?: string;
  reviewer_name: string;
  reviewer_email?: string;
  rating: number;
  title?: string;
  content: string;
  is_verified_purchase: boolean;
  is_approved: boolean;
  helpful_votes: number;
  total_votes: number;
  created_at: string;
  updated_at: string;
}

export interface ProductSEOAnalytics {
  id: string;
  product_id: string;
  variant_id?: string;
  page_views: number;
  unique_visitors: number;
  bounce_rate: number;
  avg_time_on_page: number;
  conversion_rate: number;
  search_impressions: number;
  search_clicks: number;
  search_position: number;
  last_crawled?: string;
  last_indexed?: string;
  created_at: string;
  updated_at: string;
}

// Form interfaces for admin
export interface ProductFormData {
  name: string;
  slug: string;
  brand: string;
  price: number;
  description: string;
  stock: number;
  is_active: boolean;
  rating: number;
  review_count: number;
  origin: string;
  pack_size: string;
  specifications: { key: string; value: string }[];
  gallery_images: string[];
  image_alt_text: string;
  // SEO fields
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  canonical_url: string;
  og_title: string;
  og_description: string;
  og_image: string;
  twitter_title: string;
  twitter_description: string;
  twitter_image: string;
  structured_data: Record<string, any>;
  variants: VariantFormData[];
}

export interface VariantFormData {
  id?: string;
  variant_name: string;
  variant_slug: string;
  variant_type: 'packaging' | 'color' | 'size' | 'material' | 'flavor' | 'other';
  price: number;
  stock: number;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  attributes: { key: string; value: string }[];
  is_active: boolean;
  sort_order: number;
  // SEO fields (auto-filled)
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  og_title?: string;
  og_description?: string;
  structured_data?: Record<string, any>;
  assigned_image_ids: string[]; // IDs of images assigned to this variant
}

// Removed - using ProductImageSEO instead

// SEO utilities
export interface SEOValidation {
  isValid: boolean;
  score: number;
  issues: string[];
  suggestions: string[];
}

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
  sku?: string;
  offers: {
    '@type': 'Offer';
    price: number;
    priceCurrency: 'INR';
    availability: 'https://schema.org/InStock' | 'https://schema.org/OutOfStock';
    url: string;
  };
  aggregateRating?: {
    '@type': 'AggregateRating';
    ratingValue: number;
    reviewCount: number;
  };
  review?: Array<{
    '@type': 'Review';
    author: {
      '@type': 'Person';
      name: string;
    };
    reviewRating: {
      '@type': 'Rating';
      ratingValue: number;
    };
    reviewBody: string;
    datePublished: string;
  }>;
}

// URL management for variants (without page reload)
export interface VariantURLState {
  productSlug: string;
  variantSlug?: string;
  selectedVariant?: VariantSEO;
  canonicalUrl: string;
  metaTitle: string;
  metaDescription: string;
}

// Professional product display
export interface ProductWithVariantsSEO extends ProductSEO {
  variants: VariantSEO[];
  reviews: ProductReview[];
  seo_analytics?: ProductSEOAnalytics;
  structured_data_computed: StructuredDataProduct;
  all_images: ProductImageSEO[]; // All images for product and variants
}
