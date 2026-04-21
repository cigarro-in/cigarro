import type { ComponentType } from 'react';

export type ThemeSlotName =
  | 'Layout'
  | 'Home'
  | 'Products'
  | 'Category'
  | 'Categories'
  | 'Product'
  | 'Cart'
  | 'Checkout'
  | 'Profile'
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
