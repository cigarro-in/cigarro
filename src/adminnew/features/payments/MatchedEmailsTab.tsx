import { Link } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useOrg } from '../../../lib/convex/useOrg';
import { paiseToRupees } from '../../../lib/convex/money';
import { formatINR } from '../../../utils/currency';
import { useCursorPages, usePageSize } from '../../hooks/usePagination';
import {
  Card,
  DataTable,
  EmptyState,
  Pagination,
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

/** Bank emails that matched an order. Newest first, one page at a time. */
export function MatchedEmailsTab() {
  const org = useOrg();
  const [pageSize, setPageSize] = usePageSize('matchedEmails');
  const pages = useCursorPages(JSON.stringify({ orgId: org?._id ?? null, pageSize }));

  const data = useQuery(
    api.payments.listMatchedEmails,
    org ? { orgId: org._id, cursor: pages.cursor, pageSize } : 'skip',
  );

  const rows: MatchedRow[] | undefined = data?.page;

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
            {formatOrderNumber(r.orderNumber) || '—'}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <Card padding="none">
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r._id}
        empty={<EmptyState title="No matched emails yet" description="Bank alerts appear here once they match an order." />}
      />
      {data && rows && rows.length > 0 && (
        <Pagination
          page={pages.page}
          hasNext={!data.isDone}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          onPageChange={(p) => {
            if (p > pages.page) {
              if (data.continueCursor) pages.next(data.continueCursor);
            } else {
              pages.prev();
            }
          }}
        />
      )}
    </Card>
  );
}
