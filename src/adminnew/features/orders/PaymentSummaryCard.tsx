import { formatINR } from '../../../utils/currency';
import { paiseToRupees } from '../../../lib/convex/money';
import { Card } from '../../ui';
import { orderTotalPaise, type OrderDoc } from './orderModel';

const VERIFIED_VIA: Record<string, string> = {
  email: 'Bank alert email',
  admin_manual: 'Marked paid by admin',
  wallet_only: 'Paid from wallet',
};

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className={muted ? 'text-muted-foreground/70' : 'text-muted-foreground'}>{label}</span>
      <span
        className={
          strong
            ? 'text-base font-semibold tabular-nums text-foreground'
            : 'tabular-nums text-foreground'
        }
      >
        {value}
      </span>
    </div>
  );
}

export function PaymentSummaryCard({ order }: { order: OrderDoc }) {
  const money = (paise: number) => formatINR(paiseToRupees(paise));
  const discount = order.discountPaise ?? 0;
  const delivery = order.shippingPricePaise ?? 0;
  const wallet = order.walletDebitPaise ?? 0;
  const paidStatus = order.status === 'paid' || order.status === 'late_paid' || order.status === 'refunded';
  const verifiedVia = order.verificationMethod ? VERIFIED_VIA[order.verificationMethod] ?? order.verificationMethod : null;
  const payer = [order.payerName, order.payerVpa].filter(Boolean).join(' · ');

  return (
    <Card title="Payment">
      <div className="flex flex-col gap-2">
        <Row label="Subtotal" value={money(order.cartTotalPaise)} />
        {discount > 0 && (
          <Row label={order.discountLabel ? `Discount (${order.discountLabel})` : 'Discount'} value={`-${money(discount)}`} />
        )}
        {order.shippingMethod && (
          <Row label={`Delivery · ${order.shippingMethod}`} value={delivery > 0 ? money(delivery) : 'Free'} />
        )}
        <div className="my-1 border-t border-border" />
        <Row label="Total" value={money(orderTotalPaise(order))} strong />
        {wallet > 0 && <Row label="Paid from wallet" value={money(wallet)} />}
        {paidStatus && <Row label="Paid via UPI" value={money(order.finalAmountPaise)} />}
        {!paidStatus && order.status === 'pending' && (
          <Row label="Amount to pay via UPI" value={money(order.finalAmountPaise)} muted />
        )}
      </div>

      {(verifiedVia || payer || order.bankEmailId) && (
        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 text-sm">
          {verifiedVia && (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Confirmed by</span>
              <span className="text-right text-foreground">{verifiedVia}</span>
            </div>
          )}
          {order.bankEmailId && (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Matched bank email</span>
              <span className="text-right text-foreground">Yes</span>
            </div>
          )}
          {payer && (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Payer</span>
              <span className="break-all text-right text-foreground">{payer}</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
