import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ROUTES } from '../config/routes';

// Lazy load components - organized by feature
// Home
const HomePage = lazy(() => import('../pages/home/HomePage').then(m => ({ default: m.HomePage })));

// Shopping & Checkout
const CartPage = lazy(() => import('../pages/checkout/CartPage'));
const CheckoutRouter = lazy(() => import('../pages/checkout/CheckoutRouter').then(m => ({ default: m.CheckoutRouter })));
const CheckoutPage = lazy(() => import('../pages/checkout/CheckoutPage').then(m => ({ default: m.CheckoutPage })));
const MobileCheckoutPage = lazy(() => import('../pages/checkout/MobileCheckoutPage').then(m => ({ default: m.MobileCheckoutPage })));
const TransactionProcessingPage = lazy(() => import('../pages/checkout/TransactionProcessingPage').then(m => ({ default: m.TransactionProcessingPage })));

// Orders
const OrdersPage = lazy(() => import('../pages/user/OrdersPage').then(m => ({ default: m.OrdersPage })));

// User
const ProfilePage = lazy(() => import('../pages/user/ProfilePage').then(m => ({ default: m.ProfilePage })));
const ProfileSettingsPage = lazy(() => import('../pages/user/ProfileSettingsPage').then(m => ({ default: m.ProfileSettingsPage })));
const AddressesPage = lazy(() => import('../pages/user/AddressesPage').then(m => ({ default: m.AddressesPage })));
const ReviewsPage = lazy(() => import('../pages/user/ReviewsPage').then(m => ({ default: m.ReviewsPage })));
const WalletPage = lazy(() => import('../pages/user/WalletPage').then(m => ({ default: m.WalletPage })));
const WishlistPage = lazy(() => import('../pages/user/WishlistPage').then(m => ({ default: m.WishlistPage })));
const ReferralPage = lazy(() => import('../pages/user/ReferralPage'));
const ReferralLandingPage = lazy(() => import('../pages/referral/ReferralLandingPage'));

// Products & Categories
const ProductPage = lazy(() => import('../pages/products/ProductPage'));
const ProductsPage = lazy(() => import('../pages/products/ProductsPage').then(m => ({ default: m.ProductsPage })));
const CategoriesPage = lazy(() => import('../pages/products/CategoriesPage').then(m => ({ default: m.CategoriesPage })));
const CategoryPage = lazy(() => import('../pages/products/CategoryPage').then(m => ({ default: m.CategoryPage })));
const BrandsPage = lazy(() => import('../pages/brands/BrandsPage').then(m => ({ default: m.BrandsPage })));
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

// Admin
const AdminDashboard = lazy(() => import('../admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));

interface AppRoutesProps {
  isAdminRoute?: boolean;
  onStatsUpdate?: () => void;
  location?: any; // Used for frozen routing animations
}

export const AppRoutes = ({ isAdminRoute = false, onStatsUpdate, location }: AppRoutesProps) => {
  if (isAdminRoute) {
    return (
      <Routes location={location}>
        <Route path={ROUTES.ADMIN} element={<AdminDashboard onStatsUpdate={onStatsUpdate || (() => {})} />} />
      </Routes>
    );
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
      <Route path={ROUTES.TRANSACTION} element={<TransactionProcessingPage />} />
      <Route path={ROUTES.ORDERS} element={<OrdersPage />} />
      
      {/* User */}
      <Route path={ROUTES.PROFILE} element={<ProfilePage />} />
      <Route path={ROUTES.PROFILE_SETTINGS} element={<ProfileSettingsPage />} />
      <Route path={ROUTES.ADDRESSES} element={<AddressesPage />} />
      <Route path={ROUTES.REVIEWS} element={<ReviewsPage />} />
      <Route path={ROUTES.WALLET} element={<WalletPage />} />
      <Route path={ROUTES.WISHLIST} element={<WishlistPage />} />
      <Route path={ROUTES.REFERRALS} element={<ReferralPage />} />
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
