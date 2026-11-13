import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { ExternalLink, MoreHorizontal } from 'lucide-react';
import {
  Banner,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  EmptyState,
  FilterBar,
  FilterSelect,
  Input,
  Label,
  Menu,
  Page,
  Skeleton,
  useButtonFeedback,
} from '../../adminnew/ui';
import { formatINR } from '../../utils/currency';
import { paiseToRupees } from '../../lib/convex/money';
import { useSa } from '../SuperGate';
import { runSa, formatCount, HealthDot, StoreStateBadge } from '../saUi';
import { storeAdminUrl, storeChecks, storeLiveUrl } from '../health';
import {
  createStoreRef,
  listStoreStatsRef,
  listStoresRef,
  setStoreActiveRef,
  type StoreRow,
  type StoreStatsRow,
} from '../refs';

type StatusFilter = 'all' | 'active' | 'suspended' | 'attention';

interface Joined extends StoreRow {
  stats: StoreStatsRow | undefined;
  problems: number;
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
    return stores
      .map((s) => {
        const st = byOrg.get(s._id);
        return { ...s, stats: st, problems: st ? storeChecks(s, st).filter((c) => !c.ok).length : 0 };
      })
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  }, [stores, stats]);

  const filtered = useMemo(() => {
    if (!rows) return undefined;
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter === 'active' && !r.active) return false;
      if (statusFilter === 'suspended' && r.active) return false;
      if (statusFilter === 'attention' && (!r.active || r.problems === 0)) return false;
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
    const created = await create.run(() =>
      runSa(() => createStore({ saToken: token, slug, name, upiVpa: upiVpa || undefined })),
    );
    if (created === undefined) return;
    setSlug('');
    setName('');
    setUpiVpa('');
    setCreateOpen(false);
    create.reset();
    navigate(`/sa/stores/${created}`);
  };

  const confirmToggle = async () => {
    if (!toggleTarget) return;
    const target = toggleTarget;
    await runSa(() => setActive({ saToken: token, orgId: target._id, active: !target.active }));
    setNotice(target.active ? `${target.name} is suspended.` : `${target.name} is open again.`);
  };

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
          search={{ value: q, onChange: setQ, placeholder: 'Search by name or web address' }}
          end={
            <FilterSelect<StatusFilter>
              label="Show"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'All stores' },
                { value: 'attention', label: 'Needs attention' },
                { value: 'active', label: 'Open' },
                { value: 'suspended', label: 'Suspended' },
              ]}
            />
          }
        />
      </Card>

      {filtered === undefined ? (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3" aria-busy="true" aria-label="Loading stores">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-3 h-4 w-56" />
              <Skeleton className="mt-6 h-10 w-full" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          {(rows?.length ?? 0) === 0 ? (
            <EmptyState
              title="No stores yet"
              description="Create the first store. It gets a free cigarro.in address right away."
              action={
                <Button variant="primary" onClick={() => setCreateOpen(true)} disabled={!writeOpen}>
                  Create store
                </Button>
              }
            />
          ) : (
            <EmptyState title="No stores match" description="Clear the search or change what is shown." />
          )}
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((r) => (
            <StoreCard key={r._id} r={r} writeOpen={writeOpen} onToggle={() => setToggleTarget(r)} />
          ))}
        </div>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) create.reset();
        }}
        title="Create store"
        description="The store gets <short name>.cigarro.in straight away. You can add its own domain later."
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
            <Label htmlFor="sa-name">Store name</Label>
            <Input id="sa-name" value={name} onChange={(e) => setName(e.target.value)} required disabled={!writeOpen || create.busy} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sa-slug">Short name</Label>
            <Input
              id="sa-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="my-store"
              required
              disabled={!writeOpen || create.busy}
            />
            <p className="text-xs text-[var(--admin-text-muted)]">Lowercase letters, numbers and dashes. Used in the web address.</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sa-vpa">UPI ID (optional)</Label>
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
        title={toggleTarget?.active ? `Suspend ${toggleTarget.name}?` : `Open ${toggleTarget?.name ?? 'store'} again?`}
        description={
          toggleTarget?.active
            ? 'Customers cannot shop or pay until you open it again. Nothing is deleted.'
            : 'Customers can shop and pay again.'
        }
        confirmLabel={toggleTarget?.active ? 'Suspend store' : 'Open store'}
        critical={!!toggleTarget?.active}
        onConfirm={confirmToggle}
      />
    </Page>
  );
}

function StoreCard({ r, writeOpen, onToggle }: { r: Joined; writeOpen: boolean; onToggle: () => void }) {
  const live = storeLiveUrl(r);
  const checks = storeChecks(r, r.stats);
  return (
    <section className="relative flex min-w-0 flex-col rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] transition-colors duration-150 hover:border-[var(--admin-border-strong)]">
      <div className="flex items-start gap-3 p-4 pb-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-[var(--admin-neutral-soft)] text-sm font-semibold text-[var(--admin-text-muted)]"
        >
          {r.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          {/* Stretched link: the whole card opens the store page. */}
          <Link
            to={`/sa/stores/${r._id}`}
            className="block truncate font-semibold text-[var(--admin-text)] after:absolute after:inset-0 after:rounded-[var(--admin-radius)] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-[var(--admin-focus)]"
          >
            {r.name}
          </Link>
          {live ? (
            <a
              href={live}
              target="_blank"
              rel="noreferrer"
              className="relative z-10 mt-0.5 inline-flex max-w-full items-center gap-1 text-[13px] text-[var(--admin-text-muted)] hover:text-[var(--admin-primary)] hover:underline"
            >
              <span className="truncate">{r.primaryHost}</span>
              <ExternalLink className="size-3 shrink-0" aria-hidden />
            </a>
          ) : (
            <p className="mt-0.5 text-[13px] text-[var(--admin-text-subtle)]">No web address</p>
          )}
        </div>
        <div className="relative z-10 flex shrink-0 items-center gap-1">
          <StoreStateBadge active={r.active} />
          <Menu
            align="end"
            trigger={
              <Button variant="plain" size="icon" aria-label={`More for ${r.name}`}>
                <MoreHorizontal aria-hidden />
              </Button>
            }
            items={[
              { label: 'Open store admin', href: storeAdminUrl(r.slug), external: true },
              ...(live ? [{ label: 'View store', href: live, external: true }] : []),
              {
                label: r.active ? 'Suspend store' : 'Open store again',
                tone: r.active ? ('critical' as const) : ('default' as const),
                disabled: !writeOpen,
                onSelect: onToggle,
              },
            ]}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-4 pb-3">
        {checks.map((c) => (
          <HealthDot key={c.id} ok={c.ok} label={c.label} />
        ))}
      </div>

      <dl className="mt-auto grid grid-cols-2 border-t border-[var(--admin-border)]">
        <div className="px-4 py-3">
          <dt className="text-xs text-[var(--admin-text-muted)]">Orders this week</dt>
          <dd className="mt-0.5 text-base font-semibold tabular-nums text-[var(--admin-text)]">{formatCount(r.stats?.orders7d ?? 0)}</dd>
        </div>
        <div className="border-l border-[var(--admin-border)] px-4 py-3">
          <dt className="text-xs text-[var(--admin-text-muted)]">Sales this week</dt>
          <dd className="mt-0.5 text-base font-semibold tabular-nums text-[var(--admin-text)]">
            {formatINR(paiseToRupees(r.stats?.gmv7dPaise ?? 0))}
          </dd>
        </div>
      </dl>
    </section>
  );
}
