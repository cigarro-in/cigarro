import { readStoredPreference, writeStoredPreference } from './lib/browserStorage';
import { useState, useEffect, useLayoutEffect, useRef, Suspense, startTransition, lazy } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { Helmet, HelmetProvider, type HelmetServerState } from 'react-helmet-async';
import { AgeVerification, AgeGateOverlay } from './components/auth/AgeVerification';
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
import { initAnalytics, getConsent, setConsent, trackEvent, trackPageView } from './lib/analytics/ga';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useOrg } from './lib/convex/useOrg';
import { useOrgInfo } from './lib/org/OrgContext';
import { ThemeProvider, useTheme } from './themes';

// Phase 3: no toasts anywhere. All success/failure feedback renders inline
// in the owning component via useInlineStatus/<InlineStatus/>. Do NOT
// re-add sonner or toast calls; render the state in place instead.

// App renders routes assuming a Router context exists. The router is supplied
// by the entry (src/main.tsx for the client; a future server entry wraps the
// same App in StaticRouter), so App never creates one itself.

// Admin host (admin.<root>) and super-admin (/sa) are separate bundles with
// their own styling (src/adminnew/styles/admin.css). They never wear a store theme.
const AdminApp = lazy(() => import('./adminnew/AdminApp'));
const SaApp = lazy(() => import('./sa/SaApp').then((m) => ({ default: m.SaApp })));

