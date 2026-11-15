import { useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrgInfo } from '../../lib/org/OrgContext';
import type { PaymentClaimState } from './useMyOrders';

/** The fields the claim rules need; NormalizedOrder satisfies it. */
export interface ClaimableOrder {
  id: string;
  paymentStatus: string;
  terminalAt?: Date;
  claim?: PaymentClaimState;
}

// Claim window after an order expires: the customer may still report a UPI
// transaction ID for 24 h (the server revives the order to pending for review).
const CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000;

/** True when the customer may submit (or resubmit) a UPI transaction ID. */
export function canSubmitPaymentClaim(order: ClaimableOrder, now: number = Date.now()): boolean {
  if (order.claim?.status === 'review' || order.claim?.status === 'confirmed') return false;
  if (order.paymentStatus === 'pending') return true;
  if (order.paymentStatus === 'expired' && order.terminalAt) {
    return order.terminalAt.getTime() >= now - CLAIM_WINDOW_MS;
  }
  return false;
}

/** Customer-facing message for a submit error code (Convex error.data.code). */
export function paymentClaimErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'INVALID_UTR':
      return 'Enter the 12-digit UPI transaction ID.';
    case 'DUPLICATE_UTR':
      return 'This transaction ID is already linked to another order. Check the ID and try again.';
    case 'CLAIM_UNDER_REVIEW':
      return 'We are already reviewing a transaction ID for this order.';
    case 'CLAIM_WINDOW_CLOSED':
      return 'This order can no longer be confirmed. Please place a new order.';
    case 'EXPIRED_NOT_REVIVABLE':
    case 'AMOUNT_IN_USE':
      return 'We cannot reopen this order. Please contact the store.';
    case 'NOT_CLAIMABLE':
      return 'This order is not waiting for payment.';
    default:
      return 'Could not submit the transaction ID. Please try again.';
  }
}

/**
 * Submits a customer UPI transaction ID for an order. Throws the Convex error
 * unchanged so the view can map `error.data.code` with paymentClaimErrorMessage.
 */
export function useSubmitPaymentClaim(): (orderId: string, utr: string) => Promise<void> {
  const { slug: orgSlug } = useOrgInfo();
  const submit = useMutation(api.orders.submitPaymentClaim);
  return useCallback(
    async (orderId: string, utr: string) => {
      await submit({ orgSlug, orderId: orderId as any, utr });
    },
    [orgSlug, submit],
  );
}
