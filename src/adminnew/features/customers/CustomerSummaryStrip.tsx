import type { ReactNode } from 'react';
import { formatINR } from '../../../utils/currency';
import { Card } from '../../ui';
import { formatMonthYear, type CustomerProfile } from './customerModel';

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 p-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-xl font-semibold tabular-nums text-foreground">{value}</span>
      {sub && <span className="truncate text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

/** Lifetime figures at a glance. Average is over paid orders only. */
export function CustomerSummaryStrip({ profile }: { profile: CustomerProfile }) {
  const { summary, referral } = profile;
  return (
    <Card padding="none">
      <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-6">
        <Stat
          label="Orders"
          value={summary.orderCount}
          sub={profile.ordersCapped ? 'Newest 200 counted' : undefined}
        />
        <Stat label="Total spent" value={formatINR(summary.totalSpent)} />
        <Stat label="Average order" value={formatINR(summary.averageOrder)} />
        <Stat
          label="Customer since"
          value={formatMonthYear(profile.createdAt)}
          sub={summary.lastOrderAt ? `Last order ${formatMonthYear(summary.lastOrderAt)}` : 'No orders yet'}
        />
        <Stat label="Wallet" value={formatINR(profile.walletBalance)} />
        {referral && (
          <Stat
            label="Referrals"
            value={referral.successfulReferrals}
            sub={`${referral.totalReferrals} invited · code ${referral.code}`}
          />
        )}
      </div>
    </Card>
  );
}
