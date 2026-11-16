import { useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { paiseToRupees } from '../../lib/convex/money';

export type PlatformPaymentKind = 'deposit' | 'dues';

export type PlatformPaymentState = 'pending' | 'paid' | 'closed' | 'other';

/** One deposit or dues payment the store makes to Cigarro, in rupees. */
export interface PlatformPayment {
  orderId: Id<'orders'>;
  state: PlatformPaymentState;
  /** Paid, whether bank-matched, admin-confirmed or late. */
  paid: boolean;
  /** Nominal amount owed. */
  amountRupees: number;
  /** What the UPI payment asks for (nominal minus the paise match). */
  payRupees: number;
  matchRupees: number;
  upiUrl: string;
  payeeName: string;
  expiresAt: number;
  orderNumber: number | null;
  claim: { status: 'review' | 'rejected' | 'confirmed' | null; rejectReason: string | null };
}

/** Starts (or resumes the open) deposit or dues payment. Returns the order id. */
export function useStartPlatformPayment(orgId: Id<'organizations'> | undefined) {
  const create = useMutation(api.platformFees.createPlatformPayment);
  return useCallback(
    async (kind: PlatformPaymentKind): Promise<Id<'orders'>> => {
      if (!orgId) throw new Error('No store selected');
      const r = await create({ orgId, kind });
      return r.orderId;
    },
    [orgId, create],
  );
}

function stateOf(status: string): PlatformPaymentState {
  if (status === 'pending') return 'pending';
  if (status === 'paid' || status === 'late_paid') return 'paid';
  if (status === 'expired' || status === 'cancelled') return 'closed';
  return 'other';
}

/** Live view of one platform payment (undefined while loading, null when not found). */
export function usePlatformPayment(
  orgId: Id<'organizations'> | undefined,
  orderId: Id<'orders'> | null,
) {
  const raw = useQuery(
    api.platformFees.getPlatformPayment,
    orgId && orderId ? { orgId, orderId } : 'skip',
  );
  const wakeMutation = useMutation(api.platformFees.wakePlatformPayment);
  const claimMutation = useMutation(api.platformFees.submitPlatformPaymentClaim);

  const wake = useCallback(
    async (source: 'wake' | 'refresh') => {
      if (!orgId || !orderId) return;
      await wakeMutation({ orgId, orderId, source });
    },
    [orgId, orderId, wakeMutation],
  );

  const submitUtr = useCallback(
    async (utr: string) => {
      if (!orgId || !orderId) return;
      await claimMutation({ orgId, orderId, utr });
    },
    [orgId, orderId, claimMutation],
  );

  let payment: PlatformPayment | null | undefined;
  if (raw === undefined) payment = undefined;
  else if (raw === null) payment = null;
  else {
    const state = stateOf(raw.status);
    const claimStatus = raw.paymentClaim?.status ?? null;
    payment = {
      orderId: raw._id,
      state,
      paid: state === 'paid',
      amountRupees: paiseToRupees(raw.cartTotalPaise),
      payRupees: paiseToRupees(raw.finalAmountPaise),
      matchRupees: paiseToRupees(raw.matchOffsetPaise ?? 0),
      upiUrl: raw.upiUrl,
      payeeName: raw.payeeName,
      expiresAt: raw.expiresAt,
      orderNumber: raw.orderNumber ?? null,
      claim: {
        status: claimStatus,
        rejectReason: raw.paymentClaim?.rejectReason ?? null,
      },
    };
  }

  return { payment, wake, submitUtr };
}
