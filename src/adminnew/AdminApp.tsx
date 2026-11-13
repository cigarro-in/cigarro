import { Suspense } from 'react';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../hooks/useAuth';
import { useOrgInfo } from '../lib/org/OrgContext';
import { AppRoutes } from '../routes/AppRoutes';
import { AdminRoot } from './AdminRoot';
import { AdminLogin } from './AdminLogin';
import { StorePicker } from './StorePicker';
import { Button } from './ui';

/**
 * Admin host (admin.<root>): phone-gated, admin-only. Same phone identity as
 * the storefront, but non-admins stop at a deny message. Lazy-loaded from
 * App.tsx so the admin CSS and code never ship with the storefront.
 */
export default function AdminApp() {
  return (
    <AdminRoot>
      <HelmetProvider>
        <Helmet>
          <meta name="robots" content="noindex, nofollow" />
          <title>Cigarro Admin</title>
        </Helmet>
        <AdminHostView />
      </HelmetProvider>
    </AdminRoot>
  );
}

function AdminHostView() {
  const info = useOrgInfo();
  const { user, isLoading, signOut } = useAuth();
  // Store named in the admin path (admin.<root>/<store>/...), null when absent.
  const adminPathStore = info.basename ? info.basename.slice(1) : null;
  // Admin for THIS store only (user.isAdmin spans every org).
  const scopedProfile = useQuery(
    api.userState.getMyProfile,
    user && adminPathStore ? { orgSlug: info.slug } : 'skip',
  );

  // admin.<root>/ with no store in the path: sign in, then open a store.
  if (adminPathStore === null) return <StorePicker />;

  if (isLoading) return null;

  if (!user) return <AdminLogin />;

  if (scopedProfile === undefined) return null;

  if (!scopedProfile?.isAdmin) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center bg-[var(--admin-bg)] px-4 pt-[12vh]">
        <p className="mb-6 text-lg font-semibold tracking-[-0.02em]">Cigarro</p>
        <div className="w-full max-w-[380px] rounded-[12px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 sm:p-7">
          <h1 className="text-xl font-semibold">No admin access</h1>
          <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
            {user.phone || 'This number'} is not an admin of this store. Use it on {info.primaryHost} for shopping.
          </p>
          <div className="mt-5 flex gap-2">
            <Button asChild variant="primary">
              <a href={`https://${info.primaryHost}`}>Go to store</a>
            </Button>
            <Button variant="secondary" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
      <AppRoutes isAdminRoute={true} />
    </Suspense>
  );
}
