import { lazy } from 'react';
import type { ThemeManifest } from '../types';
import './tokens.css';

const Home = lazy(() => import('./VividHome').then((m) => ({ default: m.VividHome })));
const VividShell = lazy(() => import('./VividShell').then((m) => ({ default: m.VividShell })));
const VividList = lazy(() => import('./VividProductList').then((m) => ({ default: m.VividProductList })));
const VividProduct = lazy(() => import('./VividProduct'));
const VividCart = lazy(() => import('./VividCart'));
const VividProfile = lazy(() => import('./VividProfile').then((m) => ({ default: m.VividProfile })));
const VividCategories = lazy(() => import('./VividCategories').then((m) => ({ default: m.VividCategories })));
const VividOrders = lazy(() => import('./VividOrders').then((m) => ({ default: m.VividOrders })));
const VividWishlist = lazy(() => import('./VividWishlist').then((m) => ({ default: m.VividWishlist })));
const VividAddresses = lazy(() => import('./VividAddresses').then((m) => ({ default: m.VividAddresses })));
const VividProfileSettings = lazy(() => import('./VividProfileSettings').then((m) => ({ default: m.VividProfileSettings })));
const VividBrands = lazy(() => import('./VividBrands').then((m) => ({ default: m.VividBrands })));
const VividAgeVerification = lazy(() => import('./VividAgeVerification').then((m) => ({ default: m.VividAgeVerification })));

// Wrapper components so we can pass the `mode` prop into the same VividProductList
const Products = () => <VividList mode="all" />;
const Category = () => <VividList mode="category" />;

export const vividTheme: ThemeManifest = {
  id: 'vivid',
  name: 'Vivid',
  description: 'Light, high-contrast storefront with bold accents and compact product rows',
  slots: {
    Layout: VividShell,
    AgeVerification: VividAgeVerification,
    Home,
    Products,
    Category,
    Categories: VividCategories,
    Product: VividProduct,
    Cart: VividCart,
    Profile: VividProfile,
    ProfileSettings: VividProfileSettings,
    Orders: VividOrders,
    Wishlist: VividWishlist,
    Addresses: VividAddresses,
    Brands: VividBrands,
  },
};
