import { useCallback, useEffect, useState } from 'react';
import { useConvex, useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from './useOrg';

// Phase 1 complete: address store is Convex-only. All callers require a
// signed-in user; pincode_lookup reads stay on Supabase (founder decision:
// GPS replaces that table; it is not migrated).
export interface FlatAddress {
  id?: string;
  full_name: string;
  phone: string;
  address: string;
  pincode: string;
  city: string;
  state: string;
  country: string;
  label: string;
  is_default?: boolean;
  user_id?: string;
}

function toFlat(row: any): FlatAddress {
  const a = row.address || {};
  return {
    id: String(row._id ?? row.id),
    full_name: a.name ?? row.full_name ?? '',
    phone: a.phone ?? row.phone ?? '',
    address: a.line1 ?? row.address ?? '',
    pincode: a.pincode ?? row.pincode ?? '',
    city: a.city ?? row.city ?? '',
    state: a.state ?? row.state ?? '',
    country: row.country ?? 'India',
    label: row.label ?? '',
    is_default: row.isDefault ?? row.is_default ?? false,
    user_id: row.userId ?? row.user_id,
  };
}

export function useAddresses(user: any) {
  const org = useOrg();
  const convexClient = useConvex();
  const [localItems, setLocalItems] = useState<FlatAddress[]>([]);

  const ready = !!user && !!org;
  const convexRows = useQuery(
    api.userState.listAddresses,
    ready ? { orgId: org!._id } : 'skip'
  );
  const convexAdd = useMutation(api.userState.addAddress);
  const convexUpdate = useMutation(api.userState.updateAddress);
  const convexRemove = useMutation(api.userState.removeAddress);
  const convexSetDefault = useMutation(api.userState.setDefaultAddress);

  // Mirror subscription rows locally so callers keep a stable array
  // identity between renders (same contract as the old local state).
  useEffect(() => {
    if (ready && convexRows !== undefined) {
      setLocalItems(convexRows.map(toFlat));
    }
    if (!user) {
      setLocalItems([]);
    }
  }, [ready, convexRows, user?.id]);

  const addresses: FlatAddress[] = localItems;
  const isLoading = ready ? convexRows === undefined : false;

  const reload = useCallback(async () => {
    // Subscription-driven; nothing to do. Kept for call-site compatibility.
  }, []);

  // Imperative fetch for call sites that need rows directly.
  const fetchNow = useCallback(async (): Promise<FlatAddress[]> => {
    if (!ready || !user || !org) return [];
    const rows = await convexClient.query(api.userState.listAddresses, {
      orgId: org._id,
    });
    const flat = (rows ?? []).map(toFlat);
    setLocalItems(flat);
    return flat;
  }, [ready, user, org, convexClient]);

  const saveAddress = useCallback(
    async (flat: FlatAddress): Promise<FlatAddress> => {
      if (!user || !org) throw new Error('Store not ready');
      if (flat.id) {
        await convexUpdate({
          orgId: org._id,
          addressId: flat.id as any,
          label: flat.label,
          line1: flat.address.trim(),
          city: flat.city.trim(),
          state: flat.state.trim(),
          pincode: flat.pincode.trim(),
          name: flat.full_name.trim(),
          phone: flat.phone.trim(),
        });
        return flat;
      }
      const id = await convexAdd({
        orgId: org._id,
        label: flat.label,
        line1: flat.address.trim(),
        city: flat.city.trim(),
        state: flat.state.trim(),
        pincode: flat.pincode.trim(),
        name: flat.full_name.trim(),
        phone: flat.phone.trim(),
      });
      return { ...flat, id: String(id) };
    },
    [user, org, convexAdd, convexUpdate]
  );

  const deleteAddress = useCallback(
    async (addressId: string): Promise<void> => {
      if (!user || !org) throw new Error('Store not ready');
      await convexRemove({ orgId: org._id, addressId: addressId as any });
    },
    [user, org, convexRemove]
  );

  const setDefaultAddress = useCallback(
    async (addressId: string): Promise<void> => {
      if (!user || !org) throw new Error('Store not ready');
      await convexSetDefault({ orgId: org._id, addressId: addressId as any });
    },
    [user, org, convexSetDefault]
  );

  return { addresses, isLoading, reload, fetchNow, saveAddress, deleteAddress, setDefaultAddress, useConvexPath: ready };
}
