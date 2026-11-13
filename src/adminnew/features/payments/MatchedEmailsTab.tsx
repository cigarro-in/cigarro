import { Link } from 'react-router-dom';
import { usePaginatedQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useOrg } from '../../../lib/convex/useOrg';
import { paiseToRupees } from '../../../lib/convex/money';
import { formatINR } from '../../../utils/currency';
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  formatOrderDate,
  formatOrderNumber,
  type Column,
} from '../../ui';

type MatchedRow = {
  _id: string;
  receivedAt: number;
  amountPaise: number;
  senderEmail: string;
  payerVpa: string | null;
  upiRef: string | null;
  orderId: string | null;
  orderNumber: number | null;
  displayOrderId: string | null;
};

const PAGE_SIZE = 25;

/** Bank emails that matched an order. Newest first. */
export function MatchedEmailsTab() {
  const org = useOrg();
  const { results, status, loadMore } = usePaginatedQuery(
    api.payments.listMatchedEmails,
    org ? { orgId: org._id } : 'skip',
    { initialNumItems: PAGE_SIZE },
  );

  const rows = results as MatchedRow[];

  const columns: Column<MatchedRow>[] = [
    {
      id: 'when',
      header: 'Received',
      cell: (r) => (
        <span className="whitespace-nowrap text-muted-foreground tabular-nums">
          {formatOrderDate(r.receivedAt, { withTime: true })}
        </span>
      ),
    },
    {
      id: 'sender',
      header: 'Sender',
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate text-sm text-foreground">{r.senderEmail}</div>
          {r.payerVpa && <div className="truncate text-xs text-muted-foreground">{r.payerVpa}</div>}
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (r) => (
        <span className="whitespace-nowrap font-medium tabular-nums">
          {formatINR(paiseToRupees(r.amountPaise))}
        </span>
      ),
    },
    {
      id: 'order',
      header: 'Order',
      align: 'right',
      cell: (r) =>
        r.orderId ? (
          <Link
            to={`/orders/${r.orderId}`}
            className="font-medium text-primary hover:underline"
          >
            {formatOrderNumber(r.orderNumber, r.displayOrderId)}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  const loadingFirst = status === 'LoadingFirstPage';

  return (
    <Card padding="none">
      <DataTable
        columns={columns}
        rows={loadingFirst ? undefined : rows}
        getRowId={(r) => r._id}
        empty={<EmptyState title="No matched emails yet" description="Bank alerts appear here once they match an order." />}
      />
      {(status === 'CanLoadMore' || status === 'LoadingMore') && (
        <div className="flex justify-center border-t border-border p-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={status === 'LoadingMore'}
            loading={status === 'LoadingMore'}
            onClick={() => loadMore(PAGE_SIZE)}
          >
            Load more
          </Button>
        </div>
      )}
    </Card>
  );
}
