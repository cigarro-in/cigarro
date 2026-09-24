import { useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
import { useAuth } from '../useAuth';

// Theme-safe profile contract (Convex migration Phase 1+). Display
// name/phone live in Convex `users` (getMyProfile); the authenticated
// session is the fallback. Address surfaces prefill from here — never from
// stale auth metadata. Phone normalizes to the 10-digit form the address
// form validates.
export function toPhone10(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '').slice(-10);
}

export function useMyProfile() {
  const { user } = useAuth();
  const org = useOrg();
  const upsert = useMutation(api.userState.upsertUser);
  const profile = useQuery(api.userState.getMyProfile, user ? {} : 'skip');

  const updateDisplayName = useCallback(
    async (name?: string, phone?: string): Promise<void> => {
      if (!user || !org) throw new Error('Store not ready');
      await upsert({
        orgId: org._id,
        ...(name ? { name } : {}),
        ...(phone ? { phone } : {}),
      });
    },
    [user, org, upsert]
  );

  return {
    updateDisplayName,
    profileName: profile?.name ?? user?.name ?? null,
    profilePhone10: toPhone10(profile?.phone ?? user?.phone),
    profileLoading: user ? profile === undefined : false,
  };
}
