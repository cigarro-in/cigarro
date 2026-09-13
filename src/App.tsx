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
import { ConvexSupabaseProvider } from './lib/convex/ConvexSupabaseProvider';
import { CartProvider } from './hooks/useCart';
import { WishlistProvider } from './hooks/useWishlist';
import { useSiteSettings } from './hooks/data/useContent';
import { AppRoutes } from './routes/AppRoutes';
import { ReferralTracker } from './components/referral/ReferralTracker';
import { ConsentBanner } from './components/consent/ConsentBanner';
import { initAnalytics, getConsent, setConsent, trackEvent, trackPageView } from './lib/analytics/ga';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useOrg } from './lib/convex/useOrg';
import { ThemeProvider, useTheme } from './themes';

// Loading component - simplified to null for seamless transitions
// The old page remains visible until the new chunk is ready (thanks to frozen routing)
function LoadingSpinner() {
  return null;
}

function AppContent() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const ThemeLayout = theme.slots.Layout;
  const org = useOrg();
  const upsertConvexUser = useMutation(api.userState.upsertUser);

  // Phase 1: maintain the Convex user spine (lazy backfill — creates the row
  // on first seen session; isAdmin stays on Supabase profiles until Phase 2).
  useEffect(() => {
    if (!user || !org) return;
    const args: { orgId: typeof org._id; phone?: string; name?: string } = { orgId: org._id };
    if (user.phone) args.phone = user.phone;
    if (user.name) args.name = user.name;
    upsertConvexUser(args).catch(() => {});
  }, [user?.id, org?._id]);
  
  // Check localStorage immediately to prevent flash of age verification
  const [isAgeVerified, setIsAgeVerified] = useState(() => {
    return localStorage.getItem('ageVerified') === 'true';
  });

  const [siteSettings, setSiteSettings] = useState({
    meta_title: 'Cigarro',
    meta_description: 'The finest selection of premium cigarettes and cigars.',
    site_name: 'Cigarro',
  });
  // Wave 2: meta/site settings come from Convex (was Supabase).
  const { settings: convexSettings } = useSiteSettings();

  // Analytics: load gtag once (consent-denied by default; no collection
  // until the visitor accepts the banner).
  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (!convexSettings) return;
    setSiteSettings({
      meta_title: convexSettings.meta_title || 'Cigarro',
      meta_description: convexSettings.meta_description || 'The finest selection of premium cigarettes and cigars.',
      site_name: convexSettings.site_name || 'Cigarro',
    });
  }, [convexSettings]);

  const isAdminPath = location.pathname.startsWith('/admin');

  // SPA page views: only after the age gate. Admin routes are included so the
  // owner's own visits show up in GA4 Realtime; exclude that noise with an
  // IP-based internal-traffic filter in GA4 Admin > Data Settings (recommended),
  // not by dropping hits here.
  useEffect(() => {
    if (!isAgeVerified) return;
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search, isAgeVerified]);

  useEffect(() => {
    // Only redirect admins to /admin when they are not already inside the admin area
    if (user?.isAdmin && !isAdminPath) {
      navigate('/admin');
    }
  }, [user, navigate, isAdminPath]);

  // Manual scroll restoration is now handled by SmoothScrollToTop inside PageTransition
  const isUserPage = !isAdminPath;

  const handleAgeVerified = () => {
    setIsAgeVerified(true);
    // Entering through the gate is the consent moment (stated on the gate).
    setConsent('granted');
    trackEvent('age_gate_completed');
  };

  // Already-verified visitors never see the gate again: offer them the
  // one-time banner instead so analytics is never silently enabled.
  const [legacyConsentNeeded] = useState(
    () => localStorage.getItem('ageVerified') === 'true' && getConsent() === null
  );

  // Add/remove admin-page class to body for conditional styling
  useEffect(() => {
    if (isAdminPath) {
      document.body.classList.add('admin-page');
    } else {
      document.body.classList.remove('admin-page');
    }
  }, [isAdminPath]);

  if (!isAgeVerified) {
    const ThemedAgeGate = theme.slots.AgeVerification;
    if (ThemedAgeGate) {
      return (
        <Suspense fallback={null}>
          <ThemedAgeGate onVerify={handleAgeVerified} />
        </Suspense>
      );
    }
    return <AgeVerification onVerify={handleAgeVerified} />;
  }

  return (
    <HelmetProvider>
      <ReferralTracker />
      {/* Consent banner must render on admin routes too: admins are
          auto-redirected to /admin, so gating on isUserPage left them
          consent-denied forever and their visits never reached GA. */}
      {legacyConsentNeeded && <ConsentBanner />}
      <Helmet>
        <title>{siteSettings.meta_title || 'Cigarro'}</title>
        <meta name="description" content={siteSettings.meta_description || 'Premium tobacco products'} />
        
        {/* Static Favicon - Uses icons from /icons/ folder */}
        <link rel="icon" type="image/x-icon" href="/icons/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </Helmet>
{isUserPage ? (
        ThemeLayout ? (
          <Suspense fallback={<LoadingSpinner />}>
            <ThemeLayout>
              <PageTransition>
                <Suspense fallback={<LoadingSpinner />}>
                  <AppRoutes isAdminRoute={false} location={location} />
                </Suspense>
              </PageTransition>
            </ThemeLayout>
          </Suspense>
        ) : (
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
        )
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
          <ConvexSupabaseProvider>
            <WishlistProvider>
              <CartProvider>
                <ThemeProvider>
                  <AppContent />
                </ThemeProvider>
              </CartProvider>
            </WishlistProvider>
          </ConvexSupabaseProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}
