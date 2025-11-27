// TypeScript interfaces for Product Variants, Combos, and Discounts System

export interface ProductVariant {
  id: string;
  product_id: string;
  variant_name: string;
  variant_slug?: string;
  variant_type: string; // pack, carton, box, bundle, etc.
  is_default?: boolean;
  units_contained?: number;
  unit?: string; // sticks, packs, pieces, etc.
  images?: string[];
  image_alt_text?: string;
  price: number;
  compare_at_price?: number;
  cost_price?: number;
  stock?: number;
  track_inventory?: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product?: {
    id: string;
    name: string;
    brand?: { name: string };
  };
}

// Combo (renamed from product_combos)
export interface Combo {
  id: string;
  name: string;
  slug: string;
  description?: string;
  combo_price: number;
  original_price?: number;
  discount_percentage?: number;
  image?: string;
  gallery_images?: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  combo_items?: ComboItem[];
}

// Legacy alias
export type ProductCombo = Combo;

export interface ComboItem {
  id: string;
  combo_id: string;
  variant_id: string;
  quantity: number;
  sort_order?: number;
  created_at: string;
  variant?: ProductVariant;
}

// Minimal Product type for references
export interface Product {
  id: string;
  name: string;
  slug?: string;
  brand_id?: string;
  brand?: { id: string; name: string };
}

export interface Discount {
  id: string;
  name: string;
  code?: string;
  type: 'percentage' | 'fixed_amount' | 'cart_value';
  value: number;
  min_cart_value?: number;
  max_discount_amount?: number;
  applicable_to: 'all' | 'products' | 'combos' | 'variants';
  product_ids?: string[];
  combo_ids?: string[];
  variant_ids?: string[];
  start_date?: string;
  end_date?: string;
  usage_limit?: number;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Legacy fields for backward compatibility
  discount_name?: string;
  discount_code?: string;
  discount_type?: string;
  discount_value?: number;
  minimum_cart_value?: number;
  maximum_discount_amount?: number;
  valid_from?: string;
  valid_until?: string;
  applicable_products?: string[];
  applicable_variants?: string[];
  applicable_combos?: string[];
}

export interface SearchResult {
  id: string;
  name: string;
  slug: string;
  brand?: string;
  brand_id?: string;
  description?: string;
  base_price: number;
  gallery_images?: string[];
  is_active: boolean;
  created_at: string;
  item_type: 'product' | 'combo' | 'variant';
  variant_id?: string;
  variant_name?: string;
  variant_price?: number;
  combo_id?: string;
  combo_name?: string;
  combo_price?: number;
  original_price?: number;
  matched_variant?: string;
  matched_combo?: string;
  search_score?: number;
  searchable_text: string;
  product_variants?: Array<{
    id: string;
    variant_name: string;
    price: number;
    images?: string[];
    is_default?: boolean;
  }>;
}

export interface CartItemWithVariant {
  id: string;
  name: string;
  slug: string;
  brand_name?: string;
  price: number;
  description?: string;
  is_active: boolean;
  images?: string[];
  quantity: number;
  variant_id?: string;
  variant_name?: string;
  variant_price?: number;
  combo_id?: string;
  combo_name?: string;
  combo_price?: number;
}

export interface OrderItemWithVariant {
  id: string;
  product_id: string;
  product_name: string;
  product_brand: string;
  product_price: number;
  product_image: string;
  quantity: number;
  variant_id?: string;
  variant_name?: string;
  combo_id?: string;
  combo_name?: string;
}

// Enhanced Product interface with variants
export interface ProductWithVariants {
  id: string;
  name: string;
  slug: string;
  brand_id?: string;
  brand?: { id: string; name: string };
  description?: string;
  short_description?: string;
  origin?: string;
  specifications?: Record<string, string>;
  is_active: boolean;
  meta_title?: string;
  meta_description?: string;
  canonical_url?: string;
  created_at: string;
  updated_at: string;
  product_variants?: ProductVariant[];
}

// Discount calculation result
export interface DiscountResult {
  discount_id: string;
  discount_name: string;
  discount_code?: string;
  discount_type: 'percentage' | 'fixed_amount' | 'cart_value';
  discount_value: number;
  discount_amount: number;
  original_amount: number;
  final_amount: number;
  is_applicable: boolean;
  reason?: string;
}

// Cart with discount calculation
export interface CartWithDiscount {
  items: CartItemWithVariant[];
  subtotal: number;
  discount?: DiscountResult;
  total: number;
  total_items: number;
}

// Variant selection for product pages
export interface VariantSelection {
  variant_id: string;
  variant_name: string;
  variant_price: number;
  images?: string[];
  is_available: boolean;
}

// Combo display for product pages
export interface ComboDisplay {
  combo_id: string;
  combo_name: string;
  combo_price: number;
  original_price: number;
  discount_percentage: number;
  combo_image: string;
  included_items: {
    product_name: string;
    variant_name?: string;
    quantity: number;
    price: number;
  }[];
}

// Search query parsing result
export interface SearchQueryParse {
  original_query: string;
  clean_query: string;
  target_variant?: string;
  is_combo_search: boolean;
  variant_keywords: string[];
  combo_keywords: string[];
}

// Admin interfaces for management
export interface VariantFormData {
  variant_name: string;
  variant_slug?: string;
  variant_type: string;
  is_default?: boolean;
  units_contained: number;
  unit: string;
  images: string[];
  image_alt_text?: string;
  price: number;
  compare_at_price?: number;
  cost_price?: number;
  stock: number;
  track_inventory: boolean;
  is_active: boolean;
}

export interface ComboFormData {
  name: string;
  slug: string;
  description?: string;
  combo_price: number;
  image?: string;
  gallery_images?: string[];
  is_active: boolean;
  items: {
    variant_id: string;
    quantity: number;
  }[];
}

export interface DiscountFormData {
  name: string;
  code?: string;
  type: 'percentage' | 'fixed_amount' | 'cart_value';
  value: number;
  min_cart_value?: number;
  max_discount_amount?: number;
  applicable_to: 'all' | 'products' | 'combos' | 'variants';
  product_ids?: string[];
  combo_ids?: string[];
  variant_ids?: string[];
  start_date?: string;
  end_date?: string;
  usage_limit?: number;
  is_active: boolean;
}
