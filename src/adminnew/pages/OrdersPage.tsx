import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { cn } from '../../components/ui/utils';
import { useOrg } from '../../lib/convex/useOrg';
import { deriveOrderStage, type OrderStage } from '../../lib/orders/orderStage';
import { formatINR } from '../../utils/currency';
import { useCursorPages, usePageSize } from '../hooks/usePagination';
import {
  BulkActionBar,
  Button,
  Card,
  Checkbox,
  DataTable,
  DateRangePresets,
  EmptyState,
  ErrorBanner,
  FilterBar,
  FilterChip,
  Page,
  Pagination,
  SkeletonTable,
  StatusBadge,
  formatOrderDate,
  getDateRange,
  inDateRange,
  useRowSelection,
  type Column,
  type DateRangePreset,
} from '../ui';
import { UnderReviewBadge } from '../features/orders/PaymentClaimCard';
import {
  STAGE_FILTERS,
  customerName,
  itemsSummary,
  matchesStageFilter,
  orderNumberLabel,
  orderTotalRupees,
  stageFilterFromParam,
  type OrderDoc,
  type StageFilter,
} from '../features/orders/orderModel';
import { useActionRunner } from '../features/orders/useActionRunner';

interface Entry {
  order: OrderDoc;
  stage: OrderStage;
}

const money = (order: OrderDoc) => formatINR(orderTotalRupees(order));

