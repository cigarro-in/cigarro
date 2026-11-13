// One store's web addresses as compact rows: address, status, one clear action.
// Rare actions (remove, refresh on a live domain) sit in the row's overflow menu.
// Shared by DomainsPage (grouped by store) and the store page Domains tab.
import { ExternalLink, MoreHorizontal } from 'lucide-react';
import { Button, Menu, type MenuItem } from '../adminnew/ui';
import { DnsRecords, DomainStatusBadge, relativeTime } from './saUi';
import type { DomainRow } from './refs';

export const PRIMARY_WARNING =
  "Visitors and search engines move to this address. Only do this after the store's DNS points here.";

export interface DomainListProps<D extends DomainRow> {
  domains: D[];
  writeOpen: boolean;
  busyId: string | null;
  onRefresh: (d: D) => void;
  onMakePrimary: (d: D) => void;
  onRemove: (d: D) => void;
}

export function DomainList<D extends DomainRow>({ domains, writeOpen, busyId, onRefresh, onMakePrimary, onRemove }: DomainListProps<D>) {
  return (
    <ul className="divide-y divide-[var(--admin-border)]">
      {domains.map((d) => (
        <DomainItem
          key={d._id}
          d={d}
          writeOpen={writeOpen}
          busy={busyId === d._id}
          onRefresh={onRefresh}
          onMakePrimary={onMakePrimary}
          onRemove={onRemove}
        />
      ))}
    </ul>
  );
}

function DomainItem<D extends DomainRow>({
  d,
  writeOpen,
  busy,
  onRefresh,
  onMakePrimary,
  onRemove,
}: {
  d: D;
  writeOpen: boolean;
  busy: boolean;
  onRefresh: (d: D) => void;
  onMakePrimary: (d: D) => void;
  onRemove: (d: D) => void;
}) {
  const canRefresh = d.cfManaged;
  const canMakePrimary = d.status === 'active' && d.kind === 'alias' && d.cfManaged;
  const notLive = d.status !== 'active';

  // The single visible action for this row.
  let main: 'refresh' | 'primary' | 'visit' | null = null;
  if (notLive && canRefresh) main = 'refresh';
  else if (canMakePrimary) main = 'primary';
  else if (d.status === 'active') main = 'visit';

  const more: MenuItem[] = [
    ...(canRefresh && main !== 'refresh'
      ? [{ label: 'Check status now', disabled: !writeOpen || busy, onSelect: () => onRefresh(d) }]
      : []),
    ...(canMakePrimary && main !== 'primary'
      ? [{ label: 'Make main address', disabled: !writeOpen || busy, onSelect: () => onMakePrimary(d) }]
      : []),
    { label: 'Remove address', tone: 'critical' as const, disabled: !writeOpen || busy, onSelect: () => onRemove(d) },
  ];

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-56">
          <p className="truncate font-mono text-[13px] text-[var(--admin-text)]">{d.hostname}</p>
          <p className="mt-0.5 text-xs text-[var(--admin-text-muted)]">
            {d.kind === 'primary' ? 'Main address' : 'Extra address'}
            {d.managed ? ' · free cigarro.in address' : ''}
            {notLive && d.cfManaged ? ` · checked ${relativeTime(d.cfCheckedAt).toLowerCase()}` : ''}
          </p>
        </div>
        <DomainStatusBadge status={d.status} />
        <div className="flex shrink-0 items-center gap-1">
          {main === 'refresh' && (
            <Button size="sm" variant="secondary" disabled={!writeOpen || busy} loading={busy} onClick={() => onRefresh(d)}>
              Check again
            </Button>
          )}
          {main === 'primary' && (
            <Button size="sm" variant="secondary" disabled={!writeOpen || busy} onClick={() => onMakePrimary(d)}>
              Make main
            </Button>
          )}
          {main === 'visit' && (
            <Button asChild size="sm" variant="plain">
              <a href={`https://${d.hostname}`} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden className="size-3.5" />
                Visit
              </a>
            </Button>
          )}
          <Menu
            align="end"
            trigger={
              <Button variant="plain" size="icon" aria-label={`More for ${d.hostname}`} disabled={busy}>
                <MoreHorizontal aria-hidden />
              </Button>
            }
            items={more}
          />
        </div>
      </div>
      {d.cfError && <p className="mt-2 max-w-prose break-words text-xs text-[var(--admin-critical)]">{d.cfError}</p>}
      {d.status === 'pending' && d.dnsInstructions && (
        <details className="mt-2 max-w-2xl text-xs">
          <summary className="cursor-pointer font-medium text-[var(--admin-primary)]">How to connect this address</summary>
          <div className="mt-2">
            <DnsRecords hostname={d.hostname} cnameTarget={d.dnsInstructions.cnameTarget} txtRecords={d.dnsInstructions.txtRecords} />
          </div>
        </details>
      )}
    </li>
  );
}
