import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import {
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  ErrorBanner,
  ORDER_ACTION_LABEL,
  nextOrderActions,
  STAGE_LABEL,
  type OrderAction,
  type OrderStage,
} from '../../ui';
import { useActionRunner } from './useActionRunner';
import { TrackingFields, trackingFrom, trackingPatch, type TrackingValues } from './TrackingFields';
import type { OrderDoc } from './orderModel';

const DESTRUCTIVE: OrderAction[] = ['cancel', 'mark_returned'];

/**
 * The one thing to do next for this order, as buttons. The list of actions
 * comes from nextOrderActions(order) so it always matches the stage badge.
 * Destructive steps confirm first.
 */
export function NextActionCard({ order, stage }: { order: OrderDoc; stage: OrderStage }) {
  const orderId = order._id;
  const markPaid = useMutation(api.admin.markPaid);
  const voidOrder = useMutation(api.admin.voidOrder);
  const updateShipping = useMutation(api.admin.updateShipping);
  const refund = useMutation(api.admin.refundOrder);
  const runner = useActionRunner();

  const [tracking, setTracking] = useState<TrackingValues>(() => trackingFrom(order));
  const [confirm, setConfirm] = useState<'cancel' | 'mark_returned' | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [restock, setRestock] = useState(false);

  const actions = nextOrderActions(order);
  const [primary, ...rest] = actions;

  const perform = (action: OrderAction) => {
    switch (action) {
      case 'mark_paid':
        return runner.run(action, async () => {
          await markPaid({ orderId, reference: `admin:${new Date().toISOString()}` });
          return true;
        });
      case 'start_preparing':
        return runner.run(action, async () => {
          await updateShipping({ orderId, shippingStatus: 'processing' });
          return true;
        });
      case 'mark_shipped':
        return runner.run(action, async () => {
          await updateShipping({ orderId, shippingStatus: 'shipped', ...trackingPatch(tracking) });
          return true;
        });
      case 'mark_delivered':
        return runner.run(action, async () => {
          await updateShipping({ orderId, shippingStatus: 'delivered' });
          return true;
        });
      default:
        return undefined;
    }
  };

  const refundWith = async (toWallet: boolean) => {
    const id = toWallet ? 'refund_wallet' : 'refund_bank';
    const ok = await runner.run(id, async () => {
      await refund({ orderId, toWallet, restock: order.kind === 'purchase' ? restock : undefined });
      return true;
    });
    if (ok) setRefundOpen(false);
  };

  const button = (action: OrderAction, isPrimary: boolean) => {
    const label = ORDER_ACTION_LABEL[action];
    const destructive = DESTRUCTIVE.includes(action);
    const common = {
      variant: isPrimary ? ('primary' as const) : ('secondary' as const),
      disabled: runner.busy,
      className: destructive ? 'text-destructive' : undefined,
      fullWidth: isPrimary,
    };
    if (action === 'cancel')
      return <Button key={action} {...common} onClick={() => setConfirm('cancel')}>{label}</Button>;
    if (action === 'mark_returned')
      return <Button key={action} {...common} onClick={() => setConfirm('mark_returned')}>{label}</Button>;
    if (action === 'refund')
      return <Button key={action} {...common} onClick={() => setRefundOpen(true)}>{label}</Button>;
    return (
      <Button key={action} {...common} state={runner.stateFor(action)} onClick={() => void perform(action)}>
        {label}
      </Button>
    );
  };

  return (
    <>
      <Card title="Next step">
        {actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No further steps. This order is {STAGE_LABEL[stage].toLowerCase()}.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {!refundOpen && <ErrorBanner error={runner.error} />}
            {actions.includes('mark_shipped') && (
              <TrackingFields value={tracking} onChange={setTracking} disabled={runner.busy} />
            )}
            {primary && button(primary, true)}
            {rest.length > 0 && <div className="flex flex-wrap gap-2">{rest.map((a) => button(a, false))}</div>}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirm === 'cancel'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Cancel this order?"
        description="The order is voided, reserved stock is released and any wallet amount goes back to the customer."
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        critical
        onConfirm={() => voidOrder({ orderId, reason: 'admin void from order page' })}
      />

      <ConfirmDialog
        open={confirm === 'mark_returned'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Mark as returned?"
        description="Use this when the parcel came back to the store. Refund separately if the customer should get money back."
        confirmLabel="Mark as returned"
        cancelLabel="Not yet"
        critical
        onConfirm={() => updateShipping({ orderId, shippingStatus: 'returned' })}
      />

      <Dialog
        open={refundOpen}
        onOpenChange={(open) => {
          setRefundOpen(open);
          if (!open) runner.reset();
        }}
        title="Refund this order"
        description="The wallet part of the order always goes back to the customer wallet."
        size="sm"
        footer={
          <>
            <Button variant="plain" onClick={() => setRefundOpen(false)} disabled={runner.busy}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              state={runner.stateFor('refund_bank')}
              disabled={runner.busy}
              onClick={() => void refundWith(false)}
            >
              Bank refund (manual)
            </Button>
            <Button
              variant="primary"
              state={runner.stateFor('refund_wallet')}
              disabled={runner.busy}
              onClick={() => void refundWith(true)}
            >
              Refund to wallet
            </Button>
          </>
        }
      >
        {order.kind === 'purchase' && (
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={restock}
              onChange={(e) => setRestock(e.target.checked)}
              className="size-4 accent-primary"
            />
            Items came back and go back into stock
          </label>
        )}
        <ErrorBanner error={runner.error} />
      </Dialog>
    </>
  );
}
