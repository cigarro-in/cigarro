import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAction, useMutation, useQuery } from 'convex/react';
import { MoreHorizontal } from 'lucide-react';
import {
  Badge,
  Banner,
  Button,
  Card,
  CardSection,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Input,
  Label,
  Menu,
  Page,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  useButtonFeedback,
  type Column,
} from '../../adminnew/ui';
import type { Id } from '../../../convex/_generated/dataModel';
import { useSa } from '../SuperGate';
import { runSa, DomainStatusBadge, DnsRecords, Facts, GmailBadge, ManagedTag, ROLE_LABEL, relativeTime, StoreStateBadge, formatDateTime } from '../saUi';
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
  type DomainRow,
  type MemberRow,
  type Role,
} from '../refs';

const ROLES: Role[] = ['owner', 'admin', 'staff', 'customer'];

const PRIMARY_WARNING =
  "Switching primary moves canonical URLs to this domain. Only do this after the merchant's DNS points here.";

type DomainAction = { kind: 'primary' | 'remove'; domain: DomainRow };

export function StoreDetailPage() {
  const { orgId: orgParam } = useParams();
  const { token, writeOpen } = useSa();
  const orgId = (orgParam ?? '') as Id<'organizations'>;

  const stores = useQuery(listStoresRef, { saToken: token });
  const stats = useQuery(listStoreStatsRef, { saToken: token });
  const store = stores?.find((s) => s._id === orgId);
  const storeStats = stats?.find((s) => s.orgId === orgId);

  // Domains
  const domains = useQuery(listDomainsRef, { saToken: token, orgId });
  const addDomain = useMutation(addDomainRef);
  const setPrimary = useMutation(setPrimaryRef);
  const provisionSubdomain = useMutation(provisionSubdomainRef);
  const refreshDomain = useAction(refreshDomainStatusRef);
  const removeDomain = useAction(removeDomainRef);
  const [hostname, setHostname] = useState('');
  const addFb = useButtonFeedback();
  const provisionFb = useButtonFeedback();
  const rowFb = useButtonFeedback();
  const [domainNotice, setDomainNotice] = useState<string | null>(null);
  const [domainAction, setDomainAction] = useState<DomainAction | null>(null);

  // Members
  const members = useQuery(listMembersRef, { saToken: token, orgId });
  const addAdmin = useMutation(addStoreAdminRef);
  const removeMember = useMutation(removeMemberRef);
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('admin');
  const memberFb = useButtonFeedback();
  const [memberNotice, setMemberNotice] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<MemberRow | null>(null);

  // Danger zone
  const setActive = useMutation(setStoreActiveRef);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [storeNotice, setStoreNotice] = useState<string | null>(null);

  const hasSubdomain = (domains ?? []).some((d) => d.managed);
  const pendingWithDns = (domains ?? []).filter((d) => d.status === 'pending' && d.dnsInstructions);

  const onAddDomain = async (e: FormEvent) => {
    e.preventDefault();
    const host = hostname;
    const ok = await addFb.run(() => runSa(() => addDomain({ saToken: token, orgId, hostname: host })));
    if (ok === undefined) return;
    setHostname('');
    setDomainNotice(`Added ${host}. It stays pending until Cloudflare reports it active.`);
  };

  const onProvision = async () => {
    const res = await provisionFb.run(() => runSa(() => provisionSubdomain({ saToken: token, orgId })));
    if (res === undefined) return;
    if (!res.created) {
      provisionFb.reset();
      setDomainNotice(
        res.reason === 'exists'
          ? `${res.hostname} is already set up.`
          : `No subdomain was created (${res.reason ?? 'unknown'}).`,
      );
      return;
    }
    setDomainNotice(`Provisioning ${store?.slug ?? 'store'} subdomain. It turns active once Cloudflare reports it.`);
  };

  const onRefresh = async (d: DomainRow) => {
    const res = await rowFb.run(() => runSa(() => refreshDomain({ saToken: token, domainId: d._id })));
    if (res !== undefined) setDomainNotice(`Refreshed ${d.hostname} from Cloudflare.`);
  };

  const confirmDomainAction = async () => {
    if (!domainAction) return;
    const { kind, domain } = domainAction;
    if (kind === 'primary') {
      await runSa(() => setPrimary({ saToken: token, domainId: domain._id }));
      setDomainNotice(`${domain.hostname} is now the primary domain.`);
    } else {
      await runSa(() => removeDomain({ saToken: token, domainId: domain._id }));
      setDomainNotice(`Removed ${domain.hostname}.`);
    }
  };

  const onAddMember = async (e: FormEvent) => {
    e.preventDefault();
    const p = phone;
    const r = role;
    const ok = await memberFb.run(() => runSa(() => addAdmin({ saToken: token, orgId, phone: p, role: r })));
    if (ok === undefined) return;
    setMemberNotice(`Saved ${p} as ${ROLE_LABEL[r].toLowerCase()}.`);
    setPhone('');
  };

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return;
    await runSa(() => removeMember({ saToken: token, membershipId: memberToRemove._id }));
    setMemberNotice('Member removed.');
  };

  const confirmSuspend = async () => {
    if (!store) return;
    await runSa(() => setActive({ saToken: token, orgId, active: !store.active }));
    setStoreNotice(store.active ? `Suspended ${store.slug}.` : `Activated ${store.slug}.`);
  };

  const domainColumns: Column<DomainRow>[] = [
    {
      id: 'host',
      header: 'Hostname',
      cell: (d) => (
        <div className="min-w-0">
          <p className="truncate font-mono text-[13px] text-[var(--admin-text)]">{d.hostname}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-xs capitalize text-[var(--admin-text-muted)]">{d.kind}</span>
            {d.managed && <ManagedTag managed />}
          </div>
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
      hideBelow: 'md',
      cell: (d) =>
        d.cfManaged ? (
          <span className="font-mono text-xs">{d.cfStatus ?? 'Not synced'}</span>
        ) : (
          <span className="text-xs text-[var(--admin-text-muted)]">Platform</span>
        ),
    },
    {
      id: 'checked',
      header: 'Last checked',
      hideBelow: 'lg',
      cell: (d) => <span className="whitespace-nowrap text-[13px] text-[var(--admin-text-muted)]">{relativeTime(d.cfCheckedAt)}</span>,
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      width: '3rem',
      cell: (d) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Menu
            align="end"
            trigger={
              <Button variant="plain" size="icon" aria-label={`Actions for ${d.hostname}`}>
                <MoreHorizontal aria-hidden />
              </Button>
            }
            items={[
              ...(d.cfManaged
                ? [{ label: 'Refresh now', disabled: !writeOpen || rowFb.busy, onSelect: () => void onRefresh(d) }]
                : []),
              ...(d.status === 'active' && d.kind === 'alias' && d.cfManaged
                ? [{ label: 'Make primary', disabled: !writeOpen, onSelect: () => setDomainAction({ kind: 'primary', domain: d }) }]
                : []),
              { label: 'Remove domain', tone: 'critical' as const, disabled: !writeOpen, onSelect: () => setDomainAction({ kind: 'remove', domain: d }) },
            ]}
          />
        </div>
      ),
    },
  ];

  const memberColumns: Column<MemberRow>[] = [
    {
      id: 'phone',
      header: 'Phone',
      cell: (m) => <span className="font-mono text-[13px]">{m.phone ?? '-'}</span>,
    },
    {
      id: 'name',
      header: 'Name',
      hideBelow: 'sm',
      cell: (m) => <span className="truncate">{m.name ?? '-'}</span>,
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
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="secondary"
            size="sm"
            disabled={!writeOpen}
            onClick={() => {
              setMemberToRemove(m);
            }}
          >
            Remove
          </Button>
        </div>
      ),
    },
  ];

  if (stores !== undefined && !store) {
    return (
      <Page title="Store" backTo="/sa/stores">
        <Card>
          <EmptyState title="Store not found" description="It may have been removed. Go back to the list and refresh." />
        </Card>
      </Page>
    );
  }

  return (
    <Page
      title={store?.name ?? <Skeleton className="inline-block h-6 w-48 align-middle" />}
      backTo="/sa/stores"
      titleMeta={store ? <StoreStateBadge active={store.active} /> : undefined}
      primaryAction={store ? { label: 'Catalog import', to: `/sa/stores/${orgId}/import` } : undefined}
    >
      {/* 1. Identity */}
      <Card title="Identity">
        {store ? (
          <Facts
            items={[
              { label: 'Store name', value: store.name },
              { label: 'Slug', value: store.slug, mono: true },
              { label: 'Theme', value: storeStats?.theme ?? 'None' },
              { label: 'UPI VPA', value: store.upiVpa || 'Not set', mono: !!store.upiVpa },
              { label: 'Bank alert alias', value: store.bankEmailAlias || '-', mono: true },
              {
                label: 'Gmail for bank alerts',
                value: storeStats ? (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <GmailBadge state={storeStats.gmail} />
                    {storeStats.gmailEmail && <span className="text-[var(--admin-text-muted)]">{storeStats.gmailEmail}</span>}
                  </span>
                ) : (
                  '-'
                ),
              },
              { label: 'Created', value: formatDateTime(store.createdAt) },
              { label: 'Orders, 7 days', value: storeStats ? storeStats.orders7d.toLocaleString('en-IN') : '-' },
            ]}
          />
        ) : (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}
      </Card>

      {/* 2. Domains */}
      <Card
        title="Domains"
        actions={
          store && !hasSubdomain ? (
            <Button
              variant="secondary"
              size="sm"
              state={provisionFb.state}
              disabled={!writeOpen || provisionFb.busy}
              onClick={() => void onProvision()}
            >
              Provision subdomain
            </Button>
          ) : undefined
        }
        padding="none"
      >
        <div className="flex flex-col gap-3 p-4">
          <p className="text-[13px] text-[var(--admin-text-muted)]">
            Status comes from Cloudflare Pages and is rechecked every 15 minutes. Platform hosts are never sent to Cloudflare.
            {store ? ` ${store.slug}.cigarro.in is registered for you.` : ''}
          </p>
          <form onSubmit={onAddDomain} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="grid gap-1.5">
              <Label htmlFor="sa-host">Add a hostname</Label>
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
              Add domain
            </Button>
          </form>
          {addFb.error && <Banner tone="critical">{addFb.error.message}</Banner>}
          {provisionFb.error && <Banner tone="critical">{provisionFb.error.message}</Banner>}
          {domainNotice && (
            <Banner tone="success" onDismiss={() => setDomainNotice(null)}>
              {domainNotice}
            </Banner>
          )}
          {rowFb.error && <Banner tone="critical">{rowFb.error.message}</Banner>}
        </div>

        {domains === undefined ? (
          <div className="space-y-3 border-t border-[var(--admin-border)] p-4" aria-busy="true">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="border-t border-[var(--admin-border)]">
            <DataTable
              columns={domainColumns}
              rows={domains}
              getRowId={(d) => d._id}
              loading={domains === undefined}
              empty={<EmptyState title="No domains yet" description="Add a hostname above, or provision the platform subdomain." />}
            />
          </div>
        )}

        {pendingWithDns.length > 0 && (
          <div className="space-y-3 border-t border-[var(--admin-border)] p-4">
            <p className="text-sm font-semibold text-[var(--admin-text)]">DNS to add</p>
            {pendingWithDns.map((d) => (
              <div key={`dns-${d._id}`} className="space-y-2">
                <p className="font-mono text-xs text-[var(--admin-text-muted)]">{d.hostname}</p>
                <DnsRecords
                  hostname={d.hostname}
                  cnameTarget={d.dnsInstructions!.cnameTarget}
                  txtRecords={d.dnsInstructions!.txtRecords}
                />
              </div>
            ))}
          </div>
        )}
        <p className="border-t border-[var(--admin-border)] px-4 py-3 text-xs text-[var(--admin-warning)]">{PRIMARY_WARNING}</p>
      </Card>

      {/* 3. Members */}
      <Card title="Admins and members" padding="none">
        <form onSubmit={onAddMember} className="grid gap-3 p-4 sm:grid-cols-[1fr_11rem_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="sa-phone">Phone</Label>
            <Input
              id="sa-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="9876543210"
              inputMode="tel"
              required
              disabled={!writeOpen || memberFb.busy}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sa-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)} disabled={!writeOpen || memberFb.busy}>
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
          <Button type="submit" variant="primary" state={memberFb.state} disabled={!writeOpen}>
            Add or update
          </Button>
        </form>
        <div className="space-y-3 px-4 pb-4">
          {memberFb.error && <Banner tone="critical">{memberFb.error.message}</Banner>}
          {memberNotice && (
            <Banner tone="success" onDismiss={() => setMemberNotice(null)}>
              {memberNotice}
            </Banner>
          )}
        </div>
        <div className="border-t border-[var(--admin-border)]">
          <DataTable
            columns={memberColumns}
            rows={members}
            getRowId={(m) => m._id}
            loading={members === undefined}
            empty={<EmptyState title="No members yet" description="Add a phone number above to give someone store access." />}
          />
        </div>
      </Card>

      {/* 4. Catalog import */}
      <Card title="Catalog import">
        <CardSection>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-[var(--admin-text-muted)]">
              Load a migrated Dukaan export: categories, products, hero slides, blog posts, settings and redirects. Re-running updates rows in place.
            </p>
            <Button asChild variant="secondary" className="shrink-0">
              <Link to={`/sa/stores/${orgId}/import`}>Open importer</Link>
            </Button>
          </div>
        </CardSection>
      </Card>

      {/* 5. Danger zone */}
      <Card title="Danger zone" className="border-[var(--admin-critical-border)]">
        <div className="flex flex-col gap-3 px-4 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--admin-text)]">
              {store?.active ? 'Suspend this store' : 'Activate this store'}
            </p>
            <p className="text-[13px] text-[var(--admin-text-muted)]">
              {store?.active
                ? 'Stops storefront and checkout until reactivated. Data is kept.'
                : 'Restores storefront and checkout for this store.'}
            </p>
          </div>
          <Button
            variant={store?.active ? 'critical' : 'secondary'}
            disabled={!writeOpen || !store}
            onClick={() => setSuspendOpen(true)}
            className="shrink-0"
          >
            {store?.active ? 'Suspend store' : 'Activate store'}
          </Button>
        </div>
        {storeNotice && (
          <div className="px-4 pb-4">
            <Banner tone="success" onDismiss={() => setStoreNotice(null)}>
              {storeNotice}
            </Banner>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={domainAction !== null}
        onOpenChange={(o) => {
          if (!o) setDomainAction(null);
        }}
        title={
          domainAction?.kind === 'primary'
            ? `Make ${domainAction.domain.hostname} primary?`
            : `Remove ${domainAction?.domain.hostname ?? 'domain'}?`
        }
        description={
          domainAction?.kind === 'primary'
            ? PRIMARY_WARNING
            : domainAction?.domain.cfManaged
              ? 'It is removed from Cloudflare Pages too. Visitors on this host stop reaching the store.'
              : 'Visitors on this host stop reaching the store.'
        }
        confirmLabel={domainAction?.kind === 'primary' ? 'Make primary' : 'Remove domain'}
        critical={domainAction?.kind === 'remove'}
        onConfirm={confirmDomainAction}
      />

      <ConfirmDialog
        open={memberToRemove !== null}
        onOpenChange={(o) => {
          if (!o) setMemberToRemove(null);
        }}
        title={`Remove ${memberToRemove?.phone ?? 'this member'}?`}
        description="They lose admin access to this store. Their customer account is kept."
        confirmLabel="Remove member"
        critical
        onConfirm={confirmRemoveMember}
      />

      <ConfirmDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        title={store?.active ? `Suspend ${store.name}?` : `Activate ${store?.name ?? 'store'}?`}
        description={
          store?.active
            ? 'Customers cannot shop or pay until the store is activated again. Nothing is deleted.'
            : 'The storefront and checkout come back on.'
        }
        confirmLabel={store?.active ? 'Suspend store' : 'Activate store'}
        critical={!!store?.active}
        onConfirm={confirmSuspend}
      />
    </Page>
  );
}
