import { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { AgeVerification } from '../components/auth/AgeVerification';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import Header from '../components/layout/Header';
import { MobileLayout } from '../components/layout/MobileLayout';
import Hero from '../pages/home/Hero';
import { FeaturedProducts } from '../pages/home/FeaturedProducts';
import { CategoriesScroller } from '../pages/home/CategoriesScroller';
import { BrandsScroller } from '../pages/home/BrandsScroller';
import { CategoryShowcases } from '../pages/home/CategoryShowcases';
import { BrandHeritage } from '../pages/company/BrandHeritage';
import { ProductShowcase } from '../components/products/ProductShowcase';
import { CategoriesGrid } from '../pages/content/CategoriesGrid';
import { BlogSection } from '../pages/content/BlogSection';
import { BreadcrumbNav } from '../components/layout/BreadcrumbNav';
import { PageTransition } from '../components/layout/PageTransition';
import Footer from '../components/layout/Footer';
import { AuthProvider } from '../hooks/useAuth';
import { CartProvider } from '../hooks/useCart';
import { WishlistProvider } from '../hooks/useWishlist';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../utils/supabase/client';
// Lazy load components that are not needed immediately
const CheckoutPage = lazy(() => import('../pages/cart/CheckoutPage').then(m => ({ default: m.CheckoutPage })));
const MobileCheckoutPage = lazy(() => import('../pages/cart/MobileCheckoutPage').then(m => ({ default: m.MobileCheckoutPage })));
const UPIPaymentPage = lazy(() => import('../pages/cart/UPIPaymentPage').then(m => ({ default: m.UPIPaymentPage })));
const OrderSuccessPage = lazy(() => import('../pages/order/OrderSuccessPage').then(m => ({ default: m.OrderSuccessPage })));
const CartPage = lazy(() => import('../pages/cart/CartPage'));
const AdminDashboard = lazy(() => import('../admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const OrdersPage = lazy(() => import('../pages/user/OrdersPage').then(m => ({ default: m.OrdersPage })));
const ProfilePage = lazy(() => import('../pages/user/ProfilePage').then(m => ({ default: m.ProfilePage })));
const ProductPage = lazy(() => import('../pages/products/ProductPage'));
const CollectionsPage = lazy(() => import('../pages/products/CollectionsPage').then(m => ({ default: m.CollectionsPage })));
const ProductsPage = lazy(() => import('../pages/products/ProductsPage').then(m => ({ default: m.ProductsPage })));
const CategoryPage = lazy(() => import('../pages/products/CategoryPage').then(m => ({ default: m.CategoryPage })));
const LegalPage = lazy(() => import('../pages/legal/LegalPage').then(m => ({ default: m.LegalPage })));
const WishlistPage = lazy(() => import('../pages/user/WishlistPage').then(m => ({ default: m.WishlistPage })));
const BlogsPage = lazy(() => import('../pages/content/BlogsPage').then(m => ({ default: m.BlogsPage })));
const BlogPost = lazy(() => import('../pages/content/BlogsPage').then(m => ({ default: m.BlogPost })));
const ContactPage = lazy(() => import('../pages/company/ContactPage').then(m => ({ default: m.ContactPage })));
const AboutPage = lazy(() => import('../pages/company/AboutPage').then(m => ({ default: m.AboutPage })));
const TermsPage = lazy(() => import('../pages/legal/TermsPage').then(m => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import('../pages/legal/PrivacyPage').then(m => ({ default: m.PrivacyPage })));
const ShippingPage = lazy(() => import('../pages/legal/ShippingPage').then(m => ({ default: m.ShippingPage })));
const BrandsPage = lazy(() => import('../pages/brands/BrandsPage').then(m => ({ default: m.BrandsPage })));
const BrandPage = lazy(() => import('../pages/brands/BrandPage').then(m => ({ default: m.BrandPage })));

// Loading component for better UX during transitions
function LoadingSpinner() {
  return (
    <div className="main-container section">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-dark"></div>
        <p className="text-dark mt-4">Loading...</p>
      </div>
    </div>
  );
}

function HomePage() {
  return (
    <>
      <Hero />
      
      {/* Mobile: Categories Scroller, Desktop: Skip to Featured */}
      <div className="md:hidden">
        <CategoriesScroller />
      </div>
      
      <div className="h-0 md:h-12"></div>
      <FeaturedProducts />
      
      {/* Mobile: Brands Scroller */}
      <div className="md:hidden">
        <BrandsScroller />
      </div>
      
      {/* Mobile: Category Showcases with Products */}
      <div className="md:hidden">
        <CategoryShowcases />
      </div>
      
      {/* <div className="h-8 md:h-12"></div>
      <BrandHeritage />
      <div className="h-8 md:h-12"></div> */}
      <ProductShowcase />
      <div className="h-8 md:h-12"></div>
      
      {/* Desktop: Full Categories Grid */}
      <div className="hidden md:block">
        <CategoriesGrid />
      </div>
      
      <div className="h-8 md:h-12"></div>
      <BlogSection />
    </>
  );
}

function AppContent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [siteSettings, setSiteSettings] = useState({
    meta_title: 'Cigarro',
    meta_description: 'The finest selection of premium cigarettes, cigars, and vapes.',
    favicon_url: '/vite.svg',
    site_name: 'Cigarro',
  });

  useEffect(() => {
    const fetchSiteSettings = async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .single();
      if (data) {
        setSiteSettings({
          meta_title: data.meta_title || 'Cigarro',
          meta_description: data.meta_description || 'The finest selection of premium cigarettes, cigars, and vapes.',
          favicon_url: data.favicon_url || '/vite.svg',
          site_name: data.site_name || 'Cigarro',
        });
      }
    };
    fetchSiteSettings();
  }, []);

  useEffect(() => {
    if (user?.isAdmin) {
      navigate('/admin');
    }
  }, [user, navigate]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const isUserPage = !location.pathname.startsWith('/admin');

  if (!isAgeVerified) {
    return <AgeVerification onVerify={() => setIsAgeVerified(true)} />;
  }

  return (
    <HelmetProvider>
      <Helmet>
        <title>{siteSettings.meta_title || 'Cigarro'}</title>
        <meta name="description" content={siteSettings.meta_description || 'Premium tobacco products'} />
        <link rel="icon" type="image/svg+xml" href={siteSettings.favicon_url || '/vite.svg'} />
      </Helmet>
      <div className="min-h-screen bg-creme font-sans">
        {/* Desktop Layout */}
        <div className="hidden md:block">
          {isUserPage && <Header />}
          {isUserPage && <BreadcrumbNav />}
          <main>
            <Suspense fallback={<LoadingSpinner />}>
              <PageTransition>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/cart" element={<CartPage />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/mobile-checkout" element={<MobileCheckoutPage />} />
                  <Route path="/payment" element={<UPIPaymentPage />} />
                  <Route path="/order-success" element={<OrderSuccessPage />} />
                  <Route path="/admin/*" element={<AdminDashboard onStatsUpdate={() => {}} />} />
                  <Route path="/orders" element={<OrdersPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/product/:slug" element={<ProductPage />} />
                  <Route path="/products" element={<ProductsPage />} />
                  <Route path="/collections" element={<CollectionsPage />} />
                  <Route path="/category/:slug" element={<CategoryPage />} />
                  <Route path="/category/:category/:brand" element={<CategoryPage />} />
                  <Route path="/brand/:slug" element={<CategoryPage />} />
                  <Route path="/wishlist" element={<WishlistPage />} />
                  <Route path="/blog" element={<BlogsPage />} />
                  <Route path="/blog/:slug" element={<BlogPost />} />
                  <Route path="/brands" element={<BrandsPage />} />
                  <Route path="/brands/:slug" element={<BrandPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/shipping" element={<ShippingPage />} />
                  {/* Catch-all route for broken links */}
                  <Route path="*" element={<HomePage />} />
                </Routes>
              </PageTransition>
            </Suspense>
          </main>
          {isUserPage && <Footer />}
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden">
          {isUserPage ? (
            <MobileLayout>
              <Suspense fallback={<LoadingSpinner />}>
                <PageTransition>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/cart" element={<CartPage />} />
                    <Route path="/checkout" element={<MobileCheckoutPage />} />
                    <Route path="/mobile-checkout" element={<MobileCheckoutPage />} />
                    <Route path="/payment" element={<UPIPaymentPage />} />
                    <Route path="/order-success" element={<OrderSuccessPage />} />
                    <Route path="/orders" element={<OrdersPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/product/:slug" element={<ProductPage />} />
                    <Route path="/products" element={<ProductsPage />} />
                    <Route path="/collections" element={<CollectionsPage />} />
                    <Route path="/category/:slug" element={<CategoryPage />} />
                    <Route path="/category/:category/:brand" element={<CategoryPage />} />
                    <Route path="/brand/:slug" element={<CategoryPage />} />
                    <Route path="/wishlist" element={<WishlistPage />} />
                    <Route path="/blog" element={<BlogsPage />} />
                    <Route path="/blog/:slug" element={<BlogPost />} />
                    <Route path="/brands" element={<BrandsPage />} />
                    <Route path="/brands/:slug" element={<BrandPage />} />
                    <Route path="/contact" element={<ContactPage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/privacy" element={<PrivacyPage />} />
                    <Route path="/terms" element={<TermsPage />} />
                    <Route path="/shipping" element={<ShippingPage />} />
                    {/* Catch-all route for broken links */}
                    <Route path="*" element={<HomePage />} />
                  </Routes>
                </PageTransition>
              </Suspense>
            </MobileLayout>
          ) : (
            <main>
              <Suspense fallback={<LoadingSpinner />}>
                <PageTransition>
                  <Routes>
                    <Route path="/admin/*" element={<AdminDashboard onStatsUpdate={() => {}} />} />
                  </Routes>
                </PageTransition>
              </Suspense>
            </main>
          )}
        </div>
      </div>
    </HelmetProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <WishlistProvider>
            <CartProvider>
              <AppContent />
            </CartProvider>
          </WishlistProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}
