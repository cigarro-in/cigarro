import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ROUTES } from '../config/routes';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';

import { Slot } from '../themes';

// Themed via Slot so each theme can provide its own variant
const HomePage = () => <Slot name="Home" />;
const CartPage = () => <Slot name="Cart" />;
const ProductPage = () => <Slot name="Product" />;
const ProductsPage = () => <Slot name="Products" />;
const CategoryPage = () => <Slot name="Category" />;
const CategoriesPage = () => <Slot name="Categories" />;
const ProfilePage = () => <Slot name="Profile" />;
const ProfileSettingsPage = () => <Slot name="ProfileSettings" />;
const OrdersPage = () => <Slot name="Orders" />;
const WishlistPage = () => <Slot name="Wishlist" />;
const AddressesPage = () => <Slot name="Addresses" />;
const BrandsPage = () => <Slot name="Brands" />;

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
const BrandPage = lazy(() => import('../pages/brands/BrandPage').then(m => ({ default: m.BrandPage })));

// Blog
const BlogsPage = lazy(() => import('../pages/blog/BlogsPage').then(m => ({ default: m.BlogsPage })));
const BlogPost = lazy(() => import('../pages/blog/BlogsPage').then(m => ({ default: m.BlogPost })));
const AboutPage = lazy(() => import('../pages/company/AboutPage').then(m => ({ default: m.AboutPage })));
const ContactPage = lazy(() => import('../pages/company/ContactPage').then(m => ({ default: m.ContactPage })));

// Legal
const LegalPage = lazy(() => import('../pages/legal/LegalPage').then(m => ({ default: m.LegalPage })));
const TermsPage = lazy(() => import('../pages/legal/TermsPage').then(m => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import('../pages/legal/PrivacyPage').then(m => ({ default: m.PrivacyPage })));
const ShippingPage = lazy(() => import('../pages/legal/ShippingPage').then(m => ({ default: m.ShippingPage })));

// Admin - New modular admin system
const AdminRouter = lazy(() => import('../adminnew/AdminRouter').then(m => ({ default: m.AdminRouter })));

interface AppRoutesProps {
  isAdminRoute?: boolean;
  onStatsUpdate?: () => void;
  location?: any; // Used for frozen routing animations
}

export const AppRoutes = ({ isAdminRoute = false, onStatsUpdate, location }: AppRoutesProps) => {
  if (isAdminRoute) {
    // AdminRouter has its own Routes component, so we render it directly
    return <AdminRouter onStatsUpdate={onStatsUpdate || (() => { })} />;
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
      <Route path={ROUTES.PRODUCTS} element={<ProductsPage />} />
      <Route path={ROUTES.CATEGORIES} element={<CategoriesPage />} />
      <Route path={ROUTES.CATEGORY} element={<CategoryPage />} />
      <Route path={ROUTES.CATEGORY_BRAND} element={<CategoryPage />} />
      <Route path={ROUTES.BRANDS} element={<BrandsPage />} />
      <Route path={ROUTES.BRAND_DETAIL} element={<BrandPage />} />

      {/* Content */}
      <Route path={ROUTES.BLOGS} element={<BlogsPage />} />
      <Route path={ROUTES.BLOG_POST} element={<BlogPost />} />
      <Route path={ROUTES.ABOUT} element={<AboutPage />} />
      <Route path={ROUTES.CONTACT} element={<ContactPage />} />

      {/* Legal */}
      <Route path={ROUTES.PRIVACY} element={<PrivacyPage />} />
      <Route path={ROUTES.TERMS} element={<TermsPage />} />
      <Route path={ROUTES.SHIPPING} element={<ShippingPage />} />
      <Route path={ROUTES.LEGAL} element={<LegalPage />} />

      {/* Catch-all route for broken links */}
      <Route path="*" element={<HomePage />} />
    </Routes>
  );
};
