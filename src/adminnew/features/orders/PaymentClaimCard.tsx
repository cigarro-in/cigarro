import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Badge, Button, Card, ErrorBanner, Input, formatOrderDate, useButtonFeedback } from '../../ui';
import { formatINR } from '../../../utils/currency';
import { paiseToRupees } from '../../../lib/convex/money';
import { useActionRunner } from './useActionRunner';
import type { OrderDoc } from './orderModel';

const VIA_LABEL: Record<string, string> = {
  auto: 'a bank alert',
  admin: 'you',
};

/** Order-list marker for an order whose customer claim awaits review. */
export function UnderReviewBadge() {
  return (
    <Badge tone="attention" dot>
      Under review
    </Badge>
  );
}

/**
 * "Customer says they paid": the UPI transaction ID a customer submitted when
 * auto-confirmation failed. Confirm marks the order paid through the normal
 * markPaid path; Reject returns it to pending (and to expiry).
 */
export function PaymentClaimCard({ order }: { order: OrderDoc }) {
  const claim = order.paymentClaim;
  const confirm = useMutation(api.admin.confirmPaymentClaim);
  const reject = useMutation(api.admin.rejectPaymentClaim);
  const runner = useActionRunner();
  const copy = useButtonFeedback();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  if (!claim) return null;
  const inReview = claim.status === 'review';

  return (
    <Card title="Customer says they paid">
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-muted-foreground">UPI transaction ID</span>
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-mono text-foreground">{claim.utr}</span>
            <Button
              size="sm"
              variant="plain"
              state={copy.state}
              successLabel="Copied"
              errorLabel="Failed"
              onClick={() => void copy.run(() => navigator.clipboard.writeText(claim.utr))}
            >
              Copy
            </Button>
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-muted-foreground">Submitted</span>
          <span className="tabular-nums text-foreground">{formatOrderDate(claim.submittedAt, { withTime: true })}</span>
        </div>

        {claim.bankMessage && (
          <p className={claim.bankMessage.amountPaise === order.finalAmountPaise ? 'text-foreground' : 'text-destructive'}>
            Bank message found: {formatINR(paiseToRupees(claim.bankMessage.amountPaise))} at{' '}
            {formatOrderDate(claim.bankMessage.at, { withTime: true })}
            {claim.bankMessage.amountPaise !== order.finalAmountPaise && ' (amount differs from this order)'}
          </p>
        )}
        {!claim.bankMessage && claim.status === 'review' && (
          <p className="text-muted-foreground">No bank message with this ID yet.</p>
        )}
        {claim.status === 'review' && (
          <p className="text-muted-foreground">
            Check this ID in your bank app or statement, then confirm or reject.
          </p>
        )}
        {claim.status === 'rejected' && (
          <p className="text-foreground">
            Rejected{claim.rejectReason ? `: ${claim.rejectReason}` : ''}. Waiting for the customer to submit again.
          </p>
        )}
        {claim.status === 'confirmed' && (
          <p className="text-foreground">
            Confirmed from this claim{claim.confirmedVia ? ` (by ${VIA_LABEL[claim.confirmedVia] ?? claim.confirmedVia})` : ''}.
          </p>
        )}

        {inReview && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                state={runner.stateFor('confirm')}
                successLabel="Marked paid"
                errorLabel="Failed"
                disabled={runner.busy}
                onClick={() =>
                  void runner.run('confirm', async () => {
                    await confirm({ orderId: order._id });
                    return true;
                  })
                }
              >
                Confirm paid
              </Button>
              {!rejecting && (
                <Button variant="secondary" disabled={runner.busy} onClick={() => setRejecting(true)}>
                  Reject
                </Button>
              )}
            </div>
            {rejecting && (
              <div className="flex flex-col gap-2">
                <Input
                  value={reason}
                  maxLength={300}
                  placeholder="Reason (optional), shown to the customer"
                  onChange={(e) => setReason(e.target.value)}
                  disabled={runner.busy}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="critical"
                    state={runner.stateFor('reject')}
                    successLabel="Rejected"
                    errorLabel="Failed"
                    disabled={runner.busy}
                    onClick={() =>
                      void runner.run('reject', async () => {
                        await reject({ orderId: order._id, reason: reason.trim() || undefined });
                        setRejecting(false);
                        setReason('');
                        return true;
                      })
                    }
                  >
                    Reject claim
                  </Button>
                  <Button variant="plain" disabled={runner.busy} onClick={() => setRejecting(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            <ErrorBanner error={runner.error} />
          </div>
        )}
      </div>
    </Card>
  );
}
