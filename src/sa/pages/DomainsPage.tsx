import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAction, useMutation, useQuery } from 'convex/react';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { InlineStatus, useInlineStatus } from '../../components/common/InlineStatus';
import { useSa } from '../SuperGate';
import { saErrorMessage } from '../session';
import { DnsInstructions, ManagedBadge, relativeTime, STATUS_RANK, StatusBadge } from '../domainUi';
import {
  listAllDomainsRef,
  refreshDomainStatusRef,
  removeDomainRef,
  setPrimaryRef,
  type AllDomainRow,
} from '../refs';

const PRIMARY_WARNING =
  "Switching primary moves canonical URLs to that domain. Only do this after the merchant's DNS points there.";

export function DomainsPage() {
  const { token, writeOpen } = useSa();
  const domains = useQuery(listAllDomainsRef, { saToken: token });
  const refresh = useAction(refreshDomainStatusRef);
  const setPrimary = useMutation(setPrimaryRef);
  const removeDomain = useAction(removeDomainRef);
  const status = useInlineStatus();
  const [busyId, setBusyId] = useState<string | null>(null);

  const run = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusyId(id);
    try {
      await fn();
      status.setOk(ok);
    } catch (err) {
      status.setError(saErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const onMakePrimary = (d: AllDomainRow) => {
    if (!window.confirm(`Make ${d.hostname} the primary domain of ${d.storeName}?\n\n${PRIMARY_WARNING}`)) return;
    void run(d._id, () => setPrimary({ saToken: token, domainId: d._id }), `${d.hostname} is now the primary domain.`);
  };

  const onRemove = (d: AllDomainRow) => {
    const notes = [
      d.cfManaged ? 'It is removed from Cloudflare Pages too.' : '',
      d.kind === 'primary' ? 'It is the primary, so another domain of this store is promoted.' : '',
    ]
      .filter(Boolean)
      .join(' ');
    if (!window.confirm(`Remove ${d.hostname} from ${d.storeName}?${notes ? `\n\n${notes}` : ''}`)) return;
    void run(d._id, () => removeDomain({ saToken: token, domainId: d._id }), `Removed ${d.hostname}.`);
  };

  const rows = [...(domains ?? [])].sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      a.storeName.localeCompare(b.storeName) ||
      a.hostname.localeCompare(b.hostname),
  );
  const counts = rows.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Domains</h1>
      <p className="text-sm text-muted-foreground">
        Status is derived from Cloudflare Pages and rechecked every 15 minutes (active domains every 6 hours).
        Nothing here sets status by hand.
      </p>

      {domains === undefined ? (
        <p className="text-sm text-muted-foreground">Loading domains...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No domains yet.</p>
      ) : (
        <>
          <p className="text-sm">
            {rows.length} domains: {counts.active ?? 0} active, {counts.pending ?? 0} pending,{' '}
            {counts.error ?? 0} error
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Hostname</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cloudflare</TableHead>
                  <TableHead>Last checked</TableHead>
                  <TableHead>Last active</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((d) => {
                  const busy = busyId === d._id;
                  return (
                    <TableRow key={d._id}>
                      <TableCell className="text-sm">
                        <Link to={`/sa/stores/${d.orgId}`} className="underline">{d.storeName}</Link>
                        {!d.storeActive && <span className="ml-1 text-xs text-muted-foreground">(suspended)</span>}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        <div>{d.hostname}</div>
                        <div className="mt-1"><ManagedBadge managed={d.managed} /></div>
                        {d.status === 'pending' && d.dnsInstructions && (
                          <div className="mt-1"><DnsInstructions domain={d} /></div>
                        )}
                      </TableCell>
                      <TableCell>{d.kind}</TableCell>
                      <TableCell><StatusBadge status={d.status} /></TableCell>
                      <TableCell className="font-mono text-xs">
                        {d.cfManaged ? (d.cfStatus ?? 'not synced') : 'platform'}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{relativeTime(d.cfCheckedAt)}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{relativeTime(d.lastActiveAt)}</TableCell>
                      <TableCell className="text-xs text-red-700 max-w-xs break-words">{d.cfError ?? ''}</TableCell>
                      <TableCell className="text-right space-x-2 whitespace-nowrap">
                        {d.cfManaged && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={!writeOpen || busy}
                            onClick={() =>
                              void run(d._id, () => refresh({ saToken: token, domainId: d._id }), `Refreshed ${d.hostname}.`)
                            }
                          >
                            Refresh now
                          </Button>
                        )}
                        {d.status === 'active' && d.kind === 'alias' && d.cfManaged && (
                          <Button variant="secondary" size="sm" disabled={!writeOpen || busy} onClick={() => onMakePrimary(d)}>
                            Make primary
                          </Button>
                        )}
                        <Button variant="secondary" size="sm" disabled={!writeOpen || busy} onClick={() => onRemove(d)}>
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
      <p className="text-sm text-amber-800">{PRIMARY_WARNING}</p>
      <InlineStatus status={status.status} />
    </div>
  );
}
