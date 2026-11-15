// Shared pieces for the super-admin payments pipeline pages: outcome labels,
// money with paise, and the message row (full text, decision, linked order).
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MessageSquare } from 'lucide-react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { Badge, formatOrderNumber, type BadgeTone } from '../../adminnew/ui';
import { formatDateTime } from '../saUi';

export type Outcome = 'matched' | 'credit_unmatched' | 'ignored' | 'duplicate' | 'setup_error';
export type Channel = 'sms' | 'email';

export const OUTCOME: Record<Outcome, { label: string; tone: BadgeTone }> = {
  matched: { label: 'Matched', tone: 'success' },
  credit_unmatched: { label: 'Credit not matched', tone: 'warning' },
  ignored: { label: 'Ignored', tone: 'neutral' },
  duplicate: { label: 'Duplicate', tone: 'info' },
  setup_error: { label: 'Setup error', tone: 'critical' },
};

export const OUTCOME_ORDER: Outcome[] = ['matched', 'credit_unmatched', 'duplicate', 'ignored', 'setup_error'];

/** Rupees with paise always shown: the paise slot is what identifies an order. */
export function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function OutcomeBadge({ outcome, suffix }: { outcome: Outcome; suffix?: string }) {
  const o = OUTCOME[outcome];
  return (
    <Badge tone={o.tone} dot>
      {o.label}
      {suffix ? ` ${suffix}` : ''}
    </Badge>
  );
}

export function ChannelTag({ channel }: { channel: Channel }) {
  const Icon = channel === 'sms' ? MessageSquare : Mail;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--admin-text-muted)]">
      <Icon className="size-3.5" aria-hidden />
      {channel === 'sms' ? 'SMS' : 'Email'}
    </span>
  );
}

export function orderPath(orgId: Id<'organizations'>, orderId: Id<'orders'>): string {
  return `/sa/stores/${orgId}/orders/${orderId}`;
}

/** Full message text, clamped to a few lines until opened. */
export function MessageText({ body, subject }: { body: string; subject?: string | null }) {
  const [open, setOpen] = useState(false);
  const long = body.length > 280 || body.split('\n').length > 4;
  return (
    <div className="rounded-[var(--admin-radius-sm)] border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3 py-2">
      {subject && <p className="mb-1 text-[13px] font-medium text-[var(--admin-text)]">{subject}</p>}
      <p
        className={`whitespace-pre-wrap break-words font-mono text-[12.5px] leading-5 text-[var(--admin-text)] ${
          long && !open ? 'line-clamp-4' : ''
        }`}
      >
        {body || <span className="italic text-[var(--admin-text-subtle)]">(empty)</span>}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-1 text-xs font-medium text-[var(--admin-primary)] hover:underline"
        >
          {open ? 'Show less' : 'Show all'}
        </button>
      )}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-[var(--admin-text-muted)]">{label}</span>
      <span className="font-medium text-[var(--admin-text)]">{children}</span>
    </span>
  );
}

export type MessageRowData = FunctionReturnType<typeof api.pipeline.listMessages>['page'][number];

export function MessageRow({ m, showStore }: { m: MessageRowData; showStore: boolean }) {
  const dupSuffix = m.outcome === 'duplicate' && m.duplicateOfChannel ? `(also via ${m.duplicateOfChannel === 'sms' ? 'SMS' : 'email'})` : undefined;
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="w-28 shrink-0 text-xs tabular-nums text-[var(--admin-text-muted)]">{formatDateTime(m.at)}</span>
        {showStore && m.store && (
          <Link to={`/sa/stores/${m.orgId}`} className="text-xs font-medium text-[var(--admin-text)] hover:underline">
            {m.store.name}
          </Link>
        )}
        <ChannelTag channel={m.channel} />
        <span className="min-w-0 truncate font-mono text-xs text-[var(--admin-text)]" title={m.sender}>
          {m.sender}
        </span>
        <span className="ml-auto">
          <OutcomeBadge outcome={m.outcome} suffix={dupSuffix} />
        </span>
      </div>
      <MessageText body={m.body} subject={m.subject} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
        {m.amountPaise !== undefined && <Fact label="Amount">{rupees(m.amountPaise)}</Fact>}
        {m.upiRef && (
          <Fact label="UPI ref">
            <span className="font-mono">{m.upiRef}</span>
          </Fact>
        )}
        {m.order && (
          <Fact label="Order">
            <Link to={orderPath(m.order.orgId, m.order._id)} className="text-[var(--admin-primary)] hover:underline">
              {formatOrderNumber(m.order.orderNumber, m.order.displayOrderId)}
            </Link>
          </Fact>
        )}
        <span className="text-[var(--admin-text-muted)]">{m.reason}</span>
      </div>
      {m.candidates.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
          <span className="text-[var(--admin-text-muted)]">Close orders:</span>
          {m.candidates.map((c) => (
            <Link
              key={c._id}
              to={orderPath(c.orgId, c._id)}
              className="rounded-full border border-[var(--admin-border)] px-2 py-0.5 text-xs hover:bg-[var(--admin-neutral-soft)]"
            >
              {formatOrderNumber(c.orderNumber, c.displayOrderId)} · {rupees(c.finalAmountPaise)} · {c.status}
            </Link>
          ))}
        </div>
      )}
    </li>
  );
}
