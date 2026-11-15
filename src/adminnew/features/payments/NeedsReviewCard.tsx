import { Link } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useOrg } from '../../../lib/convex/useOrg';
import { formatINR } from '../../../utils/currency';
import { paiseToRupees } from '../../../lib/convex/money';
import { Card, formatOrderDate } from '../../ui';
import { orderNumberLabel } from '../orders/orderModel';

/**
 * Orders where a customer reported a UPI transaction ID that the store has not
 * reviewed yet. Renders nothing when the list is empty.
 */
export function NeedsReviewCard() {
  const org = useOrg();
  const claims = useQuery(api.admin.listPaymentClaims, org ? { orgId: org._id } : 'skip');

  if (!claims || claims.length === 0) return null;

  return (
    <Card title={`Needs review (${claims.length})`}>
      <ul className="flex flex-col divide-y divide-border text-sm">
        {claims.map((o) => (
          <li key={o._id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
            <div className="flex min-w-0 flex-col">
              <Link to={`/orders/${o._id}`} className="font-medium text-primary hover:underline">
                Order {orderNumberLabel(o)}
              </Link>
              <span className="font-mono text-xs text-muted-foreground">UTR {o.paymentClaim?.utr}</span>
            </div>
            <div className="flex flex-col items-end text-right">
              <span className="tabular-nums text-foreground">{formatINR(paiseToRupees(o.finalAmountPaise))}</span>
              <span className="text-xs text-muted-foreground">
                {o.paymentClaim ? formatOrderDate(o.paymentClaim.submittedAt, { withTime: true }) : ''}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
