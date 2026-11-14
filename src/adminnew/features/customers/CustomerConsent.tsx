import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { Badge, Card, EmptyState, Skeleton } from '../../ui';
import { ShieldCheck } from 'lucide-react';

const KIND_LABEL: Record<string, string> = {
  age_confirmation: 'Age 18+',
  terms_acceptance: 'Terms',
  privacy_acceptance: 'Privacy policy',
  marketing_optin: 'Marketing messages',
};

const SOURCE_LABEL: Record<string, string> = {
  age_gate: 'Age gate',
  signup: 'Sign-in (carried over)',
  checkout: 'Checkout',
};

function formatWhen(ts: number): string {
  return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Append-only consent log for one customer in this store. Rows are never edited:
// a new decision is a new row, shown newest first.
export function CustomerConsent({ orgId, userId }: { orgId: Id<'organizations'>; userId: string }) {
  const rows = useQuery(api.consent.listForCustomer, { orgId, userId });

  return (
    <Card padding="none" title="Consent">
      {rows === undefined ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck />}
          title="No consent recorded"
          description="Nothing is logged for this customer yet. Consent is recorded at the age gate and at checkout."
        />
      ) : (
        <ul className="divide-y divide-[var(--admin-border)]">
          {rows.map((row) => (
            <li key={row._id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={row.granted ? 'success' : 'critical'}>{row.granted ? 'Granted' : 'Withdrawn'}</Badge>
                <span className="font-medium">{KIND_LABEL[row.kind] ?? row.kind}</span>
              </div>
              <div className="text-[13px] text-[var(--admin-text-muted)]">
                <span>{formatWhen(row.at)}</span>
                <span> · {SOURCE_LABEL[row.source] ?? row.source}</span>
                {row.pagePath && <span> · {row.pagePath}</span>}
                {row.ip && <span> · IP {row.ip}</span>}
                <span className="block font-mono text-xs">Wording {row.textVersion}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
