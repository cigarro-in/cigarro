import { lazy } from 'react';
import type { ThemeManifest } from '../types';
import './tokens.css';

const Home = lazy(() => import('./VividHome').then((m) => ({ default: m.VividHome })));
const VividShell = lazy(() => import('./VividShell').then((m) => ({ default: m.VividShell })));
const VividList = lazy(() => import('./VividProductList').then((m) => ({ default: m.VividProductList })));
const VividProduct = lazy(() => import('./VividProduct'));
const VividCart = lazy(() => import('./VividCart'));

// Wrapper components so we can pass the `mode` prop into the same VividProductList
const Products = () => <VividList mode="all" />;
const Category = () => <VividList mode="category" />;

export const vividTheme: ThemeManifest = {
  id: 'vivid',
  name: 'Vivid',
  description: 'Dark, high-contrast storefront with bold accents and compact product cards',
  slots: {
    Layout: VividShell,
    Home,
    Products,
    Category,
    Product: VividProduct,
    Cart: VividCart,
  },
};
