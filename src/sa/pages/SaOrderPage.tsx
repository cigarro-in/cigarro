import { useParams } from 'react-router-dom';
import { useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { Badge, Card, EmptyState, Page, PageLayout, Skeleton, StatusBadge, formatOrderNumber } from '../../adminnew/ui';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useSa } from '../SuperGate';
import { KeyValues, formatDateTime } from '../saUi';
import { ChannelTag, MessageText, rupees } from '../payments/shared';
import { AmountCell, SourceBadge } from '../payments/StoreOrdersTab';

type Data = NonNullable<FunctionReturnType<typeof api.pipeline.getStoreOrder>>;
type Evidence = Data['evidence'][number];

const ROLE: Record<Evidence['role'], { label: string; tone: 'success' | 'info' | 'neutral' }> = {
  confirmed: { label: 'Confirmed this order', tone: 'success' },
  duplicate: { label: 'Duplicate', tone: 'info' },
  linked: { label: 'Linked', tone: 'neutral' },
};

function EvidenceItem({ e, orderAmount, showRole }: { e: Evidence; orderAmount: number; showRole: boolean }) {
  const diff = e.amountPaise - orderAmount;
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-xs tabular-nums text-[var(--admin-text-muted)]">{formatDateTime(e.at)}</span>
        <ChannelTag channel={e.channel} />
        <span className="min-w-0 truncate font-mono text-xs" title={e.sender}>
          {e.sender}
        </span>
        {showRole && (
          <span className="ml-auto">
            <Badge tone={ROLE[e.role].tone} dot>
              {ROLE[e.role].label}
            </Badge>
          </span>
        )}
      </div>
      <MessageText body={e.body} subject={e.subject} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
        <span>
          <span className="text-[var(--admin-text-muted)]">Amount </span>
          <span className="font-medium tabular-nums">{e.amountPaise > 0 ? rupees(e.amountPaise) : 'not read'}</span>
          {!showRole && e.amountPaise > 0 && diff !== 0 && (
            <span className="ml-1 text-xs text-[var(--admin-warning)]">
              ({diff > 0 ? '+' : '-'}
              {Math.abs(diff)}p vs order)
            </span>
          )}
        </span>
        {e.upiRef && (
          <span>
            <span className="text-[var(--admin-text-muted)]">UPI ref </span>
            <span className="font-mono">{e.upiRef}</span>
          </span>
        )}
        <span className="text-[var(--admin-text-muted)]">{e.reason}</span>
      </div>
    </li>
  );
}

const CLAIM_OUTCOME: Record<'review' | 'rejected' | 'confirmed', { label: string; tone: 'attention' | 'critical' | 'success' }> = {
  review: { label: 'Under review', tone: 'attention' },
  rejected: { label: 'Rejected', tone: 'critical' },
  confirmed: { label: 'Confirmed', tone: 'success' },
};

