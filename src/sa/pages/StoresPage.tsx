import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { MoreHorizontal } from 'lucide-react';
import {
  Badge,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Dialog,
  EmptyState,
  FilterBar,
  FilterSelect,
  Input,
  Label,
  Menu,
  Page,
  useButtonFeedback,
  type Column,
} from '../../adminnew/ui';
import { useSa } from '../SuperGate';
import { runSa, DomainStatusBadge, formatCount, StoreStateBadge } from '../saUi';
import {
  createStoreRef,
  listStoreStatsRef,
  listStoresRef,
  setStoreActiveRef,
  type StoreRow,
  type StoreStatsRow,
} from '../refs';

type StatusFilter = 'all' | 'active' | 'suspended';

interface Joined extends StoreRow {
  stats: StoreStatsRow | undefined;
}

export function StoresPage() {
  const { token, writeOpen } = useSa();
  const navigate = useNavigate();
  const stores = useQuery(listStoresRef, { saToken: token });
  const stats = useQuery(listStoreStatsRef, { saToken: token });
  const createStore = useMutation(createStoreRef);
  const setActive = useMutation(setStoreActiveRef);

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Joined | null>(null);

  const create = useButtonFeedback();
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [upiVpa, setUpiVpa] = useState('');

  const rows = useMemo<Joined[] | undefined>(() => {
    if (!stores) return undefined;
    const byOrg = new Map((stats ?? []).map((s) => [s.orgId, s]));
    return stores.map((s) => ({ ...s, stats: byOrg.get(s._id) }));
  }, [stores, stats]);

  const filtered = useMemo(() => {
    if (!rows) return undefined;
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter === 'active' && !r.active) return false;
      if (statusFilter === 'suspended' && r.active) return false;
      if (!needle) return true;
      return (
        r.name.toLowerCase().includes(needle) ||
        r.slug.toLowerCase().includes(needle) ||
        (r.primaryHost ?? '').toLowerCase().includes(needle)
      );
    });
  }, [rows, q, statusFilter]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    const createdSlug = slug;
    const created = await create.run(() =>
      runSa(() => createStore({ saToken: token, slug, name, upiVpa: upiVpa || undefined })),
    );
    if (created === undefined) return;
    setNotice(`Created store "${createdSlug}". Add its domain and members next.`);
    setSlug('');
    setName('');
    setUpiVpa('');
    setCreateOpen(false);
    create.reset();
  };

  const confirmToggle = async () => {
    if (!toggleTarget) return;
    const target = toggleTarget;
    await runSa(() => setActive({ saToken: token, orgId: target._id, active: !target.active }));
    setNotice(target.active ? `Suspended ${target.slug}.` : `Activated ${target.slug}.`);
  };

  const columns: Column<Joined>[] = [
    {
      id: 'store',
      header: 'Store',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-[var(--admin-text)]">{r.name}</p>
          <p className="truncate font-mono text-xs text-[var(--admin-text-muted)]">{r.slug}</p>
        </div>
      ),
    },
    {
      id: 'theme',
      header: 'Theme',
      hideBelow: 'md',
      cell: (r) =>
        r.stats?.theme ? (
          <Badge tone="neutral">{r.stats.theme}</Badge>
        ) : (
          <span className="text-[var(--admin-text-subtle)]">None</span>
        ),
    },
    {
      id: 'domain',
      header: 'Primary domain',
      cell: (r) =>
        r.primaryHost ? (
          <div className="flex min-w-0 flex-col items-start gap-1">
            <span className="max-w-full truncate font-mono text-[13px]">{r.primaryHost}</span>
            {r.primaryStatus && <DomainStatusBadge status={r.primaryStatus} />}
          </div>
        ) : (
          <span className="text-[var(--admin-text-subtle)]">No domain</span>
        ),
    },
    {
      id: 'orders',
      header: 'Orders, 7 days',
      align: 'right',
      hideBelow: 'sm',
      cell: (r) => <span className="tabular-nums">{formatCount(r.stats?.orders7d ?? 0)}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => <StoreStateBadge active={r.active} />,
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      width: '3rem',
      cell: (r) => (
        // Keep row-click navigation off the menu trigger.
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Menu
            align="end"
            trigger={
              <Button variant="plain" size="icon" aria-label={`Actions for ${r.name}`}>
                <MoreHorizontal aria-hidden />
              </Button>
            }
            items={[
              { label: 'Manage store', onSelect: () => navigate(`/sa/stores/${r._id}`) },
              { label: 'Catalog import', onSelect: () => navigate(`/sa/stores/${r._id}/import`) },
              {
                label: r.active ? 'Suspend store' : 'Activate store',
                tone: r.active ? 'critical' : 'default',
                disabled: !writeOpen,
                onSelect: () => setToggleTarget(r),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <Page
      title="Stores"
      titleMeta={
        rows ? <span className="text-sm font-normal tabular-nums text-[var(--admin-text-muted)]">{formatCount(rows.length)}</span> : undefined
      }
      primaryAction={{ label: 'Create store', onClick: () => setCreateOpen(true), disabled: !writeOpen }}
    >
      {notice && (
        <Banner tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </Banner>
      )}

      <Card padding="none">
        <FilterBar
          search={{ value: q, onChange: setQ, placeholder: 'Search name, slug or domain' }}
          end={
            <FilterSelect<StatusFilter>
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'All stores' },
                { value: 'active', label: 'Active' },
                { value: 'suspended', label: 'Suspended' },
              ]}
            />
          }
        />
        <DataTable
          columns={columns}
          rows={filtered}
          getRowId={(r) => r._id}
          onRowClick={(r) => navigate(`/sa/stores/${r._id}`)}
          rowLabel={(r) => `Manage ${r.name}`}
          empty={
            (rows?.length ?? 0) === 0 ? (
              <EmptyState
                title="No stores yet"
                description="Create the first store, then add its domain and members."
                action={
                  <Button variant="primary" onClick={() => setCreateOpen(true)} disabled={!writeOpen}>
                    Create store
                  </Button>
                }
              />
            ) : (
              <EmptyState title="No stores match" description="Clear the search or status filter." />
            )
          }
        />
      </Card>

      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) create.reset();
        }}
        title="Create store"
        description="The bank alias is derived from the slug. The UPI VPA can be added now or later."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={create.busy}>
              Cancel
            </Button>
            <Button type="submit" form="sa-create-store" variant="primary" state={create.state} disabled={!writeOpen}>
              Create store
            </Button>
          </>
        }
      >
        <form id="sa-create-store" onSubmit={onCreate} className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="sa-slug">Slug</Label>
            <Input
              id="sa-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="my-store"
              required
              disabled={!writeOpen || create.busy}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sa-name">Name</Label>
            <Input id="sa-name" value={name} onChange={(e) => setName(e.target.value)} required disabled={!writeOpen || create.busy} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sa-vpa">UPI VPA (optional)</Label>
            <Input
              id="sa-vpa"
              value={upiVpa}
              onChange={(e) => setUpiVpa(e.target.value)}
              placeholder="store@ybl"
              disabled={!writeOpen || create.busy}
            />
          </div>
          {create.error && <Banner tone="critical">{create.error.message}</Banner>}
        </form>
      </Dialog>

      <ConfirmDialog
        open={toggleTarget !== null}
        onOpenChange={(o) => {
          if (!o) setToggleTarget(null);
        }}
        title={toggleTarget?.active ? `Suspend ${toggleTarget.name}?` : `Activate ${toggleTarget?.name ?? 'store'}?`}
        description={
          toggleTarget?.active
            ? 'A suspended store stops serving customers and taking payments until it is activated again. Nothing is deleted.'
            : 'The store resumes serving customers on its domains.'
        }
        confirmLabel={toggleTarget?.active ? 'Suspend store' : 'Activate store'}
        critical={!!toggleTarget?.active}
        onConfirm={confirmToggle}
      />
    </Page>
  );
}
