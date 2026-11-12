import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../hooks/useAuth';

export interface AdminStore {
  slug: string;
  name: string;
}

// Stores the signed-in user administers (admin or owner membership).
// Empty while signed out. Used by the store picker and the sidebar switcher.
export function useAdminStores(): { stores: AdminStore[]; loading: boolean } {
  const { user } = useAuth();
  const memberships = useQuery(api.organizations.listMine, user ? {} : 'skip');

  return useMemo(() => {
    if (!user) return { stores: [], loading: false };
    if (memberships === undefined) return { stores: [], loading: true };
    const stores = memberships
      .filter((m) => m.role === 'admin' || m.role === 'owner')
      .map((m) => ({ slug: m.org.slug, name: m.org.name }));
    return { stores, loading: false };
  }, [user, memberships]);
}
