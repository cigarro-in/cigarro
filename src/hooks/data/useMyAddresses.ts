import { useAuth } from '../useAuth';
import {
  useAddresses,
  type FlatAddress,
} from '../../lib/convex/useAddresses';

export type { FlatAddress };

// Theme-safe address store (Convex migration Phase 1). Themes must not
// import Convex/Supabase clients directly — they go through this hook.
// Flat row shape matches the legacy Supabase `saved_addresses` rows, so
// theme UI code is unchanged regardless of backend.
export function useMyAddresses() {
  const { user } = useAuth();
  const store = useAddresses(user);
  return {
    addresses: store.addresses,
    loading: store.isLoading,
    reload: store.reload,
    saveAddress: store.saveAddress,
    deleteAddress: store.deleteAddress,
    setDefaultAddress: store.setDefaultAddress,
  };
}
