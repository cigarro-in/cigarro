import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useOrg } from '../../../lib/convex/useOrg';
import { formatINR } from '../../../utils/currency';
import { paiseToRupees } from '../../../lib/convex/money';
import { Card, formatOrderDate } from '../../ui';
import { checkoutBlockReasonLabel } from './platformFeeFormat';

export interface MissedCheckout {
  _id: string;
  createdAt: number;
  reason: 'no_upi' | 'setup';
  cartTotalPaise: number;
  itemCount: number;
  guest: boolean;
  phone: string | null;
}

/** Blocked checkouts (newest first). Presentational: the caller supplies rows. */
export function MissedOrdersList({ rows, loading }: { rows: MissedCheckout[] | undefined; loading: boolean }) {
  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (!rows || rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No customers have been blocked at checkout.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-border text-sm">
      {rows.map((r) => (
        <li key={r._id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
          <div className="flex min-w-0 flex-col">
            <span className="text-foreground">{checkoutBlockReasonLabel(r.reason)}</span>
            <span className="text-xs text-muted-foreground">
              {r.guest ? 'Guest' : r.phone ?? 'Signed-in customer'} · {r.itemCount} {r.itemCount === 1 ? 'item' : 'items'}
            </span>
          </div>
          <div className="flex flex-col items-end text-right">
            <span className="tabular-nums text-foreground">{formatINR(paiseToRupees(r.cartTotalPaise))}</span>
            <span className="text-xs text-muted-foreground">{formatOrderDate(r.createdAt, { withTime: true })}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Store admin payments hub: newest 50 carts blocked at checkout. */
export function MissedOrdersCard() {
  const org = useOrg();
  const rows = useQuery(api.platformFees.listCheckoutBlocks, org ? { orgId: org._id } : 'skip');
  return (
    <Card title="Missed orders">
      <p className="mb-2 text-xs text-muted-foreground">Carts that could not check out because the store was not taking orders.</p>
      <MissedOrdersList rows={rows} loading={rows === undefined} />
    </Card>
  );
}
