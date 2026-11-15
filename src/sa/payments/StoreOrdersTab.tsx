// Store page "Orders" tab: read-only list of the store's orders with how each
// payment was confirmed (SMS, email, manual, wallet).
import { useNavigate } from 'react-router-dom';
import { usePaginatedQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { Badge, Button, Card, DataTable, EmptyState, StatusBadge, formatOrderNumber, type Column } from '../../adminnew/ui';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useSa } from '../SuperGate';
import { formatDateTime } from '../saUi';
import { orderPath, rupees } from './shared';

type Row = FunctionReturnType<typeof api.pipeline.listStoreOrders>['page'][number];

const SOURCE_LABEL: Record<NonNullable<Row['source']>, string> = {
  sms: 'SMS',
  email: 'Email',
  manual: 'Manual',
  wallet: 'Wallet',
};

export function SourceBadge({ source }: { source: Row['source'] }) {
  if (!source) return <span className="text-[var(--admin-text-subtle)]">-</span>;
  const tone = source === 'sms' || source === 'email' ? 'info' : source === 'manual' ? 'attention' : 'neutral';
  return <Badge tone={tone}>{SOURCE_LABEL[source]}</Badge>;
}

/** Amount with the paise slot visible: ₹500.37 = ₹500 base + 37 paise slot. */
export function AmountCell({ finalPaise, slotPaise }: { finalPaise: number; slotPaise: number }) {
  return (
    <span className="tabular-nums">
      {rupees(finalPaise)}
      {slotPaise > 0 && <span className="ml-1 text-xs text-[var(--admin-text-muted)]">slot {slotPaise}p</span>}
    </span>
  );
}

const PAGE = 30;

export function StoreOrdersTab({ orgId }: { orgId: Id<'organizations'> }) {
  const { token } = useSa();
  const navigate = useNavigate();
  const { results, status, loadMore } = usePaginatedQuery(
    api.pipeline.listStoreOrders,
    { saToken: token, orgId },
    { initialNumItems: PAGE },
  );

  const columns: Column<Row>[] = [
    {
      id: 'number',
      header: 'Order',
      cell: (r) => <span className="font-medium tabular-nums">{formatOrderNumber(r.orderNumber) || '—'}</span>,
    },
    {
      id: 'customer',
      header: 'Customer',
      cell: (r) => <span className="truncate">{r.customer.name ?? r.customer.phone ?? '-'}</span>,
      hideBelow: 'sm',
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (r) => <AmountCell finalPaise={r.finalAmountPaise} slotPaise={r.slotOffsetPaise} />,
    },
    {
      id: 'stage',
      header: 'Stage',
      cell: (r) => <StatusBadge order={{ status: r.status, shippingStatus: r.shippingStatus ?? undefined }} />,
    },
    {
      id: 'source',
      header: 'Confirmed by',
      cell: (r) => <SourceBadge source={r.source} />,
      hideBelow: 'md',
    },
    {
      id: 'created',
      header: 'Created',
      cell: (r) => <span className="text-[13px] text-[var(--admin-text-muted)]">{formatDateTime(r.createdAt)}</span>,
      hideBelow: 'md',
    },
    {
      id: 'paid',
      header: 'Paid',
      cell: (r) => (
        <span className="text-[13px] text-[var(--admin-text-muted)]">{r.paidAt ? formatDateTime(r.paidAt) : '-'}</span>
      ),
      hideBelow: 'lg',
    },
  ];

  return (
    <Card padding="none">
      <DataTable
        columns={columns}
        rows={status === 'LoadingFirstPage' ? undefined : results}
        getRowId={(r) => r._id}
        onRowClick={(r) => navigate(orderPath(orgId, r._id))}
        rowLabel={(r) => `Open order ${formatOrderNumber(r.orderNumber) || '—'}`}
        empty={<EmptyState title="No orders yet" description="Orders placed in this store appear here, newest first." />}
      />
      {status === 'CanLoadMore' || status === 'LoadingMore' ? (
        <div className="border-t border-[var(--admin-border)] px-4 py-3">
          <Button variant="secondary" size="sm" loading={status === 'LoadingMore'} onClick={() => loadMore(PAGE)}>
            Load more
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
