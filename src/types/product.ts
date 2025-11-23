// ============================================================================
// CENTRALIZED PRODUCT TYPE DEFINITIONS
// Single source of truth for all product-related types
// ============================================================================

export interface Product {
  id: string;
  name: string;
  slug: string;
  brand: string;
  brand_id?: string;
  
  // Pricing
  price: number;
  compare_at_price?: number; // Original price for discount display
  cost_price?: number; // Your cost (for profit calculations)
  
  // Inventory
  stock: number;
  track_inventory?: boolean;
  continue_selling_when_out_of_stock?: boolean;
  
  // Content
  description: string;
  short_description?: string;
  
  // Media
  gallery_images: string[];
  image_url?: string;
  image_alt_text?: string;
  
  // Organization
  is_active: boolean;
  
  // Legacy/Deprecated (Moved to Collections)
  is_featured?: boolean;
  is_showcase?: boolean;
  featured_order?: number;
  showcase_order?: number;
  
  // Product Details
  origin?: string;
  pack_size?: string;
  specifications?: Record<string, string>;
  
  // Ratings & Reviews
  rating: number;
  review_count: number;
  
  // SEO
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
  
  // Timestamps
  created_at: string;
  updated_at: string;
  
  // Relations (loaded via joins)
  product_variants?: ProductVariant[];
  brand_relation?: Brand;
  categories?: Category[];
  collections?: Collection[];
}

export interface Collection {
  id: string;
  title: string;
  slug: string;
  description?: string;
  image_url?: string;
  type: 'manual' | 'smart';
  rules?: any[];
  sort_order: number;
  is_active: boolean;
  seo_title?: string;
  seo_description?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  
  // Variant Identity
  variant_name: string;
  variant_slug?: string;
  variant_type: 'packaging' | 'color' | 'size' | 'material' | 'flavor' | 'other';

  // Tobacco Specifics
  packaging?: 'pack' | 'carton' | 'box' | 'bundle';
  units_contained?: number;
  images?: string[]; // Variant specific images
  
  // Pricing
  price: number;
  compare_at_price?: number;
  cost_price?: number;
  
  // Inventory
  stock: number;
  track_inventory?: boolean;
  
  // Physical Properties
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: 'cm' | 'in';
  };
  
  // Attributes (flexible key-value pairs)
  attributes: Record<string, string>;
  
  // Status
  is_active: boolean;
  sort_order: number;
  
  // SEO (optional per-variant SEO)
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  og_title?: string;
  og_description?: string;
  structured_data?: Record<string, any>;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  
  // Relations
  variant_images?: VariantImage[];
  product?: Product;
}

export interface VariantImage {
  id: string;
  variant_id?: string;
  product_id?: string;
  image_url: string;
  alt_text?: string;
  title?: string;
  caption?: string;
  meta_description?: string;
  sort_order: number;
  is_primary: boolean;
  lazy_load: boolean;
  created_at: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  website_url?: string;
  country_of_origin?: string;
  tier?: 'budget' | 'standard' | 'premium' | 'luxury';
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  image_alt_text?: string;
  meta_title?: string;
  meta_description?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// FORM DATA TYPES (for creating/editing)
// ============================================================================

export interface ProductFormData {
  // Basic Info
  name: string;
  slug: string;
  brand: string;
  brand_id?: string;
  description: string;
  short_description?: string;
  
  // Pricing
  price: number;
  compare_at_price?: number;
  cost_price?: number;
  
  // Inventory
  stock: number;
  track_inventory: boolean;
  continue_selling_when_out_of_stock: boolean;
  
  // Media
  gallery_images: string[];
  image_alt_text?: string;
  
  // Organization
  is_active: boolean;
  is_featured: boolean;
  is_showcase: boolean;
  collections: string[]; // Collection IDs
  
  // Product Details
  origin?: string;
  pack_size?: string;
  specifications: Array<{ key: string; value: string }>;
  
  // SEO
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
  
  // Variants
  variants: VariantFormData[];
}

export interface VariantFormData {
  id?: string;
  variant_name: string;
  variant_slug?: string;
  variant_type: 'packaging' | 'color' | 'size' | 'material' | 'flavor' | 'other';
  
  // Tobacco Specifics
  packaging: 'pack' | 'carton' | 'box' | 'bundle';
  units_contained: number;
  
  // Pricing
  price: number;
  compare_at_price?: number;
  cost_price?: number;
  
  // Inventory
  stock: number;
  track_inventory: boolean;
  
  // Physical
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: 'cm' | 'in';
  };
  
  // Attributes
  attributes: Array<{ key: string; value: string }>;
  
  // Status
  is_active: boolean;
  sort_order: number;
  
  // Images (URLs from product gallery assigned to this variant)
  assigned_images: string[];
  
  // SEO (optional)
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  og_title?: string;
  og_description?: string;
  structured_data?: Record<string, any>;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface PriceBreakdown {
  price: number;
  compare_at_price?: number;
  discount_amount?: number;
  discount_percentage?: number;
  profit_margin?: number;
}

export interface InventoryStatus {
  in_stock: boolean;
  stock_level: number;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
  can_backorder: boolean;
}

export interface ProductFilters {
  search?: string;
  status?: 'all' | 'active' | 'inactive';
  category?: string;
  brand?: string;
  stock_status?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
  price_min?: number;
  price_max?: number;
  has_variants?: boolean;
  is_featured?: boolean;
  sort_by?: 'created_at' | 'name' | 'price' | 'stock' | 'rating';
  sort_order?: 'asc' | 'desc';
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function calculateDiscount(price: number, compareAtPrice?: number): PriceBreakdown {
  if (!compareAtPrice || compareAtPrice <= price) {
    return { price, compare_at_price: compareAtPrice };
  }
  
  const discount_amount = compareAtPrice - price;
  const discount_percentage = Math.round((discount_amount / compareAtPrice) * 100);
  
  return {
    price,
    compare_at_price: compareAtPrice,
    discount_amount,
    discount_percentage
  };
}

export function getInventoryStatus(stock: number, continueSellingWhenOutOfStock: boolean = false): InventoryStatus {
  const stock_level = stock;
  let stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
  
  if (stock <= 0) {
    stock_status = 'out_of_stock';
  } else if (stock <= 10) {
    stock_status = 'low_stock';
  } else {
    stock_status = 'in_stock';
  }
  
  return {
    in_stock: stock > 0 || continueSellingWhenOutOfStock,
    stock_level,
    stock_status,
    can_backorder: continueSellingWhenOutOfStock
  };
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function calculateProfitMargin(price: number, costPrice?: number): number {
  if (!costPrice || costPrice === 0) return 0;
  return Math.round(((price - costPrice) / price) * 100);
}
