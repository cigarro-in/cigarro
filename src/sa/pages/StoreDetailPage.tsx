import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAction, useMutation, useQuery } from 'convex/react';
import { CheckCircle2, CircleAlert, ExternalLink } from 'lucide-react';
import {
  Badge,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Input,
  Label,
  Page,
  PageLayout,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Tabs,
  useButtonFeedback,
  type Column,
} from '../../adminnew/ui';
import type { Id } from '../../../convex/_generated/dataModel';
import { formatINR } from '../../utils/currency';
import { paiseToRupees } from '../../lib/convex/money';
import { useSa } from '../SuperGate';
import { runSa, formatCount, formatDateTime, GmailBadge, KeyValues, ROLE_LABEL, StatTile, StoreStateBadge } from '../saUi';
import { DomainList, PRIMARY_WARNING } from '../DomainList';
import { storeAdminUrl, storeLiveUrl } from '../health';
import {
  addDomainRef,
  addStoreAdminRef,
  listDomainsRef,
  listMembersRef,
  listStoreStatsRef,
  listStoresRef,
  provisionSubdomainRef,
  refreshDomainStatusRef,
  removeDomainRef,
  removeMemberRef,
  setPrimaryRef,
  setStoreActiveRef,
  storeSummaryRef,
  type DomainRow,
  type MemberRow,
  type Role,
  type StoreRow,
  type StoreStatsRow,
  type StoreSummary,
} from '../refs';

type TabId = 'overview' | 'domains' | 'team' | 'import' | 'settings';
const TAB_IDS: TabId[] = ['overview', 'domains', 'team', 'import', 'settings'];
const ROLES: Role[] = ['owner', 'admin', 'staff', 'customer'];

// One store, split into small tabs. Overview answers "is this store working?"
// with a checklist; every other tab holds one job.
export function StoreDetailPage() {
  const { orgId: orgParam } = useParams();
  const { token, writeOpen } = useSa();
  const orgId = (orgParam ?? '') as Id<'organizations'>;
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab') as TabId | null;
  const tab: TabId = tabParam && TAB_IDS.includes(tabParam) ? tabParam : 'overview';
  const setTab = (t: TabId) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true });

  const stores = useQuery(listStoresRef, { saToken: token });
  const stats = useQuery(listStoreStatsRef, { saToken: token });
  const summary = useQuery(storeSummaryRef, { saToken: token, orgId });
  const domains = useQuery(listDomainsRef, { saToken: token, orgId });
  const members = useQuery(listMembersRef, { saToken: token, orgId });
  const store = stores?.find((s) => s._id === orgId);
  const storeStats = stats?.find((s) => s.orgId === orgId);

  if (stores !== undefined && !store) {
    return (
      <Page title="Store" backTo="/sa/stores">
        <Card>
          <EmptyState title="Store not found" description="It may have been removed. Go back to the list of stores." />
        </Card>
      </Page>
    );
  }

  const live = store ? storeLiveUrl(store) : null;
  const team = (members ?? []).filter((m) => m.role !== 'customer');
  const notLive = (domains ?? []).filter((d) => d.status !== 'active').length;

  return (
    <Page
      title={store?.name ?? <Skeleton className="inline-block h-6 w-48 align-middle" />}
      backTo="/sa/stores"
      titleMeta={store ? <StoreStateBadge active={store.active} /> : undefined}
      secondaryActions={
        live
          ? [
              <Button key="view" asChild variant="secondary">
                <a href={live} target="_blank" rel="noreferrer">
                  View store
                </a>
              </Button>,
            ]
          : undefined
      }
      primaryAction={
        store ? (
          <Button asChild variant="primary">
            <a href={storeAdminUrl(store.slug)} target="_blank" rel="noreferrer">
              Open admin
            </a>
          </Button>
        ) : undefined
      }
    >
      <Card padding="none">
        <div className="flex items-center gap-4 px-4 py-4">
          <StoreLogo name={store?.name} logoUrl={summary?.logoUrl ?? null} />
          <div className="min-w-0 flex-1">
            {store ? (
              <>
                {live ? (
                  <a
                    href={live}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-[var(--admin-primary)] hover:underline"
                  >
                    <span className="truncate">{store.primaryHost}</span>
                    <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                  </a>
                ) : (
                  <p className="text-sm text-[var(--admin-text-muted)]">No web address yet</p>
                )}
                <p className="mt-0.5 truncate text-[13px] text-[var(--admin-text-muted)]">
                  Admin at {window.location.host}/{store.slug}
                </p>
              </>
            ) : (
              <>
                <Skeleton className="h-4 w-48" />
                <Skeleton className="mt-2 h-3 w-32" />
              </>
            )}
          </div>
        </div>
        <Tabs<TabId>
          className="mb-0 border-b-0 border-t border-[var(--admin-border)]"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'domains', label: 'Domains', count: notLive > 0 ? notLive : undefined },
            { id: 'team', label: 'Team', count: members?.length },
            { id: 'import', label: 'Import' },
            { id: 'settings', label: 'Settings' },
          ]}
        />
      </Card>

      {tab === 'overview' && (
        <OverviewTab store={store} stats={storeStats} summary={summary} domains={domains} team={members ? team : undefined} onTab={setTab} />
      )}
      {tab === 'domains' && <DomainsTab orgId={orgId} store={store} domains={domains} token={token} writeOpen={writeOpen} />}
      {tab === 'team' && <TeamTab orgId={orgId} members={members} token={token} writeOpen={writeOpen} />}
      {tab === 'import' && <ImportTab orgId={orgId} productCount={summary?.activeProductCount} />}
      {tab === 'settings' && <SettingsTab store={store} token={token} writeOpen={writeOpen} />}
    </Page>
  );
}

