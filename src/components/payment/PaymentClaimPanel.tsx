import { useState, type FormEvent } from 'react';
import { InlineStatus, useInlineStatus } from '../common/InlineStatus';
import {
  canSubmitPaymentClaim,
  paymentClaimErrorMessage,
  useSubmitPaymentClaim,
  type ClaimableOrder,
} from '../../hooks/data/usePaymentClaim';

/**
 * "Paid but not confirmed?" flow for one order. Shows the review state when a
 * UTR is under review, the rejection with reason and a resubmit path, or a
 * compact link that opens a 12-digit UPI transaction ID field. Pure presentation
 * over the data layer (useSubmitPaymentClaim); themes render it as-is.
 */
export function PaymentClaimPanel({
  order,
  className = '',
}: {
  order: ClaimableOrder;
  className?: string;
}) {
  const submit = useSubmitPaymentClaim();
  const { status, setError, clear } = useInlineStatus();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  const claim = order.claim;
  if (claim?.status === 'confirmed') return null;

  if (claim?.status === 'review') {
    return (
      <p className={`text-[13px] ${className}`} role="status">
        Under review: the store will confirm shortly.
      </p>
    );
  }

  const canSubmit = canSubmitPaymentClaim(order);
  if (!canSubmit && claim?.status !== 'rejected') return null;

  const rejected = claim?.status === 'rejected';

  if (!open) {
    return (
      <div className={`text-[13px] ${className}`}>
        {rejected && (
          <p>
            The store couldn&apos;t find this payment.
            {claim?.rejectReason ? <span> Reason: {claim.rejectReason}</span> : null}
          </p>
        )}
        {canSubmit && (
          <button
            type="button"
            onClick={() => {
              clear();
              setOpen(true);
            }}
            className="mt-1 underline underline-offset-2"
          >
            {rejected ? 'Submit the transaction ID again' : 'Paid but not confirmed?'}
          </button>
        )}
      </div>
    );
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const utr = value.replace(/\s+/g, '');
    if (!/^\d{12}$/.test(utr)) {
      setError(paymentClaimErrorMessage('INVALID_UTR'));
      return;
    }
    setBusy(true);
    try {
      await submit(order.id, utr);
      setOpen(false);
      setValue('');
      clear();
    } catch (err) {
      const code = (err as { data?: { code?: string } })?.data?.code;
      setError(paymentClaimErrorMessage(code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className={`space-y-2 text-[13px] ${className}`} noValidate>
      <label className="block">
        <span className="block font-medium">UPI transaction ID (12 digits)</span>
        <input
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 412345678901"
          className="mt-1 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2"
        />
      </label>
      <InlineStatus status={status} />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg border border-current/30 px-3 py-1.5 font-semibold disabled:opacity-60"
        >
          {busy ? 'Submitting...' : 'Submit'}
        </button>
        <button
          type="button"
          onClick={() => {
            clear();
            setOpen(false);
          }}
          className="underline underline-offset-2 opacity-80"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