// What the customer reported when auto-confirmation failed, and how it ended.
function ClaimRow({ claim, orderAmount }: { claim: NonNullable<Data['order']['paymentClaim']>; orderAmount?: number }) {
  const outcome = CLAIM_OUTCOME[claim.status];
  return (
    <div className="flex flex-col gap-1.5 border-b border-[var(--admin-border)] px-4 py-3 text-[13px]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-medium">Customer claim</span>
        <Badge tone={outcome.tone} dot>
          {outcome.label}
        </Badge>
        {claim.status === 'confirmed' && claim.confirmedVia && (
          <span className="text-[var(--admin-text-muted)]">
            via {claim.confirmedVia === 'auto' ? 'bank message' : 'admin'}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          <span className="text-[var(--admin-text-muted)]">UPI ref </span>
          <span className="font-mono">{claim.utr}</span>
        </span>
        <span>
          <span className="text-[var(--admin-text-muted)]">Submitted </span>
          <span className="tabular-nums">{formatDateTime(claim.submittedAt)}</span>
        </span>
        {claim.reviewedAt && (
          <span>
            <span className="text-[var(--admin-text-muted)]">Reviewed </span>
            <span className="tabular-nums">{formatDateTime(claim.reviewedAt)}</span>
          </span>
        )}
      </div>
      {claim.bankMessage && (
        <span className="text-[var(--admin-text-muted)]">
          Bank message found: {rupees(claim.bankMessage.amountPaise)} at {formatDateTime(claim.bankMessage.at)}
          {orderAmount !== undefined && claim.bankMessage.amountPaise !== orderAmount ? ' (amount differs)' : ''}
        </span>
      )}
      {claim.status === 'rejected' && claim.rejectReason && (
        <span className="text-[var(--admin-text-muted)]">Reason: {claim.rejectReason}</span>
      )}
    </div>
  );
}

// Read-only order view for the super admin: summary plus every bank SMS and
// email linked to it, and unmatched credits that came close.
export function SaOrderPage() {
  const { orgId, orderId } = useParams();
  const { token } = useSa();
  const data = useQuery(api.pipeline.getStoreOrder, { saToken: token, orderId: orderId as Id<'orders'> });
  const backTo = `/sa/stores/${orgId}?tab=orders`;

  if (data === null) {
    return (
      <Page title="Order" backTo={backTo}>
        <Card>
          <EmptyState title="Order not found" description="It may belong to another deployment. Go back to the store's orders." />
        </Card>
      </Page>
    );
  }

  const o = data?.order;
  return (
    <Page
      title={o ? `Order ${formatOrderNumber(o.orderNumber, o.displayOrderId)}` : <Skeleton className="inline-block h-6 w-40 align-middle" />}
      backTo={backTo}
      titleMeta={o ? <StatusBadge order={{ status: o.status, shippingStatus: o.shippingStatus ?? undefined }} /> : undefined}
    >
      <PageLayout
        main={
          <div className="flex flex-col gap-3">
            <Card title="Payment evidence" padding="none">
              {o?.paymentClaim && <ClaimRow claim={o.paymentClaim} orderAmount={o.finalAmountPaise} />}
              {!data ? (
                <div className="p-4">
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : data.evidence.length === 0 ? (
                <EmptyState
                  title="No bank message linked"
                  description="No SMS or email confirmed this order. Manual and wallet payments have none; for an unpaid order, check Possible matches."
                />
              ) : (
                <ul className="divide-y divide-[var(--admin-border)]">
                  {data.evidence.map((e) => (
                    <EvidenceItem key={e.bankEmailId} e={e} orderAmount={o!.finalAmountPaise} showRole />
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Possible matches" padding="none">
              {!data ? (
                <div className="p-4">
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : data.possibleMatches.length === 0 ? (
                <EmptyState
                  title="No near misses"
                  description="Unmatched credits for this store within a day of the order, with the same rupee amount, would show here."
                />
              ) : (
                <ul className="divide-y divide-[var(--admin-border)]">
                  {data.possibleMatches.map((e) => (
                    <EvidenceItem key={e.bankEmailId} e={e} orderAmount={o!.finalAmountPaise} showRole={false} />
                  ))}
                </ul>
              )}
            </Card>
          </div>
        }
        aside={
          <div className="flex flex-col gap-3">
            <Card title="Summary">
              {!o || !data ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <KeyValues
                  items={[
                    { label: 'Store', value: data.store?.name ?? '-' },
                    { label: 'Customer', value: o.customer.name ?? '-' },
                    { label: 'Phone', value: o.customer.phone ?? '-', mono: true },
                    { label: 'Amount to pay', value: <AmountCell finalPaise={o.finalAmountPaise} slotPaise={o.slotOffsetPaise} /> },
                    { label: 'Base amount', value: rupees(o.baseAmountPaise) },
                    ...(o.matchOffsetPaise > 0 ? [{ label: 'Payment match', value: `−${rupees(o.matchOffsetPaise)} (a few paise off so the payment can be matched)` }] : []),
                    { label: 'Wallet used', value: rupees(o.walletDebitPaise) },
                    { label: 'Confirmed by', value: <SourceBadge source={o.source} /> },
                    { label: 'Created', value: formatDateTime(o.createdAt) },
                    { label: 'Paid', value: o.paidAt ? formatDateTime(o.paidAt) : '-' },
                    { label: 'Payer', value: o.payerName ?? o.payerVpa ?? '-' },
                    { label: 'Paid to UPI', value: o.payingVpa ?? '-', mono: true },
                    ...(o.extraCreditsPaise > 0 ? [{ label: 'Extra credited to wallet', value: rupees(o.extraCreditsPaise) }] : []),
                  ]}
                />
              )}
            </Card>
            <Card title="Items">
              {!o ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <ul className="flex flex-col gap-1.5 text-sm">
                  {o.items.map((i, idx) => (
                    <li key={idx} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate">
                        {i.qty} × {i.name}
                      </span>
                      <span className="shrink-0 tabular-nums text-[var(--admin-text-muted)]">{rupees(i.unitPricePaise * i.qty)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        }
      />
    </Page>
  );
}
