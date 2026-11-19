import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '../../../../convex/_generated/api';
import { useOrg } from '../../../lib/convex/useOrg';
import { paiseToRupees } from '../../../lib/convex/money';
import { formatINR } from '../../../utils/currency';
import { usePageSize, useCursorPages } from '../../hooks/usePagination';
import {
  Card,
  DataTable,
  DateRangePresets,
  EmptyState,
  FilterBar,
  Pagination,
  formatOrderDate,
  formatOrderNumber,
  getDateRange,
  type Column,
  type DateRangePreset,
} from '../../ui';
import { moneyPaise, type OrderFeeView } from './platformFeeFormat';

type Statement = FunctionReturnType<typeof api.payments.listStatement>;
type Entry = Statement['entries'][number];

/** Bank-statement view of credits (orders paid by bank email) and refunds (debits). */
export function StatementTab() {
  const [preset, setPreset] = useState<DateRangePreset>('this_month');
  // Keyed by preset so changing the range starts a fresh cursor chain.
  return <StatementList key={preset} preset={preset} onPresetChange={setPreset} />;
}

function StatementList({
  preset,
  onPresetChange,
}: {
  preset: DateRangePreset;
  onPresetChange: (p: DateRangePreset) => void;
}) {
  const org = useOrg();
  const range = getDateRange(preset);
  const [pageSize, setPageSize] = usePageSize('paymentsStatement');
  const pages = useCursorPages(JSON.stringify({ preset, pageSize }));

  const data = useQuery(
    api.payments.listStatement,
    org
      ? {
          orgId: org._id,
          from: range.from ?? undefined,
          // Range `to` is exclusive in the UI; the statement query is inclusive.
          to: range.to !== null ? range.to - 1 : undefined,
          cursor: pages.cursor ?? undefined,
          limit: pageSize,
        }
      : 'skip',
  );

  const rows: Entry[] | undefined = data?.entries;
  const next = data?.nextCursor ?? null;
  const totals = data?.totals;

  const onPageChange = (target: number) => {
    if (target > pages.page && next) pages.next(next);
    else if (target < pages.page) pages.prev();
  };

  // Marketplace fee per credited sale on the loaded rows (paid orders only).
  const feeOrderIds = Array.from(
    new Set((rows ?? []).filter((e) => e.kind === 'order_credit').map((e) => e.orderId)),
  ).slice(0, 200);
  const fees = useQuery(
    api.platformFees.getOrderFees,
    org && feeOrderIds.length > 0 ? { orgId: org._id, orderIds: feeOrderIds } : 'skip',
  );

  const columns: Column<Entry>[] = [
    {
      id: 'when',
      header: 'Date',
      cell: (e) => (
        <span className="whitespace-nowrap text-muted-foreground tabular-nums">
          {formatOrderDate(e.at, { withTime: true })}
        </span>
      ),
    },
    {
      id: 'what',
      header: 'Entry',
      cell: (e) => <EntryLabel entry={e} fee={fees?.[e.orderId] as OrderFeeView | null | undefined} />,
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (e) => {
        const credit = e.kind === 'order_credit';
        return (
          <span
            className={`whitespace-nowrap font-medium tabular-nums ${
              credit ? 'text-success' : 'text-destructive'
            }`}
          >
            {credit ? '+' : '−'} {formatINR(paiseToRupees(e.amountPaise))}
          </span>
        );
      },
    },
  ];

  return (
    <Card padding="none">
      <FilterBar>
        <DateRangePresets value={preset} onChange={(p) => onPresetChange(p)} />
      </FilterBar>

      {totals && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-b border-border px-4 py-3 sm:grid-cols-4">
          <Stat label="Received" value={formatINR(paiseToRupees(totals.creditedPaise))} />
          <Stat
            label="Refunded"
            value={formatINR(paiseToRupees(totals.refundedPaise))}
            hint={
              totals.walletRefundedPaise > 0
                ? `Wallet ${formatINR(paiseToRupees(totals.walletRefundedPaise))}`
                : undefined
            }
          />
          {totals.feePaise > 0 && (
            <Stat label="Fees" value={formatINR(paiseToRupees(totals.feePaise))} />
          )}
          <Stat
            label="Net"
            value={formatINR(paiseToRupees(totals.netPaise))}
            tone={totals.netPaise < 0 ? 'critical' : undefined}
          />
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(e) => e.key}
        empty={<EmptyState title="No payments in this period" />}
      />

      {rows && rows.length > 0 && (
        <Pagination
          page={pages.page}
          hasNext={!!next}
          onPageChange={onPageChange}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        />
      )}
    </Card>
  );
}

function EntryLabel({ entry: e, fee }: { entry: Entry; fee?: OrderFeeView | null }) {
  if (e.kind === 'order_credit') {
    return (
      <div className="min-w-0">
        <div className="text-sm text-foreground">
          Order{' '}
          <Link to={`/orders/${e.orderId}`} className="font-medium text-primary hover:underline">
            {formatOrderNumber(e.orderNumber) || '—'}
          </Link>{' '}
          credited
        </div>
        {e.senderEmail && <div className="truncate text-xs text-muted-foreground">{e.senderEmail}</div>}
        {fee && (
          <div className="text-xs tabular-nums text-muted-foreground">
            {fee.reversed ? 'Fee reversed' : `Marketplace fee −${moneyPaise(fee.feePaise)}`}
          </div>
        )}
      </div>
    );
  }
  if (e.kind === 'refund') {
    const where =
      e.destination === 'wallet' ? 'to wallet' : e.destination === 'bank' ? 'to bank' : null;
    return (
      <div className="text-sm text-foreground">
        Order{' '}
        <Link to={`/orders/${e.orderId}`} className="font-medium text-primary hover:underline">
          {formatOrderNumber(e.orderNumber) || '—'}
        </Link>{' '}
        refunded{where ? ` ${where}` : ''}
      </div>
    );
  }
  return <div className="text-sm text-foreground">Platform fee</div>;
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'critical';
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`text-lg font-semibold tabular-nums ${
          tone === 'critical' ? 'text-destructive' : 'text-foreground'
        }`}
      >
        {value}
      </div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
