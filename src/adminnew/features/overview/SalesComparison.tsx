import type { ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { formatINR } from '../../../utils/currency';
import { Card } from '../../ui';

/** Percent change vs yesterday, or null when there is nothing to compare. */
export function percentChange(today: number, yesterday: number): number | null {
  if (yesterday === 0) return null;
  return Math.round(((today - yesterday) / yesterday) * 100);
}

function Change({ today, yesterday }: { today: number; yesterday: number }) {
  if (today === 0 && yesterday === 0) return <span>No sales yet</span>;
  const pct = percentChange(today, yesterday);
  if (pct === null) return <span>New vs yesterday</span>;
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="size-3.5" aria-hidden />
      {up ? '+' : ''}
      {pct}% vs yesterday
    </span>
  );
}

function Cell({ label, value, sub }: { label: string; value: ReactNode; sub: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 p-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-xl font-semibold tabular-nums text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </div>
  );
}

/** Today against yesterday for sales and orders. Paid orders count toward sales. */
export function SalesComparison({
  todayRevenue,
  yesterdayRevenue,
  todayOrders,
  yesterdayOrders,
}: {
  todayRevenue: number;
  yesterdayRevenue: number;
  todayOrders: number;
  yesterdayOrders: number;
}) {
  return (
    <Card padding="none">
      <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
        <Cell
          label="Sales today"
          value={formatINR(todayRevenue)}
          sub={<Change today={todayRevenue} yesterday={yesterdayRevenue} />}
        />
        <Cell label="Sales yesterday" value={formatINR(yesterdayRevenue)} sub="Paid orders" />
        <Cell
          label="Orders today"
          value={todayOrders}
          sub={<Change today={todayOrders} yesterday={yesterdayOrders} />}
        />
        <Cell label="Orders yesterday" value={yesterdayOrders} sub="All placed orders" />
      </div>
    </Card>
  );
}
