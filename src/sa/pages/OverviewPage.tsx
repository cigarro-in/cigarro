import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { Banner, Card, EmptyState, Page, PageLayout, Skeleton } from '../../adminnew/ui';
import { formatINR } from '../../utils/currency';
import { paiseToRupees } from '../../lib/convex/money';
import { useSa } from '../SuperGate';
import { listStoreStatsRef, listStoresRef, platformOverviewRef } from '../refs';
import { storeChecks, type CheckId } from '../health';
import { StatTile, StoreStateBadge, formatCount, formatDateTime } from '../saUi';

// Where each failed check is fixed on the store page.
const FIX_TAB: Record<CheckId, string> = { domain: 'domains', gmail: 'overview', upi: 'overview' };

// What the owner comes here for: is money coming in, and is anything broken.
export function OverviewPage() {
  const { token } = useSa();
  const overview = useQuery(platformOverviewRef, { saToken: token });
  const stores = useQuery(listStoresRef, { saToken: token });
  const stats = useQuery(listStoreStatsRef, { saToken: token });

  const issues = useMemo(() => {
    if (!stores || !stats) return undefined;
    const byOrg = new Map(stats.map((s) => [s.orgId, s]));
    return stores
      .filter((s) => s.active)
      .flatMap((s) =>
        storeChecks(s, byOrg.get(s._id))
          .filter((c) => !c.ok)
          .map((c) => ({ key: `${s._id}-${c.id}`, store: s, check: c })),
      );
  }, [stores, stats]);

  const storeRows = useMemo(() => {
    if (!stores) return undefined;
    const byOrg = new Map((stats ?? []).map((s) => [s.orgId, s]));
    return stores
      .map((s) => ({ store: s, orders7d: byOrg.get(s._id)?.orders7d ?? 0 }))
      .sort((a, b) => Number(b.store.active) - Number(a.store.active) || b.orders7d - a.orders7d);
  }, [stores, stats]);

  return (
    <Page title="Overview">
      {overview === undefined ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true" aria-label="Loading overview">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-7 w-20" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Stores open"
            value={formatCount(overview.activeStoreCount)}
            hint={`of ${formatCount(overview.storeCount)} stores`}
          />
          <StatTile label="Paid orders today" value={formatCount(overview.ordersToday)} hint={`${formatCount(overview.orders7d)} this week`} />
          <StatTile label="Sales today" value={formatINR(paiseToRupees(overview.gmvTodayPaise))} hint="All stores" />
          <StatTile label="Sales last 7 days" value={formatINR(paiseToRupees(overview.gmv7dPaise))} hint={`Updated ${formatDateTime(overview.generatedAt)}`} />
        </div>
      )}
      {overview === null && <Banner tone="critical">Could not load the overview.</Banner>}

      <PageLayout
        main={
          <Card title="Needs attention" padding="none">
            {issues === undefined ? (
              <div className="space-y-3 p-4" aria-busy="true">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : issues.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 aria-hidden />}
                title="Every open store is set up"
                description="Websites are live, payments are tracked and UPI is set. Problems show up here."
              />
            ) : (
              <ul className="divide-y divide-[var(--admin-border)]">
                {issues.map(({ key, store, check }) => (
                  <li key={key}>
                    <Link
                      to={`/sa/stores/${store._id}?tab=${FIX_TAB[check.id]}`}
                      className="group flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-[var(--admin-surface-subtle)]"
                    >
                      <span aria-hidden className="size-2 shrink-0 rounded-full bg-[var(--admin-warning)]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[var(--admin-text)]">{store.name}</span>
                        <span className="block truncate text-[13px] text-[var(--admin-text-muted)]">{check.problem}</span>
                      </span>
                      <span className="shrink-0 text-[13px] font-medium text-[var(--admin-primary)]">Fix</span>
                      <ChevronRight className="size-4 shrink-0 text-[var(--admin-text-subtle)]" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        }
        aside={
          <Card
            title="Stores"
            padding="none"
            actions={
              <Link to="/sa/stores" className="text-[13px] font-medium text-[var(--admin-primary)] hover:underline">
                All stores
              </Link>
            }
          >
            {storeRows === undefined ? (
              <div className="space-y-3 p-4" aria-busy="true">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <ul className="divide-y divide-[var(--admin-border)]">
                {storeRows.slice(0, 8).map(({ store, orders7d }) => (
                  <li key={store._id}>
                    <Link
                      to={`/sa/stores/${store._id}`}
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-[var(--admin-surface-subtle)]"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--admin-text)]">{store.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-[var(--admin-text-muted)]">{formatCount(orders7d)} orders this week</span>
                      {!store.active && <StoreStateBadge active={false} />}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        }
      />
    </Page>
  );
}