export function OrdersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const org = useOrg();

  const [search, setSearch] = useState('');
  const [stage, setStage] = useState<StageFilter>(() => stageFilterFromParam(searchParams.get('status')));
  const [preset, setPreset] = useState<DateRangePreset>('all');
  const [pageSize, setPageSize] = usePageSize('orders');

  const range = useMemo(() => getDateRange(preset), [preset]);
  const trimmed = search.trim();

  const pages = useCursorPages(JSON.stringify({ orgId: org?._id ?? null, stage, preset, search: trimmed, pageSize }));

  const pageData = useQuery(
    api.admin.listOrdersPage,
    org
      ? {
          orgId: org._id,
          stage: stage === 'all' ? undefined : stage,
          from: range.from ?? undefined,
          to: range.to ?? undefined,
          search: trimmed || undefined,
          cursor: pages.cursor,
          pageSize,
        }
      : 'skip',
  );

  // A five-digit search is looked up directly, so an order outside the
  // scanned pages is still found. It is shown on top of page 1 when it
  // passes the same filters as the rest of the list.
  const orderNumberQuery = /^#?\d{5}$/.test(trimmed) ? Number(trimmed.replace('#', '')) : undefined;
  const foundByNumber = useQuery(
    api.admin.findOrderByNumber,
    org && orderNumberQuery !== undefined ? { orgId: org._id, orderNumber: orderNumberQuery } : 'skip',
  );

  const updateShipping = useMutation(api.admin.updateShipping);
  const sel = useRowSelection();
  const bulk = useActionRunner();
  const { clear: clearSelection } = sel;

  // Selection applies to the visible page only: drop it when the page changes.
  const pageKey = `${JSON.stringify([stage, preset, trimmed, pageSize])}|${pages.cursor ?? ''}`;
  useEffect(() => {
    clearSelection();
  }, [pageKey, clearSelection]);

  const loading = pageData === undefined;

  const entries: Entry[] = useMemo(() => {
    if (!pageData) return [];
    const rows: OrderDoc[] = [...pageData.page];
    if (
      pages.page === 1 &&
      foundByNumber &&
      !rows.some((o) => o._id === foundByNumber._id) &&
      matchesStageFilter(stage, deriveOrderStage(foundByNumber)) &&
      inDateRange(foundByNumber.createdAt, range)
    ) {
      rows.unshift(foundByNumber);
    }
    return rows.map((order) => ({ order, stage: deriveOrderStage(order) }));
  }, [pageData, foundByNumber, pages.page, stage, range]);

  const hasNext = pageData ? !pageData.isDone : false;
  const goToPage = (p: number) => {
    if (p > pages.page) {
      if (pageData?.continueCursor) pages.next(pageData.continueCursor);
    } else {
      pages.prev();
    }
  };

  const filtersActive = trimmed !== '' || stage !== 'all' || preset !== 'all';

  // Bulk shipping steps, limited to the orders each step applies to.
  const selected = useMemo(() => entries.filter((e) => sel.isSelected(e.order._id)), [entries, sel]);
  const pick = (stages: OrderStage[]) => selected.filter((e) => stages.includes(e.stage)).map((e) => e.order);
  const toPrepare = pick(['paid']);
  const toShip = pick(['paid', 'preparing']);
  const toDeliver = pick(['shipped']);

  const runBulk = (id: string, orders: OrderDoc[], shippingStatus: 'processing' | 'shipped' | 'delivered') =>
    bulk.run(id, async () => {
      const results = await Promise.allSettled(
        orders.map((o) => updateShipping({ orderId: o._id, shippingStatus })),
      );
      const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failed) throw failed.reason;
      sel.clear();
    });

  const columns: Column<Entry>[] = [
    {
      id: 'number',
      header: 'Order',
      width: 'w-24',
      cell: ({ order }) => <span className="font-semibold tabular-nums text-foreground">{orderNumberLabel(order)}</span>,
    },
    {
      id: 'customer',
      header: 'Customer',
      cell: ({ order }) => <span className="block max-w-50 truncate text-foreground">{customerName(order)}</span>,
    },
    {
      id: 'items',
      header: 'Items',
      hideBelow: 'md',
      cell: ({ order }) => <span className="block max-w-65 truncate text-muted-foreground">{itemsSummary(order)}</span>,
    },
    {
      id: 'total',
      header: 'Total',
      align: 'right',
      cell: ({ order }) => <span className="tabular-nums text-foreground">{money(order)}</span>,
    },
    {
      id: 'stage',
      header: 'Stage',
      cell: ({ order, stage: s }) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <StatusBadge stage={s} />
          {order.paymentClaim?.status === 'review' && <UnderReviewBadge />}
        </span>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      hideBelow: 'lg',
      cell: ({ order }) => <span className="whitespace-nowrap text-muted-foreground">{formatOrderDate(order.createdAt)}</span>,
    },
  ];

  const clearFilters = () => {
    setSearch('');
    setStage('all');
    setPreset('all');
  };

  const emptyState = (
    <EmptyState
      title={filtersActive ? 'No orders match these filters' : 'No orders yet'}
      action={filtersActive ? <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button> : undefined}
    />
  );

  return (
    <Page title="Orders">
      <ErrorBanner error={bulk.error} />
      <Card padding="none">
        <FilterBar
          search={{ value: search, onChange: setSearch, placeholder: 'Search order no., customer, phone, item' }}
        >
          <DateRangePresets value={preset} onChange={(p) => setPreset(p)} />
          {STAGE_FILTERS.map((f) => (
            <FilterChip
              key={f.id}
              label={f.label}
              active={stage === f.id}
              onClick={() => setStage(f.id)}
            />
          ))}
        </FilterBar>

        {/* Desktop and tablet: dense table. */}
        <div className="hidden md:block">
          <DataTable<Entry>
            columns={columns}
            rows={loading ? undefined : entries}
            getRowId={(e) => e.order._id}
            selection={sel}
            onRowClick={(e) => navigate(`/orders/${e.order._id}`)}
            rowLabel={(e) => `Open order ${orderNumberLabel(e.order)}`}
            empty={emptyState}
          />
        </div>

        {/* Phones: one card per order. */}
        <div className="md:hidden">
          {loading && <SkeletonTable rows={5} columns={2} />}
          {!loading && entries.length === 0 && emptyState}
          {!loading && entries.length > 0 && (
            <ul className="divide-y divide-border">
              {entries.map(({ order, stage: s }) => {
                const id = order._id;
                const isSel = sel.isSelected(id);
                return (
                  <li key={id} className={cn('flex items-start gap-3 px-4 py-3', isSel && 'bg-primary/10')}>
                    <div className="pt-1">
                      <Checkbox label={`Select order ${orderNumberLabel(order)}`} checked={isSel} onCheckedChange={() => sel.toggle(id)} />
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/orders/${id}`)}
                      className="flex min-w-0 flex-1 flex-col gap-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold tabular-nums text-foreground">{orderNumberLabel(order)}</span>
                        <span className="inline-flex items-center gap-1.5">
                          {order.paymentClaim?.status === 'review' && <UnderReviewBadge />}
                          <StatusBadge stage={s} />
                        </span>
                      </div>
                      <span className="truncate text-sm text-foreground">{customerName(order)}</span>
                      <span className="truncate text-sm text-muted-foreground">{itemsSummary(order)}</span>
                      <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{formatOrderDate(order.createdAt)}</span>
                        <span className="text-sm font-semibold tabular-nums text-foreground">{money(order)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {!loading && entries.length > 0 && (
          <Pagination
            page={pages.page}
            hasNext={hasNext}
            onPageChange={goToPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
          />
        )}
      </Card>

      <BulkActionBar
        count={sel.count}
        onClear={sel.clear}
        noun="selected"
        actions={
          <>
            <Button size="sm" variant="secondary" disabled={toPrepare.length === 0 || bulk.busy}
              state={bulk.stateFor('prepare')} onClick={() => void runBulk('prepare', toPrepare, 'processing')}>
              Start preparing ({toPrepare.length})
            </Button>
            <Button size="sm" variant="secondary" disabled={toShip.length === 0 || bulk.busy}
              state={bulk.stateFor('ship')} onClick={() => void runBulk('ship', toShip, 'shipped')}>
              Mark shipped ({toShip.length})
            </Button>
            <Button size="sm" variant="secondary" disabled={toDeliver.length === 0 || bulk.busy}
              state={bulk.stateFor('deliver')} onClick={() => void runBulk('deliver', toDeliver, 'delivered')}>
              Mark delivered ({toDeliver.length})
            </Button>
          </>
        }
      />
    </Page>
  );
}
