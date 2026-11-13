// Shared super-admin UI helpers. Built on the admin primitives (src/adminnew/ui)
// so /sa and the store admin look identical. Imports only; never edits them.
import type { ReactNode } from 'react';
import { Badge, type BadgeTone } from '../adminnew/ui';
import { saErrorMessage } from './session';
import type { DomainStatus, Role } from './refs';

// Turns a Convex/SA error into an Error with the friendly message and the
// server code, so Button feedback (useButtonFeedback) shows both.
export function saError(err: unknown): Error {
  const code = (err as { data?: { code?: string } })?.data?.code;
  return Object.assign(new Error(saErrorMessage(err)), { code });
}

export async function runSa<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw saError(err);
  }
}

export const DOMAIN_STATUS: Record<DomainStatus, { label: string; tone: BadgeTone }> = {
  active: { label: 'Active', tone: 'success' },
  pending: { label: 'Pending', tone: 'warning' },
  error: { label: 'Error', tone: 'critical' },
  disabled: { label: 'Disabled', tone: 'neutral' },
};

export function DomainStatusBadge({ status }: { status: DomainStatus }) {
  const s = DOMAIN_STATUS[status];
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
}

export function StoreStateBadge({ active }: { active: boolean }) {
  return active ? <Badge tone="success" dot>Active</Badge> : <Badge tone="neutral" dot>Suspended</Badge>;
}

export function GmailBadge({ state }: { state: 'connected' | 'needs_reconnect' | 'not_connected' }) {
  if (state === 'connected') return <Badge tone="success" dot>Connected</Badge>;
  if (state === 'needs_reconnect') return <Badge tone="warning" dot>Needs reconnect</Badge>;
  return <Badge tone="critical" dot>Not connected</Badge>;
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  staff: 'Staff',
  customer: 'Customer',
};

export function ManagedTag({ managed }: { managed?: boolean }) {
  if (!managed) return null;
  return (
    <Badge tone="attention" className="font-normal" >
      Platform subdomain
    </Badge>
  );
}

// Compact label/value list: label left, value right, hairline between rows.
export function KeyValues({ items }: { items: { label: string; value: ReactNode; mono?: boolean }[] }) {
  return (
    <dl className="divide-y divide-[var(--admin-border)] text-sm">
      {items.map((it) => (
        <div key={it.label} className="flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0">
          <dt className="shrink-0 text-[var(--admin-text-muted)]">{it.label}</dt>
          <dd className={`min-w-0 truncate text-right text-[var(--admin-text)] ${it.mono ? 'font-mono text-[13px]' : ''}`}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// One number with a label, for stat grids. Optional link and warning tint.
export function StatTile({ label, value, hint, attention }: { label: string; value: ReactNode; hint?: ReactNode; attention?: boolean }) {
  return (
    <div className="min-w-0 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <p className="truncate text-[13px] font-medium text-[var(--admin-text-muted)]">{label}</p>
      <p
        className={`mt-2 truncate text-2xl font-semibold tracking-[-0.02em] tabular-nums ${
          attention ? 'text-[var(--admin-warning)]' : 'text-[var(--admin-text)]'
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 truncate text-xs text-[var(--admin-text-muted)]">{hint}</p>}
    </div>
  );
}

// Small round health marker: green tick when ok, amber dot otherwise.
export function HealthDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--admin-text-muted)]">
      <span
        aria-hidden
        className={`size-2 shrink-0 rounded-full ${ok ? 'bg-[var(--admin-success)]' : 'bg-[var(--admin-warning)]'}`}
      />
      <span className={ok ? '' : 'text-[var(--admin-text)]'}>{label}</span>
      <span className="sr-only">{ok ? 'ok' : 'needs attention'}</span>
    </span>
  );
}

// "cleanSmokeshopDescriptions-v1" -> "Clean smokeshop descriptions (v1)".
export function migrationLabel(name: string): string {
  const m = name.match(/^(.*?)(?:-(v\d+))?$/);
  const base = (m?.[1] ?? name)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
  const label = base.charAt(0).toUpperCase() + base.slice(1);
  return m?.[2] ? `${label} (${m[2]})` : label;
}

// Coarse relative time ("5m ago"). Missing timestamps read as "never".
export function relativeTime(ts: number | undefined, now: number = Date.now()): string {
  if (ts === undefined) return 'Never';
  const sec = Math.max(0, Math.round((now - ts) / 1000));
  if (sec < 60) return 'Just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function formatCount(n: number): string {
  return n.toLocaleString('en-IN');
}

// DNS records the merchant must add (shown on pending domains).
export function DnsRecords({ hostname, cnameTarget, txtRecords }: { hostname: string; cnameTarget: string; txtRecords: { name: string; value: string }[] }) {
  return (
    <div className="space-y-2 rounded-[var(--admin-radius-sm)] border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] p-3 text-[13px]">
      <p>
        CNAME <span className="font-mono">{hostname}</span> to <span className="font-mono break-all">{cnameTarget}</span>
      </p>
      {txtRecords.map((t) => (
        <p key={`${t.name}-${t.value}`} className="break-all font-mono text-xs">
          TXT {t.name} = {t.value}
        </p>
      ))}
      <p className="text-xs text-[var(--admin-text-muted)]">
        Apex domains need a DNS provider that supports CNAME flattening, or use a www subdomain.
      </p>
    </div>
  );
}

// Centered sign-in frame, same geometry as src/adminnew/AdminLogin.tsx.
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center bg-[var(--admin-bg)] px-4 pt-[12vh]">
      <p className="mb-6 text-lg font-semibold tracking-[-0.02em] text-[var(--admin-text)]">Cigarro</p>
      <div className="w-full max-w-[380px] rounded-[12px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 sm:p-7">
        {children}
      </div>
    </div>
  );
}
