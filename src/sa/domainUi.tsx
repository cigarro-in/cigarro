import type { DomainRow, DomainStatus } from './refs';

const STATUS_STYLE: Record<DomainStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-100 text-green-800' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-900' },
  error: { label: 'Error', className: 'bg-red-100 text-red-800' },
  disabled: { label: 'Disabled (legacy)', className: 'bg-muted text-muted-foreground' },
};

export const STATUS_RANK: Record<DomainStatus, number> = {
  error: 0,
  pending: 1,
  disabled: 2,
  active: 3,
};

export function StatusBadge({ status }: { status: DomainStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${style.className}`}>
      {style.label}
    </span>
  );
}

export function ManagedBadge({ managed }: { managed?: boolean }) {
  if (!managed) return null;
  return (
    <span
      title="Platform-managed subdomain"
      className="inline-flex rounded-full border px-2 py-0.5 text-xs whitespace-nowrap text-muted-foreground"
    >
      Platform-managed
    </span>
  );
}

// Coarse relative time ("5m ago"). Missing timestamps read as "never".
export function relativeTime(ts: number | undefined, now: number = Date.now()): string {
  if (ts === undefined) return 'never';
  const sec = Math.max(0, Math.round((now - ts) / 1000));
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

export function DnsInstructions({ domain }: { domain: DomainRow }) {
  const dns = domain.dnsInstructions;
  if (!dns) return null;
  return (
    <details className="text-xs">
      <summary className="cursor-pointer underline">DNS instructions</summary>
      <div className="mt-2 space-y-1 rounded-md border bg-muted/40 p-2">
        <p>
          CNAME <span className="font-mono">{domain.hostname}</span> to{' '}
          <span className="font-mono">{dns.cnameTarget}</span>
        </p>
        {dns.txtRecords.map((t) => (
          <p key={`${t.name}-${t.value}`} className="font-mono break-all">
            TXT {t.name} = {t.value}
          </p>
        ))}
      </div>
    </details>
  );
}
