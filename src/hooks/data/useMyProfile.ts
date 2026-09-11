import { useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
import { useAuth } from '../useAuth';

// Theme-safe profile writer (Convex migration Phase 1). Display name/phone
// live in Convex `users`; auth metadata + email stay on Supabase Auth until
// the Phase 2 cutover. Themes must use this hook, never Convex clients.
export function useMyProfile() {
  const { user } = useAuth();
  const org = useOrg();
  const upsert = useMutation(api.userState.upsertUser);

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

  return { updateDisplayName };
}
