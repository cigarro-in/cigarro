import { lazy } from 'react';
import type { ThemeManifest } from '../types';
import './tokens.css';
import { MinimalShell } from './MinimalShell';
import { MinimalHome } from './MinimalHome';
import MinimalProduct from './MinimalProduct';

// Home and Product are eager: they are server-rendered and must not suspend during
// hydration (React #421). Listings stay lazy. Slots not defined here (cart, profile,
// checkout, …) fall back to the default theme through Slot.

const Home = MinimalHome;
const Product = MinimalProduct;
const MinimalListing = lazy(() => import('./MinimalCatalog').then((m) => ({ default: m.MinimalCatalog })));
const Products = () => <MinimalListing mode="all" />;
const Category = () => <MinimalListing mode="category" />;

export const minimalTheme: ThemeManifest = {
  id: 'minimal',
  name: 'Minimal',
  description: 'Clean, minimal storefront: left-aligned brand, category tiles, product grid',
  slots: {
    Layout: MinimalShell,
    Home,
    Products,
    Category,
    Product,
  },
};
