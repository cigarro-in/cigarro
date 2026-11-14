// Client code splitting: every page below is React.lazy so each route ships as
// its own chunk. SSR NOTE: a server render cannot wait on lazy chunks the way
// the client can, so the server entry needs eager imports for every route it
// renders (or a manifest of preloaded chunks). Swap these to static imports
// there, and keep the lazy versions for the client build.
import { CustomStorePageRoute, StorePageGate } from '../pages/storePages/StorePageGate';
import { createContext, lazy, useContext, type ReactNode } from 'react';
import { Route, Routes, matchPath } from 'react-router-dom';
import { ROUTES } from '../config/routes';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { lazyPreload, preloadComponent } from '../lib/lazyPreload';
import type { ThemeManifest } from '../themes/types';
import { Slot } from '../themes';

// Server-rendered storefront routes (src/routes/eagerRoutes.tsx). One chunk,
// kept out of the boot bundle; src/boot.tsx preloads it before hydrating a page
// that renders one of these routes (preloadRouteFor below), so hydration never
// suspends (React #421).
const eagerRoutes = () => import('./eagerRoutes');
const AgentsPage = lazyPreload(() => eagerRoutes().then((m) => m.AgentsPage));
const BlogRoute = lazyPreload(() => eagerRoutes().then((m) => m.BlogRoute));
const BlogsHubRoute = lazyPreload(() => eagerRoutes().then((m) => m.BlogsHubRoute));
const BrandRoute = lazyPreload(() => eagerRoutes().then((m) => m.BrandRoute));
const BrandsHubRoute = lazyPreload(() => eagerRoutes().then((m) => m.BrandsHubRoute));
const CategoriesHubRoute = lazyPreload(() => eagerRoutes().then((m) => m.CategoriesHubRoute));
const CategoryRoute = lazyPreload(() => eagerRoutes().then((m) => m.CategoryRoute));
const ProductsHubRoute = lazyPreload(() => eagerRoutes().then((m) => m.ProductsHubRoute));

// Themed via Slot so each theme can provide its own variant
const HomePage = () => <Slot name="Home" />;
const CartPage = () => <Slot name="Cart" />;
const ProductPage = () => <Slot name="Product" />;
const ProfilePage = () => <Slot name="Profile" />;
const ProfileSettingsPage = () => <Slot name="ProfileSettings" />;
const OrdersPage = () => <Slot name="Orders" />;
const WishlistPage = () => <Slot name="Wishlist" />;
const AddressesPage = () => <Slot name="Addresses" />;

// Shopping & Checkout
// Note: checkout pages remain on classic for payment flow stability
const CheckoutRouter = lazy(() => import('../pages/checkout/CheckoutRouter').then(m => ({ default: m.CheckoutRouter })));
const CheckoutPage = lazy(() => import('../pages/checkout/CheckoutPage').then(m => ({ default: m.CheckoutPage })));
const MobileCheckoutPage = lazy(() => import('../pages/checkout/MobileCheckoutPage').then(m => ({ default: m.MobileCheckoutPage })));
const TransactionProcessingPage = lazy(() => import('../pages/checkout/TransactionProcessingPage').then(m => ({ default: m.TransactionProcessingPage })));

// User — non-themed pages (palette-aliased classic via Vivid tokens)
const ReviewsPage = lazy(() => import('../pages/user/ReviewsPage').then(m => ({ default: m.ReviewsPage })));
const WalletPage = lazy(() => import('../pages/user/WalletPage').then(m => ({ default: m.WalletPage })));
const ReferralPage = lazy(() => import('../pages/user/ReferralPage'));
const ReferralLandingPage = lazy(() => import('../pages/referral/ReferralLandingPage'));

// Products & Categories

// Blog listing, products, categories and brands hubs: eager (eagerRoutes.tsx).
// Company and legal pages are SSR'd, so they are imported eagerly (eagerRoutes.tsx).

// Admin - New modular admin system
const AdminRouter = lazy(() => import('../adminnew/AdminRouter').then(m => ({ default: m.AdminRouter })));

// 404 — unknown URLs render noindex NotFoundPage (audit T7), never HomePage
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

/**
 * Loads the chunks the page at `pathname` renders on its first paint (theme
 * shell, age gate, route component), so the client can hydrate server markup
 * without any lazy component suspending. Never rejects.
 */
