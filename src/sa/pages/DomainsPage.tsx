import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAction, useMutation, useQuery } from 'convex/react';
import { MoreHorizontal } from 'lucide-react';
import {
  Banner,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  FilterBar,
  Menu,
  Page,
  Tabs,
  useButtonFeedback,
  type Column,
} from '../../adminnew/ui';
import { useSa } from '../SuperGate';
import { DnsRecords, DomainStatusBadge, ManagedTag, relativeTime, runSa } from '../saUi';
import {
  listAllDomainsRef,
  refreshDomainStatusRef,
  removeDomainRef,
  setPrimaryRef,
  type AllDomainRow,
  type DomainStatus,
} from '../refs';

const PRIMARY_WARNING =
  "Switching primary moves canonical URLs to that domain. Only do this after the merchant's DNS points there.";

type View = 'all' | 'active' | 'pending' | 'error';

// Sort problems first: error, then pending, disabled, active.
const RANK: Record<DomainStatus, number> = { error: 0, pending: 1, disabled: 2, active: 3 };

export function DomainsPage() {
  const { token, writeOpen } = useSa();
  const navigate = useNavigate();
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

  const rows = useMemo(
    () =>
      [...(domains ?? [])].sort(
        (a, b) =>
          RANK[a.status] - RANK[b.status] ||
          a.storeName.localeCompare(b.storeName) ||
          a.hostname.localeCompare(b.hostname),
      ),
    [domains],
  );

  const counts = useMemo(() => {
    const c = { all: rows.length, active: 0, pending: 0, error: 0 };
    for (const r of rows) {
      if (r.status === 'active') c.active++;
      else if (r.status === 'pending') c.pending++;
      else if (r.status === 'error') c.error++;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (view === 'active' && r.status !== 'active') return false;
      if (view === 'pending' && r.status !== 'pending') return false;
      if (view === 'error' && r.status !== 'error') return false;
      if (!needle) return true;
      return r.hostname.toLowerCase().includes(needle) || r.storeName.toLowerCase().includes(needle);
    });
  }, [rows, view, q]);

  // Row menu actions: errors land in the page banner (fb.error), never thrown.
  const runRow = async (d: AllDomainRow, fn: () => Promise<unknown>, ok: string) => {
    setBusyId(d._id);
    const res = await fb.run(() => runSa(fn));
    setBusyId(null);
    if (res !== undefined) setNotice(ok);
  };

  const columns: Column<AllDomainRow>[] = [
    {
      id: 'host',
      header: 'Hostname',
      cell: (d) => (
        <div className="min-w-0">
          <p className="truncate font-mono text-[13px] text-[var(--admin-text)]">{d.hostname}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--admin-text-muted)]">
            <span className="capitalize">{d.kind}</span>
            <ManagedTag managed={d.managed} />
          </div>
          {d.status === 'pending' && d.dnsInstructions && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer font-medium text-[var(--admin-primary)]">DNS records</summary>
              <div className="mt-2">
                <DnsRecords hostname={d.hostname} cnameTarget={d.dnsInstructions.cnameTarget} txtRecords={d.dnsInstructions.txtRecords} />
              </div>
            </details>
          )}
        </div>
      ),
    },
    {
      id: 'store',
      header: 'Store',
      cell: (d) => (
        <div className="min-w-0">
          <Link to={`/sa/stores/${d.orgId}`} className="block truncate font-medium text-[var(--admin-text)] hover:underline">
            {d.storeName}
          </Link>
          {!d.storeActive && <span className="text-xs text-[var(--admin-text-muted)]">Suspended</span>}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (d) => (
        <div className="flex min-w-0 flex-col items-start gap-1">
          <DomainStatusBadge status={d.status} />
          {d.cfError && <p className="max-w-xs break-words text-xs text-[var(--admin-critical)]">{d.cfError}</p>}
        </div>
      ),
    },
    {
      id: 'cf',
      header: 'Cloudflare',
      hideBelow: 'lg',
      cell: (d) => (
        <span className="font-mono text-xs text-[var(--admin-text-muted)]">{d.cfManaged ? (d.cfStatus ?? 'Not synced') : 'Platform'}</span>
      ),
    },
    {
      id: 'checked',
      header: 'Checked',
      hideBelow: 'md',
      cell: (d) => <span className="whitespace-nowrap text-[13px] text-[var(--admin-text-muted)]">{relativeTime(d.cfCheckedAt)}</span>,
    },
    {
      id: 'active',
      header: 'Last active',
      hideBelow: 'lg',
      cell: (d) => <span className="whitespace-nowrap text-[13px] text-[var(--admin-text-muted)]">{relativeTime(d.lastActiveAt)}</span>,
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      width: '3rem',
      cell: (d) => {
        const busy = busyId === d._id;
        return (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <Menu
              align="end"
              trigger={
                <Button variant="plain" size="icon" aria-label={`Actions for ${d.hostname}`} disabled={busy}>
                  <MoreHorizontal aria-hidden />
                </Button>
              }
              items={[
                { label: `Open ${d.storeName}`, onSelect: () => navigate(`/sa/stores/${d.orgId}`) },
                ...(d.cfManaged
                  ? [
                      {
                        label: 'Refresh now',
                        disabled: !writeOpen || busy,
                        onSelect: () => void runRow(d, () => refresh({ saToken: token, domainId: d._id }), `Refreshed ${d.hostname}.`),
                      },
                    ]
                  : []),
                ...(d.status === 'active' && d.kind === 'alias' && d.cfManaged
                  ? [{ label: 'Make primary', disabled: !writeOpen || busy, onSelect: () => setPrimaryTarget(d) }]
                  : []),
                { label: 'Remove domain', tone: 'critical' as const, disabled: !writeOpen || busy, onSelect: () => setRemoveTarget(d) },
              ]}
            />
          </div>
        );
      },
    },
  ];

  return (
    <Page
      title="Domains"
      titleMeta={
        domains ? <span className="text-sm font-normal tabular-nums text-[var(--admin-text-muted)]">{counts.all}</span> : undefined
      }
    >
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
            { id: 'all', label: 'All', count: counts.all },
            { id: 'active', label: 'Active', count: counts.active },
            { id: 'pending', label: 'Pending', count: counts.pending },
            { id: 'error', label: 'Error', count: counts.error },
          ]}
        />
        <FilterBar search={{ value: q, onChange: setQ, placeholder: 'Search hostname or store' }} />
        <DataTable
          columns={columns}
          rows={domains === undefined ? undefined : filtered}
          getRowId={(d) => d._id}
          empty={
            (domains?.length ?? 0) === 0 ? (
              <EmptyState title="No domains yet" description="Domains appear here once a store has one." />
            ) : (
              <EmptyState title="No domains match" description="Try another status tab or clear the search." />
            )
          }
        />
      </Card>

      <p className="px-1 text-xs text-[var(--admin-text-muted)]">
        Status comes from Cloudflare Pages and is rechecked every 15 minutes (active domains every 6 hours). Nothing here sets status by hand.
      </p>

      <ConfirmDialog
        open={primaryTarget !== null}
        onOpenChange={(o) => {
          if (!o) setPrimaryTarget(null);
        }}
        title={`Make ${primaryTarget?.hostname ?? 'domain'} primary?`}
        description={`${primaryTarget?.storeName ?? 'This store'} canonical URLs move to this domain. ${PRIMARY_WARNING}`}
        confirmLabel="Make primary"
        onConfirm={async () => {
          if (!primaryTarget) return;
          const d = primaryTarget;
          await runSa(() => setPrimary({ saToken: token, domainId: d._id }));
          setNotice(`${d.hostname} is now the primary domain.`);
        }}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(o) => {
          if (!o) setRemoveTarget(null);
        }}
        title={`Remove ${removeTarget?.hostname ?? 'domain'}?`}
        description={[
          `It is removed from ${removeTarget?.storeName ?? 'the store'}.`,
          removeTarget?.cfManaged ? 'It is removed from Cloudflare Pages too.' : '',
          removeTarget?.kind === 'primary' ? 'It is the primary, so another domain of this store is promoted.' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        confirmLabel="Remove domain"
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
