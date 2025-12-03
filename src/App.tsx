import { useState, useEffect, Suspense } from 'react';
import { BrowserRouter as Router, useNavigate, useLocation } from 'react-router-dom';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { AgeVerification } from './components/auth/AgeVerification';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import Header from './components/layout/Header';
import { MobileLayout } from './components/layout/MobileLayout';
import { BreadcrumbNav } from './components/layout/BreadcrumbNav';
import { PageTransition } from './components/layout/PageTransition';
import Footer from './components/layout/Footer';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { CartProvider } from './hooks/useCart';
import { WishlistProvider } from './hooks/useWishlist';
import { supabase } from './lib/supabase/client';
import { AppRoutes } from './routes/AppRoutes';
import { ReferralTracker } from './components/referral/ReferralTracker';

// Loading component - simplified to null for seamless transitions
// The old page remains visible until the new chunk is ready (thanks to frozen routing)
function LoadingSpinner() {
  return null;
}

function AppContent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check localStorage immediately to prevent flash of age verification
  const [isAgeVerified, setIsAgeVerified] = useState(() => {
    return localStorage.getItem('ageVerified') === 'true';
  });

  const [siteSettings, setSiteSettings] = useState({
    meta_title: 'Cigarro',
    meta_description: 'The finest selection of premium cigarettes and cigars.',
    site_name: 'Cigarro',
  });

  useEffect(() => {
    const fetchSiteSettings = async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('meta_title, meta_description, site_name')
        .single();
      if (data) {
        setSiteSettings({
          meta_title: data.meta_title || 'Cigarro',
          meta_description: data.meta_description || 'The finest selection of premium cigarettes and cigars.',
          site_name: data.site_name || 'Cigarro',
        });
      }
    };
    fetchSiteSettings();
  }, []);

  const isAdminPath = location.pathname.startsWith('/admin');

  useEffect(() => {
    // Only redirect admins to /admin when they are not already inside the admin area
    if (user?.isAdmin && !isAdminPath) {
      navigate('/admin');
    }
  }, [user, navigate, isAdminPath]);

  // Manual scroll restoration is now handled by SmoothScrollToTop inside PageTransition
  const isUserPage = !isAdminPath;

  // Add/remove admin-page class to body for conditional styling
  useEffect(() => {
    if (isAdminPath) {
      document.body.classList.add('admin-page');
    } else {
      document.body.classList.remove('admin-page');
    }
  }, [isAdminPath]);

  if (!isAgeVerified) {
    return <AgeVerification onVerify={() => setIsAgeVerified(true)} />;
  }

  return (
    <HelmetProvider>
      <ReferralTracker />
      <Helmet>
        <title>{siteSettings.meta_title || 'Cigarro'}</title>
        <meta name="description" content={siteSettings.meta_description || 'Premium tobacco products'} />
        
        {/* Static Favicon - Uses icons from /icons/ folder */}
        <link rel="icon" type="image/x-icon" href="/icons/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </Helmet>
{isUserPage ? (
        <div className="min-h-screen bg-creme font-sans">
          {/* Desktop Layout - User Pages */}
          <div className="hidden md:block">
            <Header />
            <BreadcrumbNav />
            <main>
              <PageTransition>
                <Suspense fallback={<LoadingSpinner />}>
                  <AppRoutes isAdminRoute={false} location={location} />
                </Suspense>
              </PageTransition>
            </main>
            <Footer />
          </div>

          {/* Mobile Layout - User Pages */}
          <div className="md:hidden">
            <MobileLayout>
              <PageTransition>
                <Suspense fallback={<LoadingSpinner />}>
                  <AppRoutes isAdminRoute={false} location={location} />
                </Suspense>
              </PageTransition>
            </MobileLayout>
          </div>
        </div>
      ) : (
        /* Admin Layout - No wrapper div, no padding/margin */
        <Suspense fallback={<LoadingSpinner />}>
          <AppRoutes isAdminRoute={true} />
        </Suspense>
      )}
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
