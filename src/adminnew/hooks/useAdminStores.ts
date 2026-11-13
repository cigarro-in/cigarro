import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../hooks/useAuth';

export interface AdminStore {
  slug: string;
  name: string;
}

// Stores the signed-in phone administers (owner or admin), across every store
// that phone has a user row in. Empty while signed out. Used by the store menu
// and the dashboard card. Admin-host tokens only (the server returns [] otherwise).
export function useAdminStores(): { stores: AdminStore[]; loading: boolean } {
  const { user } = useAuth();
  const memberships = useQuery(api.organizations.listMyAdminStores, user ? {} : 'skip');

  return useMemo(() => {
    if (!user) return { stores: [], loading: false };
    if (memberships === undefined) return { stores: [], loading: true };
    return { stores: memberships.map((m) => ({ slug: m.slug, name: m.name })), loading: false };
  }, [user, memberships]);
}
