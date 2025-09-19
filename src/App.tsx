import { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { AgeVerification } from './components/AgeVerification';
import Header from './components/Header';
import Hero from './components/Hero';
import { FeaturedProducts } from './components/FeaturedProducts';
import { BrandHeritage } from './components/BrandHeritage';
import { ProductShowcase } from './components/ProductCard';
import { CategoriesGrid } from './components/CategoriesGrid';
import { BlogSection } from './components/BlogSection';
import { BreadcrumbNav } from './components/BreadcrumbNav';
import { PageTransition } from './components/PageTransition';
import Footer from './components/Footer';
import { AuthProvider } from './hooks/useAuth';
import { CartProvider } from './hooks/useCart';
import { WishlistProvider } from './hooks/useWishlist';
import { useAuth } from './hooks/useAuth';
import { supabase } from './utils/supabase/client';

// Lazy load components that are not needed immediately
const CheckoutPage = lazy(() => import('./components/CheckoutPage').then(m => ({ default: m.CheckoutPage })));
const UPIPaymentPage = lazy(() => import('./components/UPIPaymentPage').then(m => ({ default: m.UPIPaymentPage })));
const CartPage = lazy(() => import('./components/CartPage'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const OrdersPage = lazy(() => import('./components/OrdersPage').then(m => ({ default: m.OrdersPage })));
const ProductPage = lazy(() => import('./components/ProductPage').then(m => ({ default: m.ProductPage })));
const CollectionsPage = lazy(() => import('./components/CollectionsPage').then(m => ({ default: m.CollectionsPage })));
const ProductsPage = lazy(() => import('./components/ProductsPage').then(m => ({ default: m.ProductsPage })));
const CategoryPage = lazy(() => import('./components/CategoryPage').then(m => ({ default: m.CategoryPage })));
const LegalPage = lazy(() => import('./components/LegalPage').then(m => ({ default: m.LegalPage })));
const WishlistPage = lazy(() => import('./components/WishlistPage').then(m => ({ default: m.WishlistPage })));
const BlogsPage = lazy(() => import('./components/BlogsPage').then(m => ({ default: m.BlogsPage })));
const BlogPost = lazy(() => import('./components/BlogsPage').then(m => ({ default: m.BlogPost })));
const ContactPage = lazy(() => import('./components/ContactPage').then(m => ({ default: m.ContactPage })));
const AboutPage = lazy(() => import('./components/AboutPage').then(m => ({ default: m.AboutPage })));
const TermsPage = lazy(() => import('./components/TermsPage').then(m => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import('./components/PrivacyPage').then(m => ({ default: m.PrivacyPage })));
const ShippingPage = lazy(() => import('./components/ShippingPage').then(m => ({ default: m.ShippingPage })));

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
      <FeaturedProducts />
      <BrandHeritage />
      <ProductShowcase />
      <CategoriesGrid />
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
        {isUserPage && <Header />}
        {isUserPage && <BreadcrumbNav />}
        <main>
          <Suspense fallback={<LoadingSpinner />}>
            <PageTransition>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/payment" element={<UPIPaymentPage />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/product/:slug" element={<ProductPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/collections" element={<CollectionsPage />} />
                <Route path="/category/:slug" element={<CategoryPage />} />
                <Route path="/category/:category/:brand" element={<CategoryPage />} />
                <Route path="/brand/:slug" element={<CategoryPage />} />
                <Route path="/wishlist" element={<WishlistPage />} />
                <Route path="/blog" element={<BlogsPage />} />
                <Route path="/blog/:slug" element={<BlogPost />} />
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
    </HelmetProvider>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <WishlistProvider>
          <CartProvider>
            <AppContent />
          </CartProvider>
        </WishlistProvider>
      </AuthProvider>
    </Router>
  );
}
