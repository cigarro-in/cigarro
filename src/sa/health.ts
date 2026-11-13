// Store setup checks shared by the overview, stores list and store page.
// Plain derivations over listStores + listStoreStats rows; no Convex calls.
import type { StoreRow, StoreStatsRow } from './refs';

export type CheckId = 'domain' | 'gmail' | 'upi';

export interface StoreCheck {
  id: CheckId;
  label: string;
  ok: boolean;
  // Short reason shown when the check fails.
  problem: string;
}

export function storeChecks(store: StoreRow, stats: StoreStatsRow | undefined): StoreCheck[] {
  const domainOk = store.primaryStatus === 'active';
  return [
    {
      id: 'domain',
      label: 'Website live',
      ok: domainOk,
      problem: store.primaryHost ? `${store.primaryHost} is not live yet` : 'No web address',
    },
    {
      id: 'gmail',
      label: 'Payments tracked',
      ok: stats?.gmail === 'connected',
      problem:
        stats?.gmail === 'needs_reconnect'
          ? 'Gmail needs to be reconnected, payments are not being matched'
          : 'Gmail not connected, payments are not being matched',
    },
    {
      id: 'upi',
      label: 'UPI set',
      ok: !!store.upiVpa,
      problem: 'No UPI ID, customers cannot pay',
    },
  ];
}

// The live storefront URL (primary domain), or null before it has one.
export function storeLiveUrl(store: Pick<StoreRow, 'primaryHost'>): string | null {
  return store.primaryHost ? `https://${store.primaryHost}` : null;
}

// Store admin lives on the same admin host as /sa, under /<slug>.
export function storeAdminUrl(slug: string, path = ''): string {
  return `${window.location.origin}/${slug}${path}`;
}