function StoreLogo({ name, logoUrl }: { name?: string; logoUrl: string | null }) {
  const [broken, setBroken] = useState(false);
  if (logoUrl && /^https?:\/\//.test(logoUrl) && !broken) {
    return (
      <img
        src={logoUrl}
        alt=""
        onError={() => setBroken(true)}
        className="size-12 shrink-0 rounded-[10px] border border-[var(--admin-border)] bg-white object-contain p-1"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-[var(--admin-neutral-soft)] text-lg font-semibold text-[var(--admin-text-muted)]"
    >
      {name?.charAt(0).toUpperCase() ?? ''}
    </span>
  );
}

// ---------- Overview ----------

interface CheckItem {
  label: string;
  ok: boolean | undefined;
  detail: string;
  fix: ReactNode;
}

function OverviewTab({
  store,
  stats,
  summary,
  domains,
  team,
  onTab,
}: {
  store: StoreRow | undefined;
  stats: StoreStatsRow | undefined;
  summary: StoreSummary | undefined;
  domains: DomainRow[] | undefined;
  team: MemberRow[] | undefined;
  onTab: (t: TabId) => void;
}) {
  const paymentsSettings = store ? storeAdminUrl(store.slug, '/payments/settings') : '#';
  const fixLink = (label: string, href: string) => (
    <Button asChild size="sm" variant="secondary">
      <a href={href} target="_blank" rel="noreferrer">
        {label}
      </a>
    </Button>
  );
  const fixTab = (label: string, t: TabId) => (
    <Button size="sm" variant="secondary" onClick={() => onTab(t)}>
      {label}
    </Button>
  );

  const primary = domains?.find((d) => d.kind === 'primary');
  const products = summary?.activeProductCount;
  const admins = team?.filter((m) => m.role === 'owner' || m.role === 'admin').length;

  const checks: CheckItem[] = [
    {
      label: 'Website is live',
      ok: domains === undefined ? undefined : primary?.status === 'active',
      detail: primary ? (primary.status === 'active' ? primary.hostname : `${primary.hostname} is not live yet`) : 'No web address yet',
      fix: fixTab('Check domains', 'domains'),
    },
    {
      label: 'Payments are tracked',
      ok: stats === undefined ? undefined : stats.gmail === 'connected',
      detail:
        stats?.gmail === 'connected'
          ? `Gmail ${stats.gmailEmail ?? 'connected'}`
          : stats?.gmail === 'needs_reconnect'
            ? 'Gmail needs to be reconnected'
            : 'Gmail not connected, so UPI payments are not matched to orders',
      fix: fixLink('Connect Gmail', paymentsSettings),
    },
    {
      label: 'UPI ID is set',
      ok: store === undefined ? undefined : !!store.upiVpa,
      detail: store?.upiVpa || 'Customers cannot pay without one',
      fix: fixLink('Set UPI ID', paymentsSettings),
    },
    {
      label: 'Products are listed',
      ok: products === undefined ? undefined : products > 0,
      detail: products === undefined ? '' : `${formatCount(products)} product${products === 1 ? '' : 's'} on sale`,
      fix: fixTab('Import products', 'import'),
    },
    {
      label: 'Someone can run the store',
      ok: admins === undefined ? undefined : admins > 0,
      detail: admins === undefined ? '' : admins > 0 ? `${admins} owner or admin` : 'No owner or admin yet',
      fix: fixTab('Add a person', 'team'),
    },
  ];
  const done = checks.filter((c) => c.ok).length;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Paid orders today" value={stats ? formatCount(stats.ordersToday) : '-'} />
        <StatTile label="Sales today" value={stats ? formatINR(paiseToRupees(stats.gmvTodayPaise)) : '-'} />
        <StatTile label="Paid orders this week" value={stats ? formatCount(stats.orders7d) : '-'} />
        <StatTile label="Sales this week" value={stats ? formatINR(paiseToRupees(stats.gmv7dPaise)) : '-'} />
      </div>

      <PageLayout
        main={
          <Card
            title="Setup checklist"
            padding="none"
            actions={<span className="text-xs tabular-nums text-[var(--admin-text-muted)]">{done} of {checks.length} done</span>}
          >
            <ul className="divide-y divide-[var(--admin-border)]">
              {checks.map((c) => (
                <li key={c.label} className="flex items-center gap-3 px-4 py-3">
                  {c.ok === undefined ? (
                    <Skeleton className="size-5 rounded-full" />
                  ) : c.ok ? (
                    <CheckCircle2 className="size-5 shrink-0 text-[var(--admin-success)]" aria-label="Done" />
                  ) : (
                    <CircleAlert className="size-5 shrink-0 text-[var(--admin-warning)]" aria-label="Needs attention" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--admin-text)]">{c.label}</p>
                    {c.detail && <p className="truncate text-[13px] text-[var(--admin-text-muted)]">{c.detail}</p>}
                  </div>
                  {c.ok === false && <div className="shrink-0">{c.fix}</div>}
                </li>
              ))}
            </ul>
          </Card>
        }
        aside={
          <Card title="Store details">
            {store ? (
              <KeyValues
                items={[
                  { label: 'Short name', value: store.slug, mono: true },
                  { label: 'Theme', value: stats?.theme ? <Badge tone="neutral">{stats.theme}</Badge> : 'None' },
                  { label: 'UPI ID', value: store.upiVpa || 'Not set', mono: !!store.upiVpa },
                  { label: 'Gmail', value: stats ? <GmailBadge state={stats.gmail} /> : '-' },
                  { label: 'Created', value: formatDateTime(store.createdAt) },
                ]}
              />
            ) : (
              <div className="space-y-3" aria-busy="true">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            )}
          </Card>
        }
      />
    </>
  );
}

