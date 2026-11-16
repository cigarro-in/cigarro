import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '../../../../convex/_generated/api';
import { useOrg } from '../../../lib/convex/useOrg';
import { adminPath } from '../../lib/paths';
import { PlatformPaymentSheet } from '../setup/PlatformPaymentSheet';
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  Pagination,
  SkeletonTable,
  formatOrderDate,
  formatOrderNumber,
  type Column,
} from '../../ui';
import { cleanNote, feeRateLabel, moneyPaise } from './platformFeeFormat';

type Statement = FunctionReturnType<typeof api.platformFees.listStatement>;
type Row = Statement['rows'][number];

const PAGE_SIZE = 25;

/**
 * "Cigarro account": the store's bank-style account with the platform. Dues
 * (marketplace fees not yet paid), the security deposit held, and every entry
 * with a running balance. Balance is what the store owes Cigarro; a minus
 * sign means Cigarro owes the store.
 */
export function CigarroAccountTab() {
  const org = useOrg();
  const orgId = org?._id;

  const summary = useQuery(api.platformFees.getAccountSummary, orgId ? { orgId } : 'skip');

  // Cursor stack: the last entry is the page on screen. null = first page.
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [paying, setPaying] = useState(false);
  const cursor = cursors[cursors.length - 1];
  const pageNo = cursors.length;

  const statement = useQuery(
    api.platformFees.listStatement,
    orgId ? { orgId, cursor, limit: PAGE_SIZE } : 'skip',
  );
  const rows = statement?.rows;
  const nextCursor = statement?.nextCursor ?? null;

  const onPageChange = (target: number) => {
    if (target > pageNo && nextCursor) setCursors((c) => [...c, nextCursor]);
    if (target < pageNo) setCursors((c) => c.slice(0, -1));
  };

  const duesPaise = summary?.duesPaise ?? 0;

  return (
    <>
      <Card padding="none">
        {summary === undefined ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-4 py-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-[var(--admin-neutral-soft)]" />
            ))}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <p className="max-w-prose text-sm text-muted-foreground">
                A marketplace fee is added to your dues on every paid order. Pay dues to clear them.
              </p>
              {duesPaise > 0 && (
                <Button variant="primary" size="sm" onClick={() => setPaying(true)}>
                  Pay dues
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-4 py-4 sm:grid-cols-4">
              <Stat
                label="Dues to pay"
                value={moneyPaise(summary.duesPaise)}
                tone={summary.duesPaise > 0 ? 'critical' : undefined}
              />
              <Stat
                label="Security deposit held"
                value={moneyPaise(summary.depositHeldPaise)}
                hint={
                  summary.depositRequired && summary.depositDuePaise > 0
                    ? `${moneyPaise(summary.depositDuePaise)} still to pay`
                    : undefined
                }
              />
              <Stat label="Fees this month" value={moneyPaise(summary.feesThisMonthPaise)} />
              <Stat label="Marketplace fee rate" value={feeRateLabel(summary.feeBps)} />
            </div>
          </>
        )}
      </Card>

      <Card padding="none">
        {/* Desktop and tablet: bank-statement table. */}
        <div className="hidden md:block">
          <DataTable<Row>
            columns={statementColumns}
            rows={statement === undefined ? undefined : rows}
            getRowId={(r) => r.id}
            empty={emptyStatement}
          />
        </div>

        {/* Phones: compact stacked cards. */}
        <div className="md:hidden">
          {statement === undefined && <SkeletonTable rows={5} columns={2} />}
          {statement !== undefined && (rows ?? []).length === 0 && emptyStatement}
          {statement !== undefined && (rows ?? []).length > 0 && (
            <ul className="divide-y divide-border">
              {(rows ?? []).map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-xs tabular-nums text-muted-foreground">
                      {formatOrderDate(r.date, { withTime: true })}
                    </div>
                    <div className="text-sm text-foreground">{particularsOf(r)}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <AmountText row={r} />
                    <div className="text-xs tabular-nums text-muted-foreground">Balance {moneyPaise(r.balancePaise)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {statement !== undefined && (pageNo > 1 || nextCursor) && (
          <Pagination
            page={pageNo}
            hasNext={!!nextCursor}
            onPageChange={onPageChange}
            summary={`Page ${pageNo} · ${PAGE_SIZE} per page`}
          />
        )}
      </Card>

      <PlatformPaymentSheet
        open={paying}
        onOpenChange={setPaying}
        orgId={orgId}
        kind="dues"
      />
    </>
  );
}

const emptyStatement = (
  <EmptyState
    title="No entries yet"
    description="Marketplace fees, dues payments and the security deposit appear here, newest first."
  />
);

const statementColumns: Column<Row>[] = [
  {
    id: 'date',
    header: 'Date',
    width: 'w-36',
    cell: (r) => (
      <span className="whitespace-nowrap text-muted-foreground tabular-nums">
        {formatOrderDate(r.date, { withTime: true })}
      </span>
    ),
  },
  {
    id: 'particulars',
    header: 'Particulars',
    cell: (r) => particularsOf(r),
  },
  {
    id: 'credit',
    header: 'Credit',
    align: 'right',
    cell: (r) =>
      r.creditPaise > 0 ? (
        <span className="whitespace-nowrap font-medium tabular-nums text-success">{moneyPaise(r.creditPaise)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: 'debit',
    header: 'Debit',
    align: 'right',
    cell: (r) =>
      r.debitPaise > 0 ? (
        <span className="whitespace-nowrap font-medium tabular-nums text-destructive">{moneyPaise(r.debitPaise)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: 'balance',
    header: 'Balance',
    align: 'right',
    cell: (r) => (
      <span className={`whitespace-nowrap tabular-nums ${r.balancePaise < 0 ? 'text-success' : 'text-foreground'}`}>
        {moneyPaise(r.balancePaise)}
      </span>
    ),
  },
];

/** Mobile amount: credit in success colour, debit in destructive. */
function AmountText({ row }: { row: Row }) {
  if (row.creditPaise > 0) {
    return <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-success">+ {moneyPaise(row.creditPaise)}</span>;
  }
  if (row.debitPaise > 0) {
    return <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-destructive">− {moneyPaise(row.debitPaise)}</span>;
  }
  return <span className="text-muted-foreground">—</span>;
}

/** Plain-language particulars. Order numbers link to the order page. */
function particularsOf(r: Row): ReactNode {
  const order =
    r.orderId && r.orderNumber != null ? (
      <Link to={adminPath(`/orders/${r.orderId}`)} className="font-medium text-primary hover:underline">
        {formatOrderNumber(r.orderNumber)}
      </Link>
    ) : null;
  const depositTag = (
    <span className="mr-1.5 inline-flex items-center rounded-full bg-[var(--admin-neutral-soft)] px-2 py-0.5 text-xs font-medium text-[var(--admin-text-muted)]">
      Security deposit
    </span>
  );

  switch (r.kind) {
    case 'fee':
      return (
        <span>
          Marketplace fee {feeRateLabel(r.feeBps)}
          {order && <> on order {order}</>}
          {r.saleAmountPaise != null && (
            <span className="text-muted-foreground"> · sale {moneyPaise(r.saleAmountPaise)}</span>
          )}
        </span>
      );
    case 'fee_reversal':
      return (
        <span>
          Fee reversed
          {order && <> · order {order}</>}
        </span>
      );
    case 'deposit':
      return (
        <span>
          {depositTag}Deposit received
        </span>
      );
    case 'deposit_refund':
      return (
        <span>
          {depositTag}Deposit refunded
        </span>
      );
    case 'dues_payment':
      return (
        <span>
          Dues paid
          {r.utr && <span className="text-muted-foreground"> · UTR {r.utr}</span>}
        </span>
      );
    default:
      return <span>{cleanNote(r.particulars)}</span>;
  }
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
        className={`text-lg font-semibold tabular-nums ${tone === 'critical' ? 'text-destructive' : 'text-foreground'}`}
      >
        {value}
      </div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
