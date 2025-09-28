/**
 * Type definitions for Admin Dashboard components
 * Centralized types for better maintainability and consistency
 */

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  is_active: boolean;
  category?: { name: string };
  brand?: { name: string };
  image_url?: string;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  variant_name: string;
  variant_type: 'packaging' | 'color' | 'size' | 'material' | 'flavor' | 'other';
  price: number;
  stock: number;
  is_active: boolean;
  sort_order: number;
  attributes: Record<string, string>;
  variant_images?: Array<{ image_url: string; sort_order: number }>;
  products?: { name: string; brand?: { name: string } };
}

export interface VariantFormData {
  product_id: string;
  variant_name: string;
  variant_type: 'packaging' | 'color' | 'size' | 'material' | 'flavor' | 'other';
  price: number;
  stock: number;
  is_active: boolean;
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

export type DashboardTab = 'overview' | 'products' | 'variants' | 'analytics';