// ---------- Domains ----------

type DomainAction = { kind: 'primary' | 'remove'; domain: DomainRow };

function DomainsTab({
  orgId,
  store,
  domains,
  token,
  writeOpen,
}: {
  orgId: Id<'organizations'>;
  store: StoreRow | undefined;
  domains: DomainRow[] | undefined;
  token: string;
  writeOpen: boolean;
}) {
  const addDomain = useMutation(addDomainRef);
  const setPrimary = useMutation(setPrimaryRef);
  const provisionSubdomain = useMutation(provisionSubdomainRef);
  const refreshDomain = useAction(refreshDomainStatusRef);
  const removeDomain = useAction(removeDomainRef);
  const [hostname, setHostname] = useState('');
  const addFb = useButtonFeedback();
  const provisionFb = useButtonFeedback();
  const rowFb = useButtonFeedback();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [action, setAction] = useState<DomainAction | null>(null);

  const hasSubdomain = (domains ?? []).some((d) => d.managed);

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    const host = hostname;
    const ok = await addFb.run(() => runSa(() => addDomain({ saToken: token, orgId, hostname: host })));
    if (ok === undefined) return;
    setHostname('');
    setNotice(`Added ${host}. Open "How to connect" on its row for the DNS record to add.`);
  };

  const onProvision = async () => {
    const res = await provisionFb.run(() => runSa(() => provisionSubdomain({ saToken: token, orgId })));
    if (res === undefined) return;
    if (!res.created) {
      provisionFb.reset();
      setNotice(res.reason === 'exists' ? `${res.hostname} is already set up.` : `No address was created (${res.reason ?? 'unknown'}).`);
      return;
    }
    setNotice(`Setting up ${res.hostname ?? 'the free address'}. It goes live in a few minutes.`);
  };

  const onRefresh = async (d: DomainRow) => {
    setBusyId(d._id);
    const res = await rowFb.run(() => runSa(() => refreshDomain({ saToken: token, domainId: d._id })));
    setBusyId(null);
    if (res !== undefined) setNotice(`Checked ${d.hostname} again.`);
  };

  const confirmAction = async () => {
    if (!action) return;
    const { kind, domain } = action;
    if (kind === 'primary') {
      await runSa(() => setPrimary({ saToken: token, domainId: domain._id }));
      setNotice(`${domain.hostname} is now the main address.`);
    } else {
      await runSa(() => removeDomain({ saToken: token, domainId: domain._id }));
      setNotice(`Removed ${domain.hostname}.`);
    }
  };

  return (
    <>
      {notice && (
        <Banner tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </Banner>
      )}
      {rowFb.error && <Banner tone="critical">{rowFb.error.message}</Banner>}
      <PageLayout
        main={
          <Card title="Web addresses" padding="none">
            {domains === undefined ? (
              <div className="space-y-3 p-4" aria-busy="true">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : domains.length === 0 ? (
              <EmptyState title="No web address yet" description="Add the store's own domain, or set up its free cigarro.in address." />
            ) : (
              <DomainList
                domains={domains}
                writeOpen={writeOpen}
                busyId={busyId}
                onRefresh={(d) => void onRefresh(d)}
                onMakePrimary={(d) => setAction({ kind: 'primary', domain: d })}
                onRemove={(d) => setAction({ kind: 'remove', domain: d })}
              />
            )}
          </Card>
        }
        aside={
          <>
            <Card title="Add an address">
              <form onSubmit={onAdd} className="flex flex-col gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="sa-host">Domain</Label>
                  <Input
                    id="sa-host"
                    value={hostname}
                    onChange={(e) => setHostname(e.target.value)}
                    placeholder="shop.example.com"
                    required
                    disabled={!writeOpen || addFb.busy}
                  />
                </div>
                <Button type="submit" variant="primary" state={addFb.state} disabled={!writeOpen}>
                  Add address
                </Button>
                {addFb.error && <Banner tone="critical">{addFb.error.message}</Banner>}
                <p className="text-xs text-[var(--admin-text-muted)]">
                  After adding, the store owner points the domain here with one DNS record. It goes live on its own.
                </p>
              </form>
            </Card>
            {store && !hasSubdomain && domains !== undefined && (
              <Card title="Free address">
                <p className="text-[13px] text-[var(--admin-text-muted)]">
                  Give the store {store.slug}.cigarro.in. No DNS work needed.
                </p>
                <Button
                  className="mt-3"
                  variant="secondary"
                  state={provisionFb.state}
                  disabled={!writeOpen || provisionFb.busy}
                  onClick={() => void onProvision()}
                >
                  Set up {store.slug}.cigarro.in
                </Button>
                {provisionFb.error && (
                  <div className="mt-3">
                    <Banner tone="critical">{provisionFb.error.message}</Banner>
                  </div>
                )}
              </Card>
            )}
          </>
        }
      />
      <ConfirmDialog
        open={action !== null}
        onOpenChange={(o) => {
          if (!o) setAction(null);
        }}
        title={
          action?.kind === 'primary'
            ? `Make ${action.domain.hostname} the main address?`
            : `Remove ${action?.domain.hostname ?? 'this address'}?`
        }
        description={
          action?.kind === 'primary'
            ? PRIMARY_WARNING
            : action?.domain.kind === 'primary'
              ? 'Visitors on this address stop reaching the store. Another address becomes the main one.'
              : 'Visitors on this address stop reaching the store.'
        }
        confirmLabel={action?.kind === 'primary' ? 'Make main address' : 'Remove address'}
        critical={action?.kind === 'remove'}
        onConfirm={confirmAction}
      />
    </>
  );
}

