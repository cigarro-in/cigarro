import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ConvexProvider } from 'convex/react';
import { convex } from '../lib/convex/client';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { Callback } from './Callback';
import { SuperGate } from './SuperGate';
import { StoresPage } from './pages/StoresPage';
import { StoreDetailPage } from './pages/StoreDetailPage';
import { PlatformConfigPage } from './pages/PlatformConfigPage';
import { DomainsPage } from './pages/DomainsPage';

// Citadel super-admin app, mounted for admin.<root>/sa/*. No store is injected
// (window.__ORG__ is null) and the page is never indexed.
export function SaApp() {
  useEffect(() => {
    document.title = 'Cigarro super admin';
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    meta.content = 'noindex, nofollow';
  }, []);

  return (
    <ErrorBoundary>
      <ConvexProvider client={convex}>
        <BrowserRouter>
          <Routes>
            <Route path="/sa/callback" element={<Callback />} />
            <Route element={<SuperGate />}>
              <Route path="/sa" element={<Navigate to="/sa/stores" replace />} />
              <Route path="/sa/stores" element={<ErrorBoundary variant="inline"><StoresPage /></ErrorBoundary>} />
              <Route path="/sa/stores/:orgId" element={<ErrorBoundary variant="inline"><StoreDetailPage /></ErrorBoundary>} />
              <Route path="/sa/domains" element={<ErrorBoundary variant="inline"><DomainsPage /></ErrorBoundary>} />
              <Route path="/sa/platform" element={<ErrorBoundary variant="inline"><PlatformConfigPage /></ErrorBoundary>} />
            </Route>
            <Route path="*" element={<Navigate to="/sa/stores" replace />} />
          </Routes>
        </BrowserRouter>
      </ConvexProvider>
    </ErrorBoundary>
  );
}
