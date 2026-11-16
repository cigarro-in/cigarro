import { useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { paiseToRupees } from '../../lib/convex/money';

type RawSetup = FunctionReturnType<typeof api.platformFees.getSetupStatus>;

/** Setup checklist for one store, in rupees and plain booleans (no paise, no raw steps). */
export interface StoreSetup {
  complete: boolean;
  /** True when checkout is blocked until setup is complete. */
  gateEnforced: boolean;
  checkoutOpen: boolean;
  /** Dashboard card should show (not complete and not dismissed). */
  cardVisible: boolean;
  autoConfirmDone: boolean;
  upiDone: boolean;
  deposit: {
    required: boolean;
    done: boolean;
    amountRupees: number;
    heldRupees: number;
    /** Still owed on the deposit (amount minus what is held). */
    dueNowRupees: number;
    /** A deposit payment's UTR is waiting for the platform to check it. */
    inReview: boolean;
  };
  /** Steps that apply to this store (deposit counted only when required). */
  doneCount: number;
  totalCount: number;
}

function toStoreSetup(raw: RawSetup): StoreSetup {
  const { steps } = raw;
  const deposit = steps.deposit;
  const depositCounts = deposit.required;
  const doneCount =
    (steps.autoConfirm.done ? 1 : 0) +
    (steps.upi.done ? 1 : 0) +
    (depositCounts && deposit.done ? 1 : 0);
  return {
    complete: raw.complete,
    gateEnforced: raw.gate === 'enforced',
    checkoutOpen: raw.checkoutOpen,
    cardVisible: raw.cardVisible,
    autoConfirmDone: steps.autoConfirm.done,
    upiDone: steps.upi.done,
    deposit: {
      required: deposit.required,
      done: deposit.done,
      amountRupees: paiseToRupees(deposit.amountPaise),
      heldRupees: paiseToRupees(deposit.heldPaise),
      dueNowRupees: paiseToRupees(deposit.dueNowPaise),
      inReview: deposit.inReview,
    },
    doneCount,
    totalCount: depositCounts ? 3 : 2,
  };
}

/** Store setup status plus the dashboard "Dismiss" action. `status` is undefined while loading. */
export function useStoreSetup(orgId: Id<'organizations'> | undefined) {
  const raw = useQuery(api.platformFees.getSetupStatus, orgId ? { orgId } : 'skip');
  const dismissMutation = useMutation(api.platformFees.dismissSetupCard);
  const dismiss = useCallback(async () => {
    if (!orgId) return;
    await dismissMutation({ orgId });
  }, [orgId, dismissMutation]);
  return {
    status: raw ? toStoreSetup(raw) : undefined,
    dismiss,
  };
}
