import { lazy } from 'react';
import type { ThemeManifest } from '../types';

const Home = lazy(() => import('../../pages/home/HomePage').then((m) => ({ default: m.HomePage })));
const Products = lazy(() => import('../../pages/products/ProductsPage').then((m) => ({ default: m.ProductsPage })));
const Category = lazy(() => import('../../pages/products/CategoryPage').then((m) => ({ default: m.CategoryPage })));
const Product = lazy(() => import('../../pages/products/ProductPage'));
const Cart = lazy(() => import('../../pages/checkout/CartPage'));

export const classicTheme: ThemeManifest = {
  id: 'classic',
  name: 'Classic',
  description: 'Premium editorial design with warm tones and serif typography',
  slots: {
    Home,
    Products,
    Category,
    Product,
    Cart,
  },
};
