import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { cn } from '../../components/ui/utils';
import { useOrg } from '../../lib/convex/useOrg';
import { deriveOrderStage, type OrderStage } from '../../lib/orders/orderStage';
import { formatINR } from '../../utils/currency';
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
  paginate,
  useRowSelection,
  type Column,
  type DateRangePreset,
} from '../ui';
import {
  STAGE_FILTERS,
  customerName,
  itemsSummary,
  matchesStageFilter,
  orderNumberLabel,
  orderSearchText,
  orderTotalRupees,
  stageFilterFromParam,
  type OrderDoc,
  type StageFilter,
} from '../features/orders/orderModel';
import { useActionRunner } from '../features/orders/useActionRunner';

const PAGE_SIZE = 25;
const LOAD_LIMIT = 200;

interface Entry {
  order: OrderDoc;
  stage: OrderStage;
}

const money = (order: OrderDoc) => formatINR(orderTotalRupees(order));

export function OrdersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const org = useOrg();

  const convexOrders = useQuery(
    api.admin.listRecentOrders,
    org ? { orgId: org._id, limit: LOAD_LIMIT } : 'skip',
  );

  const [search, setSearch] = useState('');
  const [stage, setStage] = useState<StageFilter>(() => stageFilterFromParam(searchParams.get('status')));
  const [preset, setPreset] = useState<DateRangePreset>('all');
  const [page, setPage] = useState(1);

  // A five-digit search is looked up directly, so an order older than the
  // loaded window is still found.
  const trimmed = search.trim();
  const orderNumberQuery = /^#?\d{5}$/.test(trimmed) ? Number(trimmed.replace('#', '')) : undefined;
  const foundByNumber = useQuery(
    api.admin.findOrderByNumber,
    org && orderNumberQuery !== undefined ? { orgId: org._id, orderNumber: orderNumberQuery } : 'skip',
  );

  const updateShipping = useMutation(api.admin.updateShipping);
  const sel = useRowSelection();
  const bulk = useActionRunner();

  const loading = convexOrders === undefined;

  const entries: Entry[] = useMemo(() => {
    if (!convexOrders) return [];
    const rows: OrderDoc[] = [...convexOrders];
    if (foundByNumber && !rows.some((o) => o._id === foundByNumber._id)) rows.unshift(foundByNumber);
    return rows.map((order) => ({ order, stage: deriveOrderStage(order) }));
  }, [convexOrders, foundByNumber]);

  const counts = useMemo(() => {
    const out = {} as Record<StageFilter, number>;
    for (const f of STAGE_FILTERS) {
      out[f.id] = entries.filter((e) => matchesStageFilter(f.id, e.stage)).length;
    }
    return out;
  }, [entries]);

  const filtered = useMemo(() => {
    const q = trimmed.toLowerCase();
    const range = getDateRange(preset);
    return entries.filter(({ order, stage: s }) => {
      if (!matchesStageFilter(stage, s)) return false;
      if (!inDateRange(order.createdAt, range)) return false;
      return q === '' || orderSearchText(order).includes(q);
    });
  }, [entries, stage, preset, trimmed]);

  useEffect(() => setPage(1), [search, stage, preset]);

  const { pageItems, pageCount } = paginate(filtered, page, PAGE_SIZE);
  const current = Math.min(page, pageCount);
  const firstShown = filtered.length === 0 ? 0 : (current - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(current * PAGE_SIZE, filtered.length);
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
      cell: ({ stage: s }) => <StatusBadge stage={s} />,
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
              count={counts[f.id]}
              active={stage === f.id}
              onClick={() => setStage(f.id)}
            />
          ))}
        </FilterBar>

        {/* Desktop and tablet: dense table. */}
        <div className="hidden md:block">
          <DataTable<Entry>
            columns={columns}
            rows={loading ? undefined : pageItems}
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
          {!loading && pageItems.length === 0 && emptyState}
          {!loading && pageItems.length > 0 && (
            <ul className="divide-y divide-border">
              {pageItems.map(({ order, stage: s }) => {
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
                        <StatusBadge stage={s} />
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

        {!loading && filtered.length > 0 && (
          <Pagination
            page={current}
            pageCount={pageCount}
            onPageChange={setPage}
            summary={`${firstShown}–${lastShown} of ${filtered.length}`}
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
