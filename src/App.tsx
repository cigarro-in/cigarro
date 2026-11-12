import { readStoredPreference } from './lib/browserStorage';
import { useState, useEffect, useLayoutEffect, Suspense } from 'react';
import { BrowserRouter as Router, useLocation, Navigate } from 'react-router-dom';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { AgeVerification } from './components/auth/AgeVerification';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import Header from './components/layout/Header';
import { MobileLayout } from './components/layout/MobileLayout';
import { BreadcrumbNav } from './components/layout/BreadcrumbNav';
import { PageTransition } from './components/layout/PageTransition';
import Footer from './components/layout/Footer';
import { AuthProvider, useAuth, useAuthDialog } from './hooks/useAuth';
import { PhoneAuthDialog } from './components/auth/PhoneAuthDialog';
import { ConvexAuthProvider } from './lib/convex/ConvexAuthProvider';
import { CartProvider } from './hooks/useCart';
import { WishlistProvider } from './hooks/useWishlist';
import { useStoreSettings } from './hooks/data/useStoreSettings';
import { AppRoutes } from './routes/AppRoutes';
import { ReferralTracker } from './components/referral/ReferralTracker';
import { ConsentBanner } from './components/consent/ConsentBanner';
import { ORG_PRIMARY_HOST } from './lib/convex/org';
import { initAnalytics, getConsent, setConsent, trackEvent, trackPageView } from './lib/analytics/ga';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useOrg } from './lib/convex/useOrg';
import { ORG_SLUG, ADMIN_PATH_STORE, APP_BASENAME } from './lib/convex/org';
import { StorePicker } from './adminnew/StorePicker';
import { ThemeProvider, useTheme } from './themes';

// Phase 3: no toasts anywhere. All success/failure feedback renders inline
// in the owning component via useInlineStatus/<InlineStatus/>. Do NOT
// re-add sonner or toast calls; render the state in place instead.

// Loading component - simplified to null for seamless transitions
// The old page remains visible until the new chunk is ready (thanks to frozen routing)
function LoadingSpinner() {
  return null;
}

// Admin subdomain (admin.cigarro.in): same phone identity as the storefront,
// admin-only UX. No age gate, no shop, noindex so it never enters search.
function AdminHostView() {
  const { user, isLoading, signOut } = useAuth();
  const [loginOpen, setLoginOpen] = useState(true);
  // Admin for THIS storefront org only (user.isAdmin spans every org).
  const scopedProfile = useQuery(
    api.userState.getMyProfile,
    user && ADMIN_PATH_STORE ? { orgSlug: ORG_SLUG } : 'skip',
  );

  // admin.<root>/ with no store in the path: pick a store (or enter one).
  if (ADMIN_PATH_STORE === null) return <StorePicker />;

  if (isLoading) return null;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-creme px-4">
        <div className="text-center space-y-3">
          <p className="font-bold text-lg">Cigarro Admin</p>
          <p className="text-sm text-muted-foreground">Sign in with your admin phone number.</p>
          <button
            onClick={() => setLoginOpen(true)}
            className="h-11 px-6 rounded-xl bg-canyon text-creme font-semibold text-[15px]"
          >
            Sign in
          </button>
        </div>
        <PhoneAuthDialog open={loginOpen} onOpenChange={setLoginOpen} />
      </div>
    );
  }

  if (scopedProfile === undefined) return null;

  if (!scopedProfile.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-creme px-4">
        <div className="text-center space-y-3 max-w-sm">
          <p className="font-bold text-lg">Access denied</p>
          <p className="text-sm text-muted-foreground">
            {user.phone || 'This number'} isn't an admin account. Use it on {ORG_PRIMARY_HOST} for shopping.
          </p>
          <div className="flex gap-2 justify-center">
            <a
              href={`https://${ORG_PRIMARY_HOST}`}
              className="h-11 px-6 inline-flex items-center rounded-xl bg-canyon text-creme font-semibold text-[15px]"
            >
              Go to store
            </a>
            <button
              onClick={() => void signOut()}
              className="h-11 px-6 rounded-xl border font-semibold text-[15px]"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <HelmetProvider>
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
        <title>Cigarro Admin</title>
      </Helmet>
      <Suspense fallback={<LoadingSpinner />}>
        <AppRoutes isAdminRoute={true} />
      </Suspense>
    </HelmetProvider>
  );
}

