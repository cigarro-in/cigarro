import { useStoreSettings } from './useStoreSettings';
import type { StoreReferralRules } from '../../lib/storeSettings';

// Refer & earn program state for the active store. Themes read this instead of
// touching Convex. While settings load, `enabled` is false so the referral page,
// links and menu items never flash for a store that has the program switched off.

export interface ReferralProgram {
  enabled: boolean;
  loading: boolean;
  rules: StoreReferralRules;
}

export function useReferralProgram(): ReferralProgram {
  const { settings, loading } = useStoreSettings();
  const rules = settings.referral;
  return {
    enabled: !loading && rules.enabled,
    loading,
    rules,
  };
}
