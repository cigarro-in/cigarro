import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import { CheckCircle2 } from 'lucide-react';
import type { Id } from '../../../../convex/_generated/dataModel';
import { PaymentMatchRow } from '../../../components/payment/PaymentMatchRow';
import { formatINR } from '../../../utils/currency';
import {
  useStartPlatformPayment,
  usePlatformPayment,
  type PlatformPayment,
  type PlatformPaymentKind,
} from '../../hooks/usePlatformPayment';
import {
  Banner,
  Button,
  Dialog,
  Input,
  Skeleton,
  formatOrderNumber,
  toActionError,
  useButtonFeedback,
} from '../../ui';

const UTR_RE = /^\d{12}$/;

/** Plain-language messages for platform payment errors. Never shows codes or ids. */
export function platformPaymentErrorMessage(err: unknown): string {
  const code = (err as { data?: { code?: string } })?.data?.code;
  switch (code) {
    case 'PLATFORM_PAYMENTS_NOT_CONFIGURED':
      return "Payments to Cigarro aren't set up yet. Please try again later.";
    case 'DEPOSIT_ALREADY_HELD':
      return 'Your security deposit is already paid.';
    case 'DEPOSIT_NOT_REQUIRED':
      return 'Your store does not need a security deposit.';
    case 'NO_DUES':
      return 'You have no dues to pay.';
    case 'NOT_FOUND':
      return "We couldn't find this payment. Close this and try again.";
    case 'INVALID_UTR':
      return 'Enter the 12-digit UPI transaction ID.';
    case 'DUPLICATE_UTR':
      return 'This transaction ID is already used for another payment. Check it and try again.';
    case 'CLAIM_UNDER_REVIEW':
      return "We're already checking a transaction ID for this payment.";
    case 'CLAIM_WINDOW_CLOSED':
    case 'NOT_CLAIMABLE':
      return "This payment can't be confirmed any more. Start a new payment.";
    default:
      return toActionError(err, 'Something went wrong. Please try again.').message;
  }
}

