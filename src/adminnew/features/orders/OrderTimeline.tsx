import { useState, type ReactNode } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { cn } from '../../../components/ui/utils';
import { Button, Card, ErrorBanner, formatOrderDate, type OrderStage } from '../../ui';
import { useActionRunner } from './useActionRunner';
import { TrackingFields, trackingFrom, trackingPatch, type TrackingValues } from './TrackingFields';
import { isHttpUrl, type OrderDoc } from './orderModel';

interface Step {
  id: string;
  label: string;
  done: boolean;
  at?: number;
  detail?: ReactNode;
}

/**
 * Placed, paid, preparing, shipped (courier + tracking), delivered. Closed orders
 * show only the steps that happened, then the terminal state.
 */
export function OrderTimeline({ order, stage }: { order: OrderDoc; stage: OrderStage }) {
  const updateShipping = useMutation(api.admin.updateShipping);
  const runner = useActionRunner();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TrackingValues>(() => trackingFrom(order));

  const ship = order.shippingStatus;
  const paid = order.status === 'paid' || order.status === 'late_paid' || order.status === 'refunded' || order.paidAt != null;
  const preparing = ship === 'processing' || ship === 'shipped' || ship === 'delivered' || ship === 'returned';
  const shipped = ship === 'shipped' || ship === 'delivered' || ship === 'returned' || order.shippedAt != null;
  const delivered = ship === 'delivered' || order.deliveredAt != null;
  const canEditTracking = stage === 'preparing' || stage === 'shipped' || stage === 'delivered';
  const courierLine = [order.trackingCarrier, order.trackingNumber].filter(Boolean).join(' · ');

  const saveTracking = async () => {
    const ok = await runner.run('save_tracking', async () => {
      await updateShipping({ orderId: order._id, ...trackingPatch(draft) });
      return true;
    });
    if (ok) setEditing(false);
  };

  const shippedDetail = (
    <div className="mt-1.5 flex flex-col gap-2 text-sm">
      {!editing && (
        <>
          {courierLine && <p className="text-foreground">{courierLine}</p>}
          {isHttpUrl(order.trackingUrl) && (
            <a
              href={order.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit text-primary underline underline-offset-2"
            >
              Track parcel
            </a>
          )}
          {!courierLine && !order.trackingUrl && <p className="text-muted-foreground">No tracking added</p>}
          {canEditTracking && (
            <Button
              size="sm"
              variant="plain"
              className="-ml-2 w-fit"
              onClick={() => {
                setDraft(trackingFrom(order));
                setEditing(true);
              }}
            >
              Edit tracking
            </Button>
          )}
        </>
      )}
      {editing && (
        <div className="flex flex-col gap-3">
          <TrackingFields value={draft} onChange={setDraft} disabled={runner.busy} />
          <ErrorBanner error={runner.error} />
          <div className="flex gap-2">
            <Button variant="primary" size="sm" state={runner.stateFor('save_tracking')} disabled={runner.busy} onClick={() => void saveTracking()}>
              Save tracking
            </Button>
            <Button variant="plain" size="sm" disabled={runner.busy} onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const steps: Step[] = [
    { id: 'placed', label: 'Placed', done: true, at: order.createdAt },
    { id: 'paid', label: 'Paid', done: paid, at: order.paidAt },
    { id: 'preparing', label: 'Preparing', done: preparing },
    { id: 'shipped', label: 'Shipped', done: shipped, at: order.shippedAt, detail: shippedDetail },
    { id: 'delivered', label: 'Delivered', done: delivered, at: order.deliveredAt },
  ];
  if (stage === 'cancelled') {
    steps.push({ id: 'end', label: 'Cancelled', done: true, at: order.terminalAt });
  } else if (stage === 'refunded') {
    steps.push({
      id: 'end',
      label: 'Refunded',
      done: true,
      at: order.terminalAt,
      detail:
        order.refundDestination && (
          <p className="mt-1 text-sm text-muted-foreground">
            To {order.refundDestination === 'wallet' ? 'customer wallet' : 'bank (manual)'}
          </p>
        ),
    });
  } else if (stage === 'returned') {
    steps.push({ id: 'end', label: 'Returned', done: true });
  }

  const closed = stage === 'cancelled' || stage === 'refunded' || stage === 'returned';
  const visible = closed ? steps.filter((s) => s.done) : steps;

  return (
    <Card title="Timeline">
      <ol className="ml-2 flex flex-col gap-5 border-l border-border">
        {visible.map((s) => (
          <li key={s.id} className="relative pl-6">
            <span
              aria-hidden
              className={cn(
                'absolute -left-1.25 top-1 size-2.5 rounded-full',
                s.done
                  ? 'bg-primary'
                  : 'border border-input bg-card',
              )}
            />
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className={cn('text-sm font-semibold', !s.done && 'text-muted-foreground/70')}>{s.label}</span>
              {s.done && s.at ? (
                <span className="text-xs tabular-nums text-muted-foreground">{formatOrderDate(s.at, { withTime: true })}</span>
              ) : !s.done ? (
                <span className="text-xs text-muted-foreground/70">Pending</span>
              ) : null}
            </div>
            {s.done && s.detail}
          </li>
        ))}
      </ol>
    </Card>
  );
}
