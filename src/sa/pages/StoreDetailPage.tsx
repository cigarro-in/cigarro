import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { InlineStatus, useInlineStatus } from '../../components/common/InlineStatus';
import type { Id } from '../../../convex/_generated/dataModel';
import { useSa } from '../SuperGate';
import { saErrorMessage } from '../session';
import {
  addDomainRef,
  addStoreAdminRef,
  listDomainsRef,
  listMembersRef,
  listStoresRef,
  removeDomainRef,
  removeMemberRef,
  setDomainStatusRef,
  type Role,
} from '../refs';

const ROLES: Role[] = ['owner', 'admin', 'staff', 'customer'];
type DomainStatus = 'pending' | 'active' | 'disabled';
const DOMAIN_STATUSES: DomainStatus[] = ['pending', 'active', 'disabled'];

export function StoreDetailPage() {
  const { orgId: orgParam } = useParams();
  const { token, writeOpen } = useSa();
  const orgId = (orgParam ?? '') as Id<'organizations'>;
  const stores = useQuery(listStoresRef, { saToken: token });
  const store = stores?.find((s) => s._id === orgId);

  const domains = useQuery(listDomainsRef, { saToken: token, orgId });
  const addDomain = useMutation(addDomainRef);
  const setDomainStatus = useMutation(setDomainStatusRef);
  const removeDomain = useMutation(removeDomainRef);
  const domainStatus = useInlineStatus();
  const [hostname, setHostname] = useState('');
  const [kind, setKind] = useState<'primary' | 'alias'>('alias');

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
      await addDomain({ saToken: token, orgId, hostname: host, kind });
      setHostname('');
    }, `Added ${host}. It stays pending until set active.`);
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

  return (
    <div className="space-y-6">
      <Link to="/sa/stores" className="text-sm underline">Back to stores</Link>
      <h1 className="text-xl font-bold">
        {store?.name ?? 'Store'} <span className="font-mono text-sm text-muted-foreground">{store?.slug}</span>
      </h1>

      <section className="rounded-xl border p-4 space-y-4">
        <h2 className="font-semibold">Domains</h2>
        <form onSubmit={onAddDomain} className="grid gap-3 sm:grid-cols-4 items-end">
          <div className="sm:col-span-2">
            <Label htmlFor="sa-host">Hostname</Label>
            <Input id="sa-host" value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="shop.example.com" required disabled={!writeOpen} />
          </div>
          <div>
            <Label htmlFor="sa-kind">Kind</Label>
            <select id="sa-kind" className="h-9 w-full rounded-md border px-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value as 'primary' | 'alias')} disabled={!writeOpen}>
              <option value="alias">alias</option>
              <option value="primary">primary</option>
            </select>
          </div>
          <Button type="submit" disabled={!writeOpen}>Add domain</Button>
        </form>
        {domains && domains.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hostname</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.map((d) => (
                <TableRow key={d._id}>
                  <TableCell className="font-mono text-sm">{d.hostname}</TableCell>
                  <TableCell>{d.kind}</TableCell>
                  <TableCell>
                    <select
                      aria-label={`Status for ${d.hostname}`}
                      className="h-8 rounded-md border px-2 text-sm"
                      value={d.status}
                      disabled={!writeOpen}
                      onChange={(e) =>
                        void runDomain(
                          () => setDomainStatus({ saToken: token, domainId: d._id, status: e.target.value as DomainStatus }),
                          `${d.hostname} set to ${e.target.value}.`,
                        )
                      }
                    >
                      {DOMAIN_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!writeOpen}
                      onClick={() => {
                        if (window.confirm(`Remove ${d.hostname}?`)) {
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
        )}
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
