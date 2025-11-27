// ============================================================================
// CENTRALIZED PRODUCT TYPE DEFINITIONS
// Single source of truth for all product-related types
// ============================================================================

export interface Product {
  id: string;
  name: string;
  slug: string;
  brand_id?: string;
  
  // Content
  description: string;
  short_description?: string;
  
  // Product Details
  origin?: string;
  specifications?: Record<string, string>;
  
  // Organization
  is_active: boolean;
  
  // SEO (simplified)
  meta_title?: string;
  meta_description?: string;
  canonical_url?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  
  // Relations (loaded via joins)
  product_variants?: ProductVariant[];
  brand?: Brand; // Joined from brand_id
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
  product_id?: string; // Optional for display contexts
  
  // Variant Identity
  variant_name: string;
  variant_slug?: string;
  variant_type?: string; // pack, carton, box, bundle, etc. (optional for display)
  is_default?: boolean;

  // Tobacco Specifics
  units_contained?: number;
  unit?: string; // sticks, packs, pieces, etc.
  images?: string[];
  image_alt_text?: string;
  
  // Pricing
  price: number;
  compare_at_price?: number;
  cost_price?: number;
  
  // Inventory
  stock?: number;
  track_inventory?: boolean;
  
  // Status (optional for display contexts)
  is_active?: boolean;
  
  // Timestamps (optional for display contexts where not loaded)
  created_at?: string;
  updated_at?: string;
  
  // Relations
  product?: Product;
}

// Note: VariantImage table was removed - images are now stored in product_variants.images[]
// Keeping this for backward compatibility during transition
export interface VariantImage {
  id: string;
  variant_id?: string;
  image_url: string;
  alt_text?: string;
  sort_order: number;
  is_primary: boolean;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  website_url?: string;
  country_of_origin?: string;
  heritage?: Record<string, any>;
  is_active: boolean;
  sort_order: number;
  meta_title?: string;
  meta_description?: string;
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
  brand_id?: string;
  description: string;
  short_description?: string;
  
  // Organization
  is_active: boolean;
  collections: string[]; // Collection IDs
  categories: string[]; // Category IDs
  
  // Product Details
  origin?: string;
  specifications: Array<{ key: string; value: string }>;
  
  // SEO (simplified)
  meta_title?: string;
  meta_description?: string;
  canonical_url?: string;
  
  // Variants (variants own images now)
  variants: VariantFormData[];
}

export interface VariantFormData {
  id?: string;
  variant_name: string;
  variant_slug?: string;
  variant_type: string; // pack, carton, box, bundle, etc.
  is_default?: boolean;
  
  // Tobacco Specifics
  units_contained: number;
  unit: string; // sticks, packs, pieces, etc.
  
  // Images (variant owns its images now)
  images: string[];
  image_alt_text?: string;
  
  // Pricing
  price: number;
  compare_at_price?: number;
  cost_price?: number;
  
  // Inventory
  stock: number;
  track_inventory: boolean;
  
  // Status
  is_active: boolean;
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
  collection?: string;
  stock_status?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
  price_min?: number;
  price_max?: number;
  sort_by?: 'created_at' | 'name' | 'price' | 'stock';
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

export function getInventoryStatus(stock: number): InventoryStatus {
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
    in_stock: stock > 0,
    stock_level,
    stock_status,
    can_backorder: false
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