// ---------- Team ----------

function TeamTab({
  orgId,
  members,
  token,
  writeOpen,
}: {
  orgId: Id<'organizations'>;
  members: MemberRow[] | undefined;
  token: string;
  writeOpen: boolean;
}) {
  const addAdmin = useMutation(addStoreAdminRef);
  const removeMember = useMutation(removeMemberRef);
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('admin');
  const fb = useButtonFeedback();
  const [notice, setNotice] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<MemberRow | null>(null);

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    const p = phone;
    const r = role;
    const ok = await fb.run(() => runSa(() => addAdmin({ saToken: token, orgId, phone: p, role: r })));
    if (ok === undefined) return;
    setNotice(`${p} is now ${ROLE_LABEL[r].toLowerCase()}. They sign in with this phone number.`);
    setPhone('');
  };

  const columns: Column<MemberRow>[] = [
    {
      id: 'who',
      header: 'Person',
      cell: (m) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-[var(--admin-text)]">{m.name ?? m.phone ?? '-'}</p>
          {m.name && <p className="truncate font-mono text-xs text-[var(--admin-text-muted)]">{m.phone ?? ''}</p>}
        </div>
      ),
    },
    {
      id: 'role',
      header: 'Role',
      cell: (m) => <Badge tone={m.role === 'owner' ? 'attention' : 'neutral'}>{ROLE_LABEL[m.role]}</Badge>,
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      width: '6rem',
      cell: (m) => (
        <Button variant="plain" size="sm" disabled={!writeOpen} onClick={() => setToRemove(m)}>
          Remove
        </Button>
      ),
    },
  ];

  return (
    <>
      {notice && (
        <Banner tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </Banner>
      )}
      <PageLayout
        main={
          <Card title="People with access" padding="none">
            <DataTable
              columns={columns}
              rows={members}
              getRowId={(m) => m._id}
              loading={members === undefined}
              empty={<EmptyState title="Nobody yet" description="Add the store owner's phone number to give them access." />}
            />
          </Card>
        }
        aside={
          <Card title="Add a person">
            <form onSubmit={onAdd} className="flex flex-col gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="sa-phone">Phone number</Label>
                <Input
                  id="sa-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  inputMode="tel"
                  required
                  disabled={!writeOpen || fb.busy}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sa-role">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as Role)} disabled={!writeOpen || fb.busy}>
                  <SelectTrigger id="sa-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" variant="primary" state={fb.state} disabled={!writeOpen}>
                Give access
              </Button>
              {fb.error && <Banner tone="critical">{fb.error.message}</Banner>}
              <p className="text-xs text-[var(--admin-text-muted)]">
                Adding someone who is already listed changes their role.
              </p>
            </form>
          </Card>
        }
      />
      <ConfirmDialog
        open={toRemove !== null}
        onOpenChange={(o) => {
          if (!o) setToRemove(null);
        }}
        title={`Remove ${toRemove?.name ?? toRemove?.phone ?? 'this person'}?`}
        description="They can no longer open the store admin. Their customer account is kept."
        confirmLabel="Remove access"
        critical
        onConfirm={async () => {
          if (!toRemove) return;
          await runSa(() => removeMember({ saToken: token, membershipId: toRemove._id }));
          setNotice('Access removed.');
        }}
      />
    </>
  );
}

