import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAction, useMutation, useQuery } from 'convex/react';
import { Banner, Card, ConfirmDialog, EmptyState, FilterBar, Page, Skeleton, Tabs, useButtonFeedback } from '../../adminnew/ui';
import { useSa } from '../SuperGate';
import { runSa, StoreStateBadge } from '../saUi';
import { DomainList, PRIMARY_WARNING } from '../DomainList';
import { listAllDomainsRef, refreshDomainStatusRef, removeDomainRef, setPrimaryRef, type AllDomainRow, type DomainStatus } from '../refs';

type View = 'all' | 'attention';

// Problems first inside each store: error, pending, disabled, active.
const RANK: Record<DomainStatus, number> = { error: 0, pending: 1, disabled: 2, active: 3 };

interface Group {
  orgId: string;
  storeName: string;
  storeActive: boolean;
  domains: AllDomainRow[];
  problems: number;
}

// Every web address on the platform, grouped by store. The owner comes here to
// see which addresses are not live yet and nudge them.
export function DomainsPage() {
  const { token, writeOpen } = useSa();
  const domains = useQuery(listAllDomainsRef, { saToken: token });
  const refresh = useAction(refreshDomainStatusRef);
  const setPrimary = useMutation(setPrimaryRef);
  const removeDomain = useAction(removeDomainRef);
  const fb = useButtonFeedback();

  const [view, setView] = useState<View>('all');
  const [q, setQ] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [primaryTarget, setPrimaryTarget] = useState<AllDomainRow | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AllDomainRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const groups = useMemo<Group[]>(() => {
    const byStore = new Map<string, Group>();
    for (const d of domains ?? []) {
      let g = byStore.get(d.orgId);
      if (!g) {
        g = { orgId: d.orgId, storeName: d.storeName, storeActive: d.storeActive, domains: [], problems: 0 };
        byStore.set(d.orgId, g);
      }
      g.domains.push(d);
      if (d.status !== 'active') g.problems++;
    }
    for (const g of byStore.values()) {
      g.domains.sort((a, b) => RANK[a.status] - RANK[b.status] || a.hostname.localeCompare(b.hostname));
    }
    return [...byStore.values()].sort((a, b) => b.problems - a.problems || a.storeName.localeCompare(b.storeName));
  }, [domains]);

  const attentionCount = useMemo(() => groups.reduce((n, g) => n + g.problems, 0), [groups]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        domains: g.domains.filter((d) => {
          if (view === 'attention' && d.status === 'active') return false;
          if (!needle) return true;
          return d.hostname.toLowerCase().includes(needle) || g.storeName.toLowerCase().includes(needle);
        }),
      }))
      .filter((g) => g.domains.length > 0);
  }, [groups, view, q]);

  const onRefresh = async (d: AllDomainRow) => {
    setBusyId(d._id);
    const res = await fb.run(() => runSa(() => refresh({ saToken: token, domainId: d._id })));
    setBusyId(null);
    if (res !== undefined) setNotice(`Checked ${d.hostname} again.`);
  };

  return (
    <Page title="Domains">
      {notice && (
        <Banner tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </Banner>
      )}
      {fb.error && <Banner tone="critical">{fb.error.message}</Banner>}

      <Card padding="none">
        <Tabs<View>
          value={view}
          onChange={setView}
          tabs={[
            { id: 'all', label: 'All addresses', count: domains?.length },
            { id: 'attention', label: 'Not live yet', count: attentionCount },
          ]}
        />
        <FilterBar search={{ value: q, onChange: setQ, placeholder: 'Search address or store' }} />
      </Card>

      {domains === undefined ? (
        <div className="grid items-start gap-3 xl:grid-cols-2" aria-busy="true" aria-label="Loading domains">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-4 h-10 w-full" />
              <Skeleton className="mt-2 h-10 w-full" />
            </Card>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card>
          {domains.length === 0 ? (
            <EmptyState title="No web addresses yet" description="Each store's addresses appear here once it has one." />
          ) : view === 'attention' && !q ? (
            <EmptyState title="Every address is live" description="Addresses that are still connecting or failing show up here." />
          ) : (
            <EmptyState title="Nothing matches" description="Clear the search or switch to all addresses." />
          )}
        </Card>
      ) : (
        <div className="grid items-start gap-3 xl:grid-cols-2">
          {visible.map((g) => (
            <Card
              key={g.orgId}
              padding="none"
              title={
                <span className="flex items-center gap-2">
                  <Link to={`/sa/stores/${g.orgId}?tab=domains`} className="truncate hover:underline">
                    {g.storeName}
                  </Link>
                  {!g.storeActive && <StoreStateBadge active={false} />}
                </span>
              }
              actions={
                <span className="text-xs text-[var(--admin-text-muted)]">
                  {g.problems === 0 ? 'All live' : `${g.problems} not live`}
                </span>
              }
            >
              <DomainList
                domains={g.domains}
                writeOpen={writeOpen}
                busyId={busyId}
                onRefresh={(d) => void onRefresh(d)}
                onMakePrimary={setPrimaryTarget}
                onRemove={setRemoveTarget}
              />
            </Card>
          ))}
        </div>
      )}

      <p className="max-w-prose px-1 text-xs text-[var(--admin-text-muted)]">
        Addresses are checked automatically every 15 minutes. New ones usually go live within an hour of the DNS record being added.
      </p>

      <ConfirmDialog
        open={primaryTarget !== null}
        onOpenChange={(o) => {
          if (!o) setPrimaryTarget(null);
        }}
        title={`Make ${primaryTarget?.hostname ?? 'this'} the main address?`}
        description={PRIMARY_WARNING}
        confirmLabel="Make main address"
        onConfirm={async () => {
          if (!primaryTarget) return;
          const d = primaryTarget;
          await runSa(() => setPrimary({ saToken: token, domainId: d._id }));
          setNotice(`${d.hostname} is now the main address of ${d.storeName}.`);
        }}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(o) => {
          if (!o) setRemoveTarget(null);
        }}
        title={`Remove ${removeTarget?.hostname ?? 'this address'}?`}
        description={[
          `Visitors on this address stop reaching ${removeTarget?.storeName ?? 'the store'}.`,
          removeTarget?.kind === 'primary' ? 'Another address of this store becomes the main one.' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        confirmLabel="Remove address"
        critical
        onConfirm={async () => {
          if (!removeTarget) return;
          const d = removeTarget;
          await runSa(() => removeDomain({ saToken: token, domainId: d._id }));
          setNotice(`Removed ${d.hostname}.`);
        }}
      />
    </Page>
  );
}
