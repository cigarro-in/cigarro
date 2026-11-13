import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';

export type StoreRole = 'owner' | 'admin' | 'staff' | 'customer' | string;

/** Signed-in admin's own profile in one store. Live: a rename shows at once. */
export function useMyStoreProfile(orgId: Id<'organizations'> | undefined) {
  const profile = useQuery(api.organizations.myStoreProfile, orgId ? { orgId } : 'skip');
  return profile;
}

/** This store's live public address (primary or <slug>.<root>), or null. */
export function useStoreHostname(orgId: Id<'organizations'> | undefined) {
  const address = useQuery(api.organizations.storeHostname, orgId ? { orgId } : 'skip');
  return address; // undefined while loading, null when no live domain
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  staff: 'Staff',
  customer: 'Customer',
};

export function roleLabel(role: StoreRole | undefined): string {
  if (!role) return 'Admin';
  return ROLE_LABEL[role] ?? role.charAt(0).toUpperCase() + role.slice(1);
}
