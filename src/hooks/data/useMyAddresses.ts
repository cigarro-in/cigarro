import { useAuth } from '../useAuth';
import {
  useAddresses,
  type FlatAddress,
} from '../../lib/convex/useAddresses';

export type { FlatAddress };

// Theme-safe address store (Convex migration Phase 1). Themes must not
// import Convex clients directly — they go through this hook.
// Flat row shape keeps theme UI code unchanged regardless of backend.
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