export function preloadRouteFor(pathname: string, theme: ThemeManifest): Promise<unknown> {
  const jobs: Array<Promise<unknown> | undefined> = [
    preloadComponent(theme.slots.Layout),
    preloadComponent(theme.slots.AgeVerification),
  ];
  if (matchPath(ROUTES.HOME, pathname)) jobs.push(preloadComponent(theme.slots.Home));
  else if (matchPath(ROUTES.PRODUCT_DETAIL, pathname)) jobs.push(preloadComponent(theme.slots.Product));
  else jobs.push(eagerRoutes());
  return Promise.all(jobs.map((job) => job?.catch(() => undefined)));
}

interface AppRoutesProps {
  isAdminRoute?: boolean;
  location?: any; // Used for frozen routing animations
}

// Server render only: the SSR entry supplies a route table (src/routes/ssrRoutes.tsx,
// eager imports for the SSR'd paths). Absent on the client, so the client bundle
// never imports the SSR routes.
export const RoutesOverrideContext = createContext<((location: unknown) => ReactNode) | null>(null);

export const AppRoutes = ({ isAdminRoute = false, location }: AppRoutesProps) => {
  const override = useContext(RoutesOverrideContext);
  if (override && !isAdminRoute) return <>{override(location)}</>;
  if (isAdminRoute) {
    // AdminRouter has its own Routes component, so we render it directly
    return <AdminRouter />;
  }

  return (
    <Routes location={location}>
      {/* Home */}
      <Route path={ROUTES.HOME} element={<HomePage />} />

      {/* Shopping & Checkout */}
      <Route path={ROUTES.CART} element={<CartPage />} />
      <Route path={ROUTES.CHECKOUT} element={<CheckoutRouter />} />
      <Route path={ROUTES.DESKTOP_CHECKOUT} element={<CheckoutPage />} />
      <Route path={ROUTES.MOBILE_CHECKOUT} element={<MobileCheckoutPage />} />

      {/* Payment & Orders */}
      <Route path={ROUTES.TRANSACTION_DETAIL} element={<ProtectedRoute><TransactionProcessingPage /></ProtectedRoute>} />
      <Route path={ROUTES.TRANSACTION} element={<ProtectedRoute><TransactionProcessingPage /></ProtectedRoute>} />
      <Route path={ROUTES.ORDERS} element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />

      {/* User - Protected Routes */}
      <Route path={ROUTES.PROFILE} element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path={ROUTES.PROFILE_SETTINGS} element={<ProtectedRoute><ProfileSettingsPage /></ProtectedRoute>} />
      <Route path={ROUTES.ADDRESSES} element={<ProtectedRoute><AddressesPage /></ProtectedRoute>} />
      <Route path={ROUTES.REVIEWS} element={<ProtectedRoute><ReviewsPage /></ProtectedRoute>} />
      <Route path={ROUTES.WALLET} element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
      <Route path={ROUTES.WISHLIST} element={<WishlistPage />} />
      <Route path={ROUTES.REFERRALS} element={<ProtectedRoute><ReferralPage /></ProtectedRoute>} />
      <Route path={ROUTES.REFERRAL_LANDING} element={<ReferralLandingPage />} />

      {/* Products & Categories */}
      <Route path={ROUTES.PRODUCT_DETAIL} element={<ProductPage />} />
      <Route path={ROUTES.PRODUCTS} element={<ProductsHubRoute />} />
      <Route path={ROUTES.CATEGORIES} element={<CategoriesHubRoute />} />
      <Route path={ROUTES.CATEGORY} element={<CategoryRoute />} />
      <Route path={ROUTES.CATEGORY_BRAND} element={<CategoryRoute />} />
      <Route path={ROUTES.BRANDS} element={<BrandsHubRoute />} />
      <Route path={ROUTES.BRAND_DETAIL} element={<BrandRoute />} />

      {/* Content */}
      <Route path={ROUTES.BLOGS} element={<BlogsHubRoute />} />
      <Route path={ROUTES.BLOG_POST} element={<BlogRoute />} />
      <Route path={ROUTES.ABOUT} element={<StorePageGate slug="about" />} />
      <Route path={ROUTES.CONTACT} element={<StorePageGate slug="contact" />} />
      <Route path={ROUTES.AGENTS} element={<AgentsPage />} />

      {/* Legal */}
      <Route path={ROUTES.PRIVACY} element={<StorePageGate slug="privacy" />} />
      <Route path={ROUTES.TERMS} element={<StorePageGate slug="terms" />} />
      <Route path={ROUTES.SHIPPING} element={<StorePageGate slug="shipping" />} />
      <Route path={ROUTES.RETURNS} element={<StorePageGate slug="returns" />} />
      <Route path={ROUTES.LEGAL} element={<StorePageGate slug="legal" />} />
      <Route path={ROUTES.STORE_PAGE} element={<CustomStorePageRoute />} />

      {/* Catch-all route for broken links */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