// Single global auth-dialog host: the only PhoneAuthDialog mounted on the
// storefront across desktop/mobile. Header, MobileBottomNav, and theme shells
// open it via useAuthDialog().requestAuth() instead of mounting their own.
// Wrapped in an inline boundary so a recoverable auth failure never shows
// the generic global crash screen. (AdminHostView keeps its own dialog — it
// renders on a separate host branch and is never co-mounted.)
function StorefrontAuthHost() {
  const { open, onSuccess, closeAuthDialog } = useAuthDialog();
  return (
    <ErrorBoundary variant="inline">
      <PhoneAuthDialog
        open={open}
        onOpenChange={(o) => {
          if (!o) closeAuthDialog();
        }}
        onAuthSuccess={onSuccess}
      />
    </ErrorBoundary>
  );
}

function AppContent() {  const { user } = useAuth();
  const { theme } = useTheme();
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
    return readStoredPreference('ageVerified') === 'true';
  });

  // Per-store settings from Convex, defaults filled in (was Supabase).
  const { settings: store, loading: settingsLoading } = useStoreSettings();
  const gateActive = store.ageGate.enabled;
  // A store with the age gate switched off never shows it.
  const gatePassed = !gateActive || isAgeVerified;

  // Analytics: load gtag once (consent-denied by default; no collection
  // until the visitor accepts the banner).
  useEffect(() => {
    if (settingsLoading) return;
    initAnalytics(store.seo.gaMeasurementId);
  }, [settingsLoading, store.seo.gaMeasurementId]);

  const isAdminHost =
    typeof window !== 'undefined' && window.location.hostname.split('.')[0] === 'admin';
  const isAdminPath = location.pathname.startsWith('/admin');

  // SPA page views: only after the age gate. Admin routes are included so the
  // owner's own visits show up in GA4 Realtime; exclude that noise with an
  // IP-based internal-traffic filter in GA4 Admin > Data Settings (recommended),
  // not by dropping hits here.
  useEffect(() => {
    if (!gatePassed) return;
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search, gatePassed]);

  // Storefront host: /admin* never existed — homepage, no subdomain redirect.
  // (Admin lives only on admin.cigarro.in; same phone number = storefront here.)
  if (!isAdminHost && isAdminPath) {
    return <Navigate to="/" replace />;
  }

  // Admin host: phone-gated, admin-only. Same Supabase identity as the
  // storefront (same number), but non-admins stop at a deny message.
  if (isAdminHost) {
    return <AdminHostView />;
  }

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
  const [legacyConsentNeeded, setLegacyConsentNeeded] = useState(
    () => readStoredPreference('ageVerified') === 'true' && getConsent() === null
  );
  // Gate switched off for this store: there is no entry moment, so offer the banner.
  useEffect(() => {
    if (!gateActive && getConsent() === null) setLegacyConsentNeeded(true);
  }, [gateActive]);

  // Apply before paint: storefront top padding must not shift the admin host.
  useLayoutEffect(() => {
    if (isAdminHost || isAdminPath) {
      document.body.classList.add('admin-page');
    } else {
      document.body.classList.remove('admin-page');
    }
  }, [isAdminHost, isAdminPath]);

  if (!gatePassed) {
    const ThemedAgeGate = theme.slots.AgeVerification;
    if (ThemedAgeGate) {
      return (
        <Suspense fallback={null}>
          <ThemedAgeGate onVerify={handleAgeVerified} ageGate={store.ageGate} siteName={store.name} />
        </Suspense>
      );
    }
    return <AgeVerification onVerify={handleAgeVerified} ageGate={store.ageGate} siteName={store.name} />;
  }

  return (
    <HelmetProvider>
      <ReferralTracker />
      <StorefrontAuthHost />
      {/* Consent banner must render on admin routes too: admins are
          auto-redirected to /admin, so gating on isUserPage left them
          consent-denied forever and their visits never reached GA. */}
      {legacyConsentNeeded && <ConsentBanner />}
      <Helmet>
        <title>{store.metaTitle}</title>
        <meta name="description" content={store.metaDescription} />
        
        {/* Favicon: the store's own when set, else the static icons from /icons/ */}
        {store.brand.faviconUrl ? (
          <link rel="icon" href={store.brand.faviconUrl} />
        ) : (
          <>
            <link rel="icon" type="image/x-icon" href="/icons/favicon.ico" />
            <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
          </>
        )}
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </Helmet>
{isUserPage ? (
        ThemeLayout ? (
          <Suspense fallback={<LoadingSpinner />}>
            <ThemeLayout storeName={store.name} logoUrl={store.brand.logoUrl} legalName={store.business.legalName || store.name}>
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
      <Router basename={APP_BASENAME || undefined}>
        <AuthProvider>
          <ConvexAuthProvider>
            <WishlistProvider>
              <CartProvider>
                <ThemeProvider>
                  <AppContent />
                </ThemeProvider>
              </CartProvider>
            </WishlistProvider>
          </ConvexAuthProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}
