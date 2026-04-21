import { lazy } from 'react';
import type { ThemeManifest } from '../types';

const Home = lazy(() => import('../../pages/home/HomePage').then((m) => ({ default: m.HomePage })));
const Products = lazy(() => import('../../pages/products/ProductsPage').then((m) => ({ default: m.ProductsPage })));
const Category = lazy(() => import('../../pages/products/CategoryPage').then((m) => ({ default: m.CategoryPage })));
const Categories = lazy(() => import('../../pages/products/CategoriesPage').then((m) => ({ default: m.CategoriesPage })));
const Product = lazy(() => import('../../pages/products/ProductPage'));
const Cart = lazy(() => import('../../pages/checkout/CartPage'));
const Profile = lazy(() => import('../../pages/user/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const ProfileSettings = lazy(() => import('../../pages/user/ProfileSettingsPage').then((m) => ({ default: m.ProfileSettingsPage })));
const Orders = lazy(() => import('../../pages/user/OrdersPage').then((m) => ({ default: m.OrdersPage })));
const Wishlist = lazy(() => import('../../pages/user/WishlistPage').then((m) => ({ default: m.WishlistPage })));
const Addresses = lazy(() => import('../../pages/user/AddressesPage').then((m) => ({ default: m.AddressesPage })));
const Brands = lazy(() => import('../../pages/brands/BrandsPage').then((m) => ({ default: m.BrandsPage })));

export const classicTheme: ThemeManifest = {
  id: 'classic',
  name: 'Classic',
  description: 'Premium editorial design with warm tones and serif typography',
  slots: {
    Home,
    Products,
    Category,
    Categories,
    Product,
    Cart,
    Profile,
    ProfileSettings,
    Orders,
    Wishlist,
    Addresses,
    Brands,
  },
};
