import { formatINR } from '../../utils/currency';

export const PAYMENT_MATCH_HELP = 'A few paise off so we can match your payment';

/**
 * "Payment match −₹X" row for an order's payment-match offset (lucky discount
 * OFF, exact total collided with another order). Pure view: pass rupees, get
 * nothing back when there is no offset. Never use for coupon or lucky discounts.
 */
export function PaymentMatchRow({
  amount,
  className = '',
  helpClassName = 'mt-0.5 text-[11px] opacity-70',
}: {
  amount: number | undefined | null;
  className?: string;
  helpClassName?: string;
}) {
  if (!amount || !(amount > 0)) return null;
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3">
        <span>Payment match</span>
        <span>−{formatINR(amount)}</span>
      </div>
      <p className={helpClassName}>{PAYMENT_MATCH_HELP}</p>
    </div>
  );
}