// Loading component - simplified to null for seamless transitions
// The old page remains visible until the new chunk is ready (thanks to frozen routing)
function LoadingSpinner() {
  return null;
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

/** Server render collects Helmet tags here (set by the SSR entry; absent on the client). */
export interface HelmetServerContext {
  helmet?: HelmetServerState;
}

interface AppContentProps {
  helmetContext?: HelmetServerContext;
}

function AppContent({ helmetContext }: AppContentProps) {
  const info = useOrgInfo();
  const { user } = useAuth();
  const { theme } = useTheme();
  const location = useLocation();
  const ThemeLayout = theme.slots.Layout;
  const org = useOrg();
  const upsertConvexUser = useMutation(api.userState.upsertUser);
  const isAdminHost = info.isAdminHost;

  // Phase 1: maintain the Convex user spine (lazy backfill — creates the row
  // on first seen session; isAdmin stays on Supabase profiles until Phase 2).
  useEffect(() => {
    if (!user || !org || isAdminHost) return;
    const args: { orgId: typeof org._id; phone?: string; name?: string } = { orgId: org._id };
    if (user.phone) args.phone = user.phone;
    if (user.name) args.name = user.name;
    upsertConvexUser(args).catch(() => {});
  }, [user?.id, org?._id]);

  // Age gate state. `undefined` = not read yet. This is the SAME value on the
  // server render and the first client render (hydration must match), even for
  // returning verified visitors: the overlay is always in the first render, and
  // the index.html inline script + CSS (html[data-ageok]) hide it before paint.
  // Storage is read in an effect, never in render, then the effect settles it.
  const [ageVerified, setAgeVerified] = useState<boolean | undefined>(undefined);
  const [legacyConsentNeeded, setLegacyConsentNeeded] = useState(false);
  const appRootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Verified if either store (localStorage or the one-year cookie) says so.
    // The other store is then filled in, so both stay in step.
    const inStorage = readStoredPreference('ageVerified') === 'true';
    const inCookie = /(?:^|;\s*)ageVerified=true(?:;|$)/.test(document.cookie);
    const verified = inStorage || inCookie;
    if (verified && !inStorage) writeStoredPreference('ageVerified', 'true');
    if (verified && !inCookie) {
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `ageVerified=true; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax${secure}`;
    }
    // startTransition: this effect runs right after hydration starts. A plain
    // update here would reach Suspense boundaries that are still dehydrated
    // (React #421). A transition lets hydration finish first.
    startTransition(() => {
      setAgeVerified(verified);
      // Already-verified visitors never see the gate again: offer them the
      // one-time banner instead so analytics is never silently enabled.
      if (verified && getConsent() === null) setLegacyConsentNeeded(true);
    });
  }, []);

  // Per-store settings from Convex, defaults filled in (was Supabase).
  const { settings: store, loading: settingsLoading } = useStoreSettings();
  const gateActive = store.ageGate.enabled;
  // A store with the age gate switched off never shows it.
  const gatePassed = !gateActive || ageVerified === true;
  const showGate = !gatePassed;

  // Overlay open => app content is inert (not focusable, hidden from AT).
  useLayoutEffect(() => {
    appRootRef.current?.toggleAttribute('inert', showGate);
  }, [showGate]);

  // Analytics: load gtag once (consent-denied by default; no collection
  // until the visitor accepts the banner).
  useEffect(() => {
    if (settingsLoading) return;
    initAnalytics(store.seo.gaMeasurementId);
  }, [settingsLoading, store.seo.gaMeasurementId]);

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

  // Manual scroll restoration is now handled by SmoothScrollToTop inside PageTransition
  const isUserPage = !isAdminPath;

  const handleAgeVerified = () => {
    setAgeVerified(true);
    // Entering through the gate is the consent moment (stated on the gate).
    setConsent('granted');
    trackEvent('age_gate_completed');
  };

  // Gate switched off for this store: there is no entry moment, so offer the banner.
  useEffect(() => {
    if (!gateActive && getConsent() === null) startTransition(() => setLegacyConsentNeeded(true));
  }, [gateActive]);

  // Apply before paint: storefront top padding must not shift the admin host.
  useLayoutEffect(() => {
    if (isAdminPath) {
      document.body.classList.add('admin-page');
    } else {
      document.body.classList.remove('admin-page');
    }
  }, [isAdminPath]);

  const ThemedAgeGate = theme.slots.AgeVerification;
  const gateContent = ThemedAgeGate ? (
    <Suspense fallback={null}>
      <ThemedAgeGate onVerify={handleAgeVerified} ageGate={store.ageGate} siteName={store.name} />
    </Suspense>
  ) : (
    <AgeVerification onVerify={handleAgeVerified} ageGate={store.ageGate} siteName={store.name} />
  );

  return (
    <HelmetProvider context={helmetContext}>
      <ReferralTracker />
      <StorefrontAuthHost />
      {/* Consent banner must render on admin routes too: admins are
          auto-redirected to /admin, so gating on isUserPage left them
          consent-denied forever and their visits never reached GA. */}
      {legacyConsentNeeded && <ConsentBanner />}
      <Helmet>
        <title>{store.metaTitle}</title>
        <meta name="description" content={store.metaDescription} />

        {/* Icons are not set here: the edge injects the store's own favicon and
            apple-touch icon, and client-side tags would override them. */}
      </Helmet>
        <div ref={appRootRef}>
{isUserPage ? (
        ThemeLayout ? (
          <Suspense fallback={<LoadingSpinner />}>
            <ThemeLayout storeName={store.name} logoUrl={store.brand.logoUrl} brandColor={store.brand.brandColor} legalName={store.business.legalName || store.name}>
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
        </div>
      {showGate && (
        // The wrapper carries .age-gate-overlay so the index.html CSS rule
        // (html[data-ageok] .age-gate-overlay) hides server-rendered markup.
        <div className="age-gate-overlay">
          <AgeGateOverlay label={`Age verification for ${store.name}`}>{gateContent}</AgeGateOverlay>
        </div>
      )}
    </HelmetProvider>
  );
}

export interface AppProps {
  /** Theme chosen by the server render (SSR only). Client omits it. */
  initialThemeId?: string;
  /** Helmet collection context for the server render; the client omits it. */
  helmetContext?: HelmetServerContext;
}

export default function App({ initialThemeId, helmetContext }: AppProps = {}) {
  const info = useOrgInfo();
  // Citadel super-admin app (admin host /sa/*): no store, no storefront providers.
  // SaApp brings its own router, so this branch must not be wrapped by the entry's router.
  if (info.isSa) {
    return (
      <Suspense fallback={null}>
        <SaApp />
      </Suspense>
    );
  }
  if (info.isAdminHost) {
    // Same auth/data providers as the storefront; the theme provider only
    // backs the Settings theme picker and never touches <html data-theme>.
    return (
      <ErrorBoundary>
        <AuthProvider>
          <ConvexAuthProvider>
            <WishlistProvider>
              <CartProvider>
                <ThemeProvider applyToDocument={false}>
                  <Suspense fallback={null}>
                    <AdminApp />
                  </Suspense>
                </ThemeProvider>
              </CartProvider>
            </WishlistProvider>
          </ConvexAuthProvider>
        </AuthProvider>
      </ErrorBoundary>
    );
  }
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ConvexAuthProvider>
          <WishlistProvider>
            <CartProvider>
              <ThemeProvider initialThemeId={initialThemeId}>
                <AppContent helmetContext={helmetContext} />
              </ThemeProvider>
            </CartProvider>
          </WishlistProvider>
        </ConvexAuthProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
