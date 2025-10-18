// TypeScript interfaces for Product Variants, Combos, and Discounts System

export interface ProductVariant {
  id: string;
  product_id: string;
  variant_name: string;
  variant_type: 'packaging' | 'color' | 'size' | 'material' | 'flavor' | 'other';
  variant_description?: string;
  price: number;
  stock: number;
  stock_quantity?: number; // Keep for backward compatibility
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  attributes?: Record<string, any>; // JSONB field for variant attributes
  is_active: boolean;
  sort_order: number;
  // New schema supports variant_images table; keep images for backward compat
  images?: VariantImage[];
  variant_images?: VariantImage[];
  created_at: string;
  updated_at: string;
  products?: {
    id: string;
    name: string;
    brand: string;
  };
}

export interface VariantImage {
  id: string;
  variant_id: string;
  image_url: string;
  alt_text?: string;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
}

export interface ProductCombo {
  id: string;
  name: string;
  slug: string;
  description?: string;
  combo_price: number;
  original_price: number;
  discount_percentage: number;
  savings_amount?: number;
  combo_image?: string;
  gallery_images: string[];
  is_active: boolean;
  sort_order?: number;
  created_at: string;
  updated_at: string;
  items: ComboItem[];
  combo_items?: ComboItem[];
}

export interface ComboItem {
  id: string;
  combo_id: string;
  product_id: string;
  variant_id?: string;
  quantity: number;
  sort_order: number;
  created_at: string;
  product?: Product;
  variant?: ProductVariant;
}

// Minimal Product type for references in combos and elsewhere
export interface Product {
  id: string;
  name: string;
  slug?: string;
  brand: string; // Made required again since we added it back to database
  price?: number;
  gallery_images?: string[];
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
  brand: string; // Made required again since we added it back to database
  description?: string;
  base_price: number;
  gallery_images: string[];
  rating: number;
  review_count: number;
  is_active: boolean;
  created_at: string;
  item_type: 'product' | 'variant' | 'combo';
  variant_id?: string;
  variant_name?: string;
  variant_price?: number;
  combo_id?: string;
  combo_name?: string;
  combo_price?: number;
  original_price?: number;
  searchable_text: string;
  search_score: number;
  matched_variant?: string;
  matched_combo?: string;
}

export interface CartItemWithVariant {
  id: string;
  name: string;
  slug: string;
  brand: string; // Made required again since we added it back to database
  price: number;
  description: string;
  is_active: boolean;
  gallery_images: string[];
  rating: number;
  review_count: number;
  image?: string;
  created_at?: string;
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
  brand: string; // Made required again since we added it back to database
  price: number;
  description: string;
  is_active: boolean;
  gallery_images: string[];
  rating: number;
  review_count: number;
  created_at: string;
  variants: ProductVariant[];
  combos: ProductCombo[];
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
  variant_images: string[];
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
  variant_type: 'packaging' | 'color' | 'size' | 'material' | 'flavor' | 'other';
  price: number;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  is_active: boolean;
  sort_order: number;
}

export interface ComboFormData {
  name: string;
  slug: string;
  description?: string;
  combo_price: number;
  combo_image?: File;
  gallery_images: File[];
  is_active: boolean;
  items: {
    product_id: string;
    variant_id?: string;
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
