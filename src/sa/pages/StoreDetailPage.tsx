import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAction, useMutation, useQuery } from 'convex/react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { InlineStatus, useInlineStatus } from '../../components/common/InlineStatus';
import type { Id } from '../../../convex/_generated/dataModel';
import { useSa } from '../SuperGate';
import { saErrorMessage } from '../session';
import { DnsInstructions, ManagedBadge, relativeTime, StatusBadge } from '../domainUi';
import {
  addDomainRef,
  addStoreAdminRef,
  listDomainsRef,
  listMembersRef,
  listStoresRef,
  provisionSubdomainRef,
  refreshDomainStatusRef,
  removeDomainRef,
  removeMemberRef,
  setPrimaryRef,
  type DomainRow,
  type Role,
} from '../refs';

const ROLES: Role[] = ['owner', 'admin', 'staff', 'customer'];

const PRIMARY_WARNING =
  "Switching primary moves canonical URLs to this domain — do this only after the merchant's DNS is pointed here.";

export function StoreDetailPage() {
  const { orgId: orgParam } = useParams();
  const { token, writeOpen } = useSa();
  const orgId = (orgParam ?? '') as Id<'organizations'>;
  const stores = useQuery(listStoresRef, { saToken: token });
  const store = stores?.find((s) => s._id === orgId);

  const domains = useQuery(listDomainsRef, { saToken: token, orgId });
  const addDomain = useMutation(addDomainRef);
  const setPrimary = useMutation(setPrimaryRef);
  const provisionSubdomain = useMutation(provisionSubdomainRef);
  const refreshDomain = useAction(refreshDomainStatusRef);
  const removeDomain = useAction(removeDomainRef);
  const domainStatus = useInlineStatus();
  const [hostname, setHostname] = useState('');

  const members = useQuery(listMembersRef, { saToken: token, orgId });
  const addAdmin = useMutation(addStoreAdminRef);
  const removeMember = useMutation(removeMemberRef);
  const memberStatus = useInlineStatus();
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('admin');

  const runDomain = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      domainStatus.setOk(ok);
    } catch (err) {
      domainStatus.setError(saErrorMessage(err));
    }
  };

  const onAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    const host = hostname;
    await runDomain(async () => {
      await addDomain({ saToken: token, orgId, hostname: host });
      setHostname('');
    }, `Added ${host}. It stays pending until Cloudflare reports it active.`);
  };

  const onProvision = () =>
    void runDomain(async () => {
      const res = await provisionSubdomain({ saToken: token, orgId });
      if (!res.created) {
        throw new Error(
          res.reason === 'exists'
            ? `${res.hostname} is already set up.`
            : `No subdomain was created (${res.reason ?? 'unknown'}).`,
        );
      }
    }, `Provisioning ${store?.slug ?? 'store'} subdomain. It turns active once Cloudflare reports it.`);

  const onMakePrimary = (d: DomainRow) => {
    if (!window.confirm(`Make ${d.hostname} the primary domain?\n\n${PRIMARY_WARNING}`)) return;
    void runDomain(() => setPrimary({ saToken: token, domainId: d._id }), `${d.hostname} is now the primary domain.`);
  };

  const onAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addAdmin({ saToken: token, orgId, phone, role });
      memberStatus.setOk(`Saved ${phone} as ${role}.`);
      setPhone('');
    } catch (err) {
      memberStatus.setError(saErrorMessage(err));
    }
  };

  const hasSubdomain = (domains ?? []).some((d) => d.managed);
  const pendingWithDns = (domains ?? []).filter((d) => d.status === 'pending' && d.dnsInstructions);

  return (
    <div className="space-y-6">
      <Link to="/sa/stores" className="text-sm underline">Back to stores</Link>
      <h1 className="text-xl font-bold">
        {store?.name ?? 'Store'} <span className="font-mono text-sm text-muted-foreground">{store?.slug}</span>
      </h1>

      <section className="rounded-xl border p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Domains</h2>
          {store && !hasSubdomain && (
            <Button variant="secondary" size="sm" disabled={!writeOpen} onClick={onProvision}>
              Provision subdomain
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Status is derived from Cloudflare Pages and rechecked automatically (every 15 minutes, active domains every
          6 hours). Platform hosts (cigarro.in) are never sent to Cloudflare. The platform-managed subdomain
          {store ? ` ${store.slug}.cigarro.in` : ''} is registered on Cloudflare for you.
        </p>
        <form onSubmit={onAddDomain} className="grid gap-3 sm:grid-cols-4 items-end">
          <div className="sm:col-span-3">
            <Label htmlFor="sa-host">Hostname</Label>
            <Input id="sa-host" value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="shop.example.com" required disabled={!writeOpen} />
          </div>
          <Button type="submit" disabled={!writeOpen}>Add domain</Button>
        </form>
        {domains && domains.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hostname</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cloudflare</TableHead>
                  <TableHead>Last checked</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains.map((d) => (
                  <TableRow key={d._id}>
                    <TableCell className="font-mono text-sm">
                      <div>{d.hostname}</div>
                      <div className="mt-1"><ManagedBadge managed={d.managed} /></div>
                    </TableCell>
                    <TableCell>{d.kind}</TableCell>
                    <TableCell><StatusBadge status={d.status} /></TableCell>
                    <TableCell>
                      {d.cfManaged ? (
                        <div className="space-y-1">
                          <span className="font-mono text-sm">{d.cfStatus ?? 'not synced'}</span>
                          {d.cfError && <p className="text-xs text-red-700">{d.cfError}</p>}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">platform</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{relativeTime(d.cfCheckedAt)}</TableCell>
                    <TableCell className="text-right space-x-2 whitespace-nowrap">
                      {d.cfManaged && (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!writeOpen}
                          onClick={() =>
                            void runDomain(
                              () => refreshDomain({ saToken: token, domainId: d._id }),
                              `Refreshed ${d.hostname} from Cloudflare.`,
                            )
                          }
                        >
                          Refresh now
                        </Button>
                      )}
                      {d.status === 'active' && d.kind === 'alias' && d.cfManaged && (
                        <Button variant="secondary" size="sm" disabled={!writeOpen} onClick={() => onMakePrimary(d)}>
                          Make primary
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!writeOpen}
                        onClick={() => {
                          const cfNote = d.cfManaged ? ' It is removed from Cloudflare Pages too.' : '';
                          if (window.confirm(`Remove ${d.hostname}?${cfNote}`)) {
                            void runDomain(() => removeDomain({ saToken: token, domainId: d._id }), `Removed ${d.hostname}.`);
                          }
                        }}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="text-sm text-amber-800">{PRIMARY_WARNING}</p>

        {pendingWithDns.map((d) => (
          <div key={`dns-${d._id}`} className="rounded-lg border bg-muted/40 p-3 space-y-2 text-sm">
            <p className="font-medium">DNS for {d.hostname}</p>
            <DnsInstructions domain={d} />
            <p className="text-xs text-muted-foreground">
              Apex domains (no subdomain) need a DNS provider that supports CNAME flattening, or use a www subdomain.
            </p>
          </div>
        ))}
        <InlineStatus status={domainStatus.status} />
      </section>

      <section className="rounded-xl border p-4 space-y-4">
        <h2 className="font-semibold">Members</h2>
        <form onSubmit={onAddMember} className="grid gap-3 sm:grid-cols-4 items-end">
          <div>
            <Label htmlFor="sa-phone">Phone</Label>
            <Input id="sa-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" required disabled={!writeOpen} />
          </div>
          <div>
            <Label htmlFor="sa-role">Role</Label>
            <select id="sa-role" className="h-9 w-full rounded-md border px-2 text-sm" value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={!writeOpen}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <Button type="submit" disabled={!writeOpen}>Add or update</Button>
        </form>
        {members && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phone</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m._id}>
                  <TableCell className="font-mono text-sm">{m.phone ?? '-'}</TableCell>
                  <TableCell>{m.name ?? '-'}</TableCell>
                  <TableCell>{m.role}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!writeOpen}
                      onClick={() => {
                        if (!window.confirm(`Remove ${m.phone ?? 'this member'}?`)) return;
                        removeMember({ saToken: token, membershipId: m._id })
                          .then(() => memberStatus.setOk('Member removed.'))
                          .catch((err) => memberStatus.setError(saErrorMessage(err)));
                      }}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <InlineStatus status={memberStatus.status} />
      </section>
    </div>
  );
}