function mmss(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Pays a security deposit or platform fees to Cigarro by UPI QR. Starts (or
 * resumes) the payment when opened, follows its status live, and offers a
 * "Paid but not confirmed?" transaction-ID fallback.
 */
export function PlatformPaymentSheet({
  open,
  onOpenChange,
  orgId,
  kind,
  title,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: Id<'organizations'> | undefined;
  kind: PlatformPaymentKind;
  title?: string;
  /** Called once when this payment turns paid. */
  onPaid?: () => void;
}) {
  const startPayment = useStartPlatformPayment(orgId);
  const [orderId, setOrderId] = useState<Id<'orders'> | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const { payment, wake, submitUtr } = usePlatformPayment(orgId, orderId);
  const refresh = useButtonFeedback();
  const claim = useButtonFeedback();
  const [claimOpen, setClaimOpen] = useState(false);
  const [utr, setUtr] = useState('');
  const [utrError, setUtrError] = useState<string | null>(null);
  const [qr, setQr] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const wokeFor = useRef<string | null>(null);
  const paidNotified = useRef<string | null>(null);

  // Starts the payment, or resumes the open one (the server reuses it).
  const begin = useCallback(async () => {
    setStarting(true);
    setStartError(null);
    try {
      setOrderId(await startPayment(kind));
    } catch (err) {
      setStartError(platformPaymentErrorMessage(err));
    } finally {
      setStarting(false);
    }
  }, [startPayment, kind]);

  // Opening the sheet starts or resumes the payment.
  useEffect(() => {
    if (open && orgId) void begin();
  }, [open, orgId, begin]);

  // Reset the claim form when the sheet closes.
  useEffect(() => {
    if (open) return;
    setClaimOpen(false);
    setUtr('');
    setUtrError(null);
  }, [open]);

  // Check the bank inbox once per payment (the server throttles further checks).
  useEffect(() => {
    if (!open || !orderId || wokeFor.current === orderId) return;
    wokeFor.current = orderId;
    wake('wake').catch(() => undefined);
  }, [open, orderId, wake]);

  // Countdown while pending.
  const pending = payment?.state === 'pending';
  useEffect(() => {
    if (!pending) return;
    setNow(Date.now());
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [pending]);

  // QR for the UPI link.
  const upiUrl = payment?.upiUrl ?? '';
  useEffect(() => {
    if (!upiUrl) {
      setQr('');
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(upiUrl, { margin: 1, width: 192 })
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {
        if (!cancelled) setQr('');
      });
    return () => {
      cancelled = true;
    };
  }, [upiUrl]);

  // Tell the parent once when this payment is paid.
  useEffect(() => {
    if (!payment?.paid || !orderId || paidNotified.current === orderId) return;
    paidNotified.current = orderId;
    onPaid?.();
  }, [payment?.paid, orderId, onPaid]);

  const onClaim = (e: FormEvent) => {
    e.preventDefault();
    const clean = utr.replace(/\s+/g, '');
    if (!UTR_RE.test(clean)) {
      setUtrError('Enter the 12-digit UPI transaction ID.');
      return;
    }
    setUtrError(null);
    void claim.run(async () => {
      await submitUtr(clean);
      setClaimOpen(false);
      setUtr('');
    });
  };

  const heading = title ?? (kind === 'deposit' ? 'Pay security deposit' : 'Pay platform fees');
  const loading = starting || (orderId !== null && payment === undefined);
  const closed = payment?.state === 'closed';
  const timeUp = pending && payment !== undefined && payment !== null && payment.expiresAt - now <= 0;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={heading}
      size="sm"
      footer={
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      }
    >
      {startError && <Banner tone="critical">{startError}</Banner>}

      {!startError && loading && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Skeleton className="size-48" />
          <Skeleton className="h-6 w-40" />
        </div>
      )}

      {!startError && !loading && payment === null && (
        <Banner tone="critical">We couldn&apos;t find this payment. Close this and try again.</Banner>
      )}

      {payment?.paid && <PaidView payment={payment} />}

      {payment && !payment.paid && (closed || timeUp) && (
        <div className="flex flex-col gap-3">
          <Banner tone="warning">This payment window has closed. Start a new payment to continue.</Banner>
          <Button variant="primary" onClick={() => void begin()} loading={starting} className="self-start">
            Start a new payment
          </Button>
        </div>
      )}

      {payment?.state === 'pending' && !timeUp && (
        <PendingView
          payment={payment}
          qr={qr}
          remainingMs={payment.expiresAt - now}
          claimOpen={claimOpen}
          onOpenClaim={() => {
            claim.reset();
            setClaimOpen(true);
          }}
          utr={utr}
          onUtr={(v) => {
            setUtr(v);
            setUtrError(null);
          }}
          utrError={utrError}
          onClaim={onClaim}
          claimBusy={claim.busy}
          claimError={claim.error?.message ?? null}
          onCancelClaim={() => {
            setClaimOpen(false);
            setUtrError(null);
            claim.reset();
          }}
          refreshState={refresh.state}
          onRefresh={() => void refresh.run(() => wake('refresh'))}
        />
      )}
    </Dialog>
  );
}

function PaidView({ payment }: { payment: PlatformPayment }) {
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center">
      <CheckCircle2 className="size-10 text-[var(--admin-success)]" aria-hidden />
      <p className="text-base font-semibold text-[var(--admin-text)]">Payment received</p>
      <p className="text-sm text-[var(--admin-text-muted)]">
        {formatINR(payment.amountRupees)} paid to {payment.payeeName}. Thank you.
      </p>
    </div>
  );
}

