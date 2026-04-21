import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
import { useAuth } from '../useAuth';
import { paiseToRupees } from '../../lib/convex/money';

export interface WalletLedgerEntry {
  id: string;
  entryType: 'credit' | 'debit';
  amount: number;
  balanceAfter: number;
  reason: string;
  createdAt: Date;
  note?: string;
  relatedOrderId?: string;
}

export interface UseMyWalletResult {
  balance: number;
  ledger: WalletLedgerEntry[];
  loading: boolean;
  isAuthed: boolean;
}

export function useMyWallet(opts: { ledgerLimit?: number } = {}): UseMyWalletResult {
  const { user } = useAuth();
  const org = useOrg();
  const balanceData = useQuery(
    api.wallet.getMyBalance,
    org && user ? { orgId: org._id } : 'skip',
  );
  const ledgerData = useQuery(
    api.wallet.getMyLedger,
    org && user ? { orgId: org._id, limit: opts.ledgerLimit ?? 50 } : 'skip',
  );

  return {
    balance: balanceData ? paiseToRupees(balanceData.balancePaise) : 0,
    ledger: (ledgerData || []).map((e: any) => ({
      id: e._id,
      entryType: e.entryType,
      amount: paiseToRupees(e.amountPaise),
      balanceAfter: paiseToRupees(e.balanceAfterPaise),
      reason: e.reason,
      createdAt: new Date(e.createdAt),
      note: e.note,
      relatedOrderId: e.relatedOrderId,
    })),
    loading: balanceData === undefined || ledgerData === undefined,
    isAuthed: !!user,
  };
}
