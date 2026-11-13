import { formatOrderDate } from '../../../lib/orders/format';
import { formatINR } from '../../../utils/currency';
import { Skeleton } from '../../ui';
import type { CustomerListRow } from './customerModel';

/** Phone layout for the customer list (the table is desktop only). */
export function CustomerCards({
  rows,
  loading,
  onOpen,
}: {
  rows: CustomerListRow[];
  loading: boolean;
  onOpen: (row: CustomerListRow) => void;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            onClick={() => onOpen(row)}
            aria-label={`Open customer ${row.name}`}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
          >
            <div className="min-w-0">
              <div className="truncate font-medium text-foreground">{row.name}</div>
              <div className="truncate text-sm tabular-nums text-muted-foreground">{row.phone || 'No phone'}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-medium tabular-nums">{formatINR(row.totalSpent)}</div>
              <div className="text-xs text-muted-foreground">
                {row.orderCount} {row.orderCount === 1 ? 'order' : 'orders'}
                {row.lastOrderDate ? ` · ${formatOrderDate(row.lastOrderDate)}` : ''}
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