function PendingView({
  payment,
  qr,
  remainingMs,
  claimOpen,
  onOpenClaim,
  utr,
  onUtr,
  utrError,
  onClaim,
  claimBusy,
  claimError,
  onCancelClaim,
  refreshState,
  onRefresh,
}: {
  payment: PlatformPayment;
  qr: string;
  remainingMs: number;
  claimOpen: boolean;
  onOpenClaim: () => void;
  utr: string;
  onUtr: (v: string) => void;
  utrError: string | null;
  onClaim: (e: FormEvent) => void;
  claimBusy: boolean;
  claimError: string | null;
  onCancelClaim: () => void;
  refreshState: 'idle' | 'loading' | 'success' | 'error';
  onRefresh: () => void;
}) {
  const inReview = payment.claim.status === 'review';
  const rejected = payment.claim.status === 'rejected';
  const ref = formatOrderNumber(payment.orderNumber);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        {qr ? (
          <img
            src={qr}
            alt={`UPI QR code to pay ${formatINR(payment.payRupees)}`}
            className="size-48 shrink-0 rounded-md border border-[var(--admin-border)] bg-white p-2"
          />
        ) : (
          <Skeleton className="size-48 shrink-0" />
        )}
        <div className="flex w-full min-w-0 flex-col gap-2 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--admin-text-muted)]">Pay exactly</p>
          <p className="text-2xl font-semibold tabular-nums text-[var(--admin-text)]">{formatINR(payment.payRupees)}</p>
          <PaymentMatchRow amount={payment.matchRupees} className="text-xs text-[var(--admin-text-muted)]" />
          <p className="text-[var(--admin-text-muted)]">
            Paying <span className="text-[var(--admin-text)]">{payment.payeeName}</span>
          </p>
          {ref && <p className="text-xs text-[var(--admin-text-muted)]">Reference {ref}</p>}
          <p className="text-xs tabular-nums text-[var(--admin-text-muted)]" role="timer">
            Expires in {mmss(remainingMs)}
          </p>
          {payment.upiUrl && (
            <a
              href={payment.upiUrl}
              className="mt-1 inline-flex h-9 w-fit items-center rounded-md border border-[var(--admin-border)] px-3.5 text-sm font-medium text-[var(--admin-text)] transition-colors duration-150 hover:bg-[var(--admin-neutral-soft)]"
            >
              Open UPI app
            </a>
          )}
        </div>
      </div>

      <p className="text-xs text-[var(--admin-text-muted)]">
        Scan with any UPI app. Once you pay, this page updates by itself.
      </p>

      {inReview && <Banner tone="info">Under review. We&apos;ll confirm this payment shortly.</Banner>}

      {rejected && (
        <Banner tone="warning">
          We couldn&apos;t find this payment.
          {payment.claim.rejectReason ? ` Reason: ${payment.claim.rejectReason}` : ''}
        </Banner>
      )}

      {!inReview && !claimOpen && (
        <div>
          <button
            type="button"
            onClick={onOpenClaim}
            className="text-sm font-medium text-[var(--admin-text)] underline underline-offset-2"
          >
            {rejected ? 'Submit the transaction ID again' : 'Paid but not confirmed?'}
          </button>
        </div>
      )}

      {!inReview && claimOpen && (
        <form onSubmit={onClaim} className="flex flex-col gap-2" noValidate>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">UPI transaction ID (12 digits)</span>
            <Input
              inputMode="numeric"
              autoComplete="off"
              value={utr}
              onChange={(e) => onUtr(e.target.value)}
              placeholder="e.g. 412345678901"
              aria-invalid={!!utrError}
            />
          </label>
          {utrError && <Banner tone="critical">{utrError}</Banner>}
          {claimError && <Banner tone="critical">{claimError}</Banner>}
          <div className="flex items-center gap-2">
            <Button type="submit" variant="primary" loading={claimBusy}>
              Submit
            </Button>
            <Button type="button" variant="plain" onClick={onCancelClaim}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="flex items-center gap-2 border-t border-[var(--admin-border)] pt-3">
        <Button variant="secondary" state={refreshState} onClick={onRefresh}>
          Check again
        </Button>
      </div>
    </div>
  );
}
