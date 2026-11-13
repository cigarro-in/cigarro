import { Link } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { ArrowUpRight } from 'lucide-react';
import { Banner, Card, Page, Skeleton } from '../../adminnew/ui';
import { formatINR } from '../../utils/currency';
import { paiseToRupees } from '../../lib/convex/money';
import { useSa } from '../SuperGate';
import { platformOverviewRef, type PlatformOverview } from '../refs';
import { formatCount, formatDateTime } from '../saUi';

interface Tile {
  label: string;
  value: string;
  hint: string;
  to: string;
  attention?: boolean;
}

function tiles(o: PlatformOverview): Tile[] {
  return [
    {
      label: 'Stores',
      value: formatCount(o.storeCount),
      hint: `${formatCount(o.activeStoreCount)} active`,
      to: '/sa/stores',
    },
    {
      label: 'Orders today',
      value: formatCount(o.ordersToday),
      hint: `${formatCount(o.orders7d)} in the last 7 days`,
      to: '/sa/stores',
    },
    {
      label: 'Paid today',
      value: formatINR(paiseToRupees(o.gmvTodayPaise)),
      hint: `${formatINR(paiseToRupees(o.gmv7dPaise))} in the last 7 days`,
      to: '/sa/stores',
    },
    {
      label: 'Active stores without Gmail',
      value: formatCount(o.storesGmailNotConnected),
      hint: 'Bank alerts cannot match payments',
      to: '/sa/stores',
      attention: o.storesGmailNotConnected > 0,
    },
    {
      label: 'Domains not active',
      value: formatCount(o.domainsNotActive),
      hint: 'Pending, error or disabled',
      to: '/sa/domains',
      attention: o.domainsNotActive > 0,
    },
  ];
}

export function OverviewPage() {
  const { token } = useSa();
  const overview = useQuery(platformOverviewRef, { saToken: token });

  return (
    <Page title="Overview">
      {overview === undefined ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading overview">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-4 h-7 w-20" />
              <Skeleton className="mt-3 h-3 w-32" />
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tiles(overview).map((t) => (
              <Link
                key={t.label}
                to={t.to}
                className="group block rounded-[var(--admin-radius)] focus-visible:outline-none"
              >
                <Card className="h-full transition-colors group-hover:border-[var(--admin-border-strong)] group-focus-visible:outline-2 group-focus-visible:outline-[var(--admin-focus)]">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[13px] font-medium text-[var(--admin-text-muted)]">{t.label}</p>
                    <ArrowUpRight className="size-4 shrink-0 text-[var(--admin-text-subtle)] transition-colors group-hover:text-[var(--admin-text)]" aria-hidden />
                  </div>
                  <p
                    className={`mt-3 text-2xl font-semibold tracking-[-0.02em] tabular-nums ${
                      t.attention ? 'text-[var(--admin-warning)]' : 'text-[var(--admin-text)]'
                    }`}
                  >
                    {t.value}
                  </p>
                  <p className="mt-1 text-xs text-[var(--admin-text-muted)]">{t.hint}</p>
                </Card>
              </Link>
            ))}
          </div>
          <p className="px-1 text-xs text-[var(--admin-text-subtle)]">
            Paid orders (paid and late-paid) across all stores. Day boundaries use IST. Updated {formatDateTime(overview.generatedAt)}.
          </p>
        </>
      )}
      {overview === null && <Banner tone="critical">Could not load the overview.</Banner>}
    </Page>
  );
}
