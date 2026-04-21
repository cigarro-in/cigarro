import type { ComponentType } from 'react';

export type ThemeSlotName =
  | 'Layout'
  | 'AgeVerification'
  | 'Home'
  | 'Products'
  | 'Category'
  | 'Categories'
  | 'Product'
  | 'Cart'
  | 'Checkout'
  | 'Profile'
  | 'ProfileSettings'
  | 'Orders'
  | 'Wishlist'
  | 'Addresses'
  | 'Brands'
  | 'Header'
  | 'Footer'
  | 'ProductCard';

export type ThemeSlotMap = Partial<Record<ThemeSlotName, ComponentType<any>>>;

export interface ThemeManifest {
  id: string;
  name: string;
  description: string;
  preview?: string;
  slots: ThemeSlotMap;
}