// ---------- Import ----------

function ImportTab({ orgId, productCount }: { orgId: Id<'organizations'>; productCount: number | undefined }) {
  return (
    <Card title="Bring a store over from Dukaan">
      <div className="max-w-2xl">
        <p className="text-sm text-[var(--admin-text-muted)]">
          Copies categories, products, banners, blog posts, store settings and old links from a Dukaan export into this store.
          Running it again updates what is already there, nothing is duplicated.
        </p>
        <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm text-[var(--admin-text)]">
          <li>Have the export files ready (normalized.json, and optionally the image map and redirects).</li>
          <li>Open the importer and pick the files.</li>
          <li>Check the counts, then press Import.</li>
        </ol>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button asChild variant="primary">
            <Link to={`/sa/stores/${orgId}/import`}>Open importer</Link>
          </Button>
          {productCount !== undefined && (
            <span className="text-[13px] text-[var(--admin-text-muted)]">
              {formatCount(productCount)} product{productCount === 1 ? '' : 's'} on sale now
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

// ---------- Settings ----------

function SettingsTab({ store, token, writeOpen }: { store: StoreRow | undefined; token: string; writeOpen: boolean }) {
  const setActive = useMutation(setStoreActiveRef);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <>
      {notice && (
        <Banner tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </Banner>
      )}
      <div className="grid items-start gap-3 lg:grid-cols-2">
        <Card title="Store settings">
          <p className="text-[13px] text-[var(--admin-text-muted)]">
            Name, logo, UPI, checkout and shipping are changed by the store in its own admin.
          </p>
          {store && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild variant="secondary" size="sm">
                <a href={storeAdminUrl(store.slug, '/settings')} target="_blank" rel="noreferrer">
                  Store settings
                </a>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <a href={storeAdminUrl(store.slug, '/payments/settings')} target="_blank" rel="noreferrer">
                  Payment settings
                </a>
              </Button>
            </div>
          )}
          {store && (
            <div className="mt-4 border-t border-[var(--admin-border)] pt-3">
              <KeyValues
                items={[
                  { label: 'Store ID', value: store._id, mono: true },
                  { label: 'Bank alert forwarding address', value: store.bankEmailAlias || '-', mono: true },
                ]}
              />
            </div>
          )}
        </Card>

        <Card title="Danger zone" className="border-[var(--admin-critical-border)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--admin-text)]">{store?.active ? 'Suspend this store' : 'Open this store again'}</p>
              <p className="text-[13px] text-[var(--admin-text-muted)]">
                {store?.active
                  ? 'Customers cannot shop or pay until you open it again. Nothing is deleted.'
                  : 'Customers can shop and pay again.'}
              </p>
            </div>
            <Button
              variant={store?.active ? 'critical' : 'secondary'}
              disabled={!writeOpen || !store}
              onClick={() => setOpen(true)}
              className="shrink-0"
            >
              {store?.active ? 'Suspend store' : 'Open store'}
            </Button>
          </div>
        </Card>
      </div>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={store?.active ? `Suspend ${store.name}?` : `Open ${store?.name ?? 'store'} again?`}
        description={
          store?.active ? 'Customers cannot shop or pay until you open it again. Nothing is deleted.' : 'Customers can shop and pay again.'
        }
        confirmLabel={store?.active ? 'Suspend store' : 'Open store'}
        critical={!!store?.active}
        onConfirm={async () => {
          if (!store) return;
          await runSa(() => setActive({ saToken: token, orgId: store._id, active: !store.active }));
          setNotice(store.active ? `${store.name} is suspended.` : `${store.name} is open again.`);
        }}
      />
    </>
  );
}
