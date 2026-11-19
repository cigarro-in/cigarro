import { paiseToRupees } from '../../../lib/convex/money';
import { formatINR } from '../../../utils/currency';

/** Rupees with two decimals; a minus sign for negative paise (balances). */
export function moneyPaise(paise: number): string {
  const abs = formatINR(paiseToRupees(Math.abs(paise)));
  return paise < 0 ? `−${abs}` : abs;
}

/** 800 bps -> "8%", 750 bps -> "7.5%". */
export function feeRateLabel(bps: number | null | undefined): string {
  if (bps == null) return '';
  return `${Number((bps / 100).toFixed(2))}%`;
}

/**
 * Plain-language text from a ledger note. Old notes may carry an internal
 * order id (ORD-...); strip it so only the five-digit order number is shown.
 */
export function cleanNote(note: string): string {
  return note.replace(/\s*\(?ORD-[A-Za-z0-9_-]+\)?/g, '').replace(/\s{2,}/g, ' ').trim();
}

/** One order's marketplace fee, as returned by platformFees.getOrderFee(s). */
export interface OrderFeeView {
  feePaise: number;
  feeBps: number | null;
  saleAmountPaise: number | null;
  reversed: boolean;
}

/** What the store keeps from a sale after the fee (UPI amount received minus fee). */
export function keepPaise(fee: OrderFeeView, receivedPaise: number): number {
  return (fee.saleAmountPaise ?? receivedPaise) - fee.feePaise;
}

/** Plain-language reason for a missed checkout (checkoutBlocks.reason). */
export function checkoutBlockReasonLabel(reason: 'no_upi' | 'setup'): string {
  return reason === 'no_upi' ? 'No UPI ID set' : 'Store setup not finished';
}
