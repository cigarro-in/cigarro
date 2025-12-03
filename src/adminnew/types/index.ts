/**
 * Admin Types - Centralized type definitions
 * @fileoverview Type definitions for Admin components and features
 */

export interface Product {
  id: string;
  name: string;
  slug: string;
  brand: string;
  description: string;
  is_active: boolean;
  rating: number;
  review_count: number;
  origin: string;
  specifications: Record<string, string>;
  gallery_images: string[];
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
  image_alt_text: string;
  structured_data: Record<string, any>;
  seo_score: number;
  categories?: { name: string };
  image_url?: string;
  created_at: string;
  // Legacy fields (will be removed in future)
  price?: number;
  stock?: number;
  pack_size?: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  variant_name: string;
  variant_type: 'packaging' | 'color' | 'size' | 'material' | 'flavor' | 'other';
  price: number;
  stock: number;
  is_active: boolean;
  is_default?: boolean;
  sort_order: number;
  attributes: Record<string, string>;
  images?: string[];
  products?: { name: string };
}

export interface VariantFormData {
  product_id: string;
  variant_name: string;
  variant_type: 'packaging' | 'color' | 'size' | 'material' | 'flavor' | 'other';
  price: number;
  stock: number;
  is_active: boolean;
  is_default?: boolean;
  sort_order: number;
  attributes: Record<string, string>;
  variant_images: string[];
}

export interface DashboardAnalytics {
  totalProducts: number;
  activeProducts: number;
  totalValue: number;
  lowStockProducts: number;
  recentOrders: number;
  totalCustomers: number;
  totalVariants: number;
}

export interface AdminDashboardProps {
  onStatsUpdate: () => void;
}

export type DashboardTab = 'overview' | 'products' | 'categories' | 'brands' | 'content' | 'analytics';
