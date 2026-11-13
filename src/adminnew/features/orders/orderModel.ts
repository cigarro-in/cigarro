// Pure helpers for the admin order screens (list and detail). No React here.
import type { Doc } from '../../../../convex/_generated/dataModel';
import { orderNumberOf } from '../../../../convex/lib/ids';
import { paiseToRupees } from '../../../lib/convex/money';
import { formatOrderNumber } from '../../../lib/orders/format';
import type { OrderStage } from '../../../lib/orders/orderStage';

export type OrderDoc = Doc<'orders'>;

// Item names for variant products are stored as "Product · Variant".
const NAME_SEPARATOR = ' · ';

/** Five-digit number only. Legacy rows without one show a dash, never the ORD id. */
export function orderNumberLabel(order: OrderDoc): string {
  return formatOrderNumber(orderNumberOf(order)) || '—';
}

/** What the customer pays overall (UPI + wallet): cart + delivery - discount, in paise. */
export function orderTotalPaise(order: OrderDoc): number {
  return order.cartTotalPaise + (order.shippingPricePaise ?? 0) - (order.discountPaise ?? 0);
}

export function orderTotalRupees(order: OrderDoc): number {
  return paiseToRupees(orderTotalPaise(order));
}

export function splitItemName(name: string): { product: string; variant?: string } {
  const at = name.indexOf(NAME_SEPARATOR);
  if (at < 0) return { product: name };
  return { product: name.slice(0, at), variant: name.slice(at + NAME_SEPARATOR.length) || undefined };
}

export function customerName(order: OrderDoc): string {
  return order.address?.name?.trim() || 'Unknown customer';
}

/** "Classic Mild +2 more" for list rows. */
export function itemsSummary(order: OrderDoc): string {
  const items = order.items ?? [];
  if (items.length === 0) return 'No items';
  const first = splitItemName(items[0].name).product;
  const more = items.length - 1;
  return more > 0 ? `${first} +${more} more` : first;
}

/** Lower-cased text the list search matches against. */
export function orderSearchText(order: OrderDoc): string {
  return [
    orderNumberLabel(order),
    customerName(order),
    order.address?.phone ?? '',
    ...(order.items ?? []).map((item) => item.name),
  ]
    .join(' ')
    .toLowerCase();
}

/** Digits for wa.me / tel: links. Ten-digit Indian mobiles get the 91 prefix. */
export function phoneDigits(phone?: string | null): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return null;
  return digits.length === 10 ? `91${digits}` : digits;
}

export function whatsappUrl(phone: string | null | undefined, text?: string): string | null {
  const digits = phoneDigits(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function mapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

export function isHttpUrl(value?: string | null): value is string {
  return !!value && /^https?:\/\//i.test(value);
}

// ---- Stage filter for the list chips ----

export type StageFilter = 'all' | 'unpaid' | 'paid' | 'preparing' | 'shipped' | 'delivered' | 'closed';

export const STAGE_FILTERS: { id: StageFilter; label: string; stages: OrderStage[] }[] = [
  { id: 'all', label: 'All', stages: [] },
  { id: 'unpaid', label: 'Unpaid', stages: ['unpaid'] },
  { id: 'paid', label: 'To prepare', stages: ['paid'] },
  { id: 'preparing', label: 'Preparing', stages: ['preparing'] },
  { id: 'shipped', label: 'Shipped', stages: ['shipped'] },
  { id: 'delivered', label: 'Delivered', stages: ['delivered'] },
  { id: 'closed', label: 'Cancelled/Refunded', stages: ['cancelled', 'refunded', 'returned'] },
];

export function matchesStageFilter(filter: StageFilter, stage: OrderStage): boolean {
  if (filter === 'all') return true;
  return STAGE_FILTERS.find((f) => f.id === filter)?.stages.includes(stage) ?? false;
}

/** Maps the ?status= links used by the dashboard (and older links) onto a chip. */
export function stageFilterFromParam(param: string | null): StageFilter {
  switch (param) {
    case 'pending':
      return 'unpaid';
    case 'paid':
    case 'late_paid':
    case 'processing':
      return 'paid';
    case 'shipped':
      return 'shipped';
    case 'delivered':
      return 'delivered';
    case 'cancelled':
    case 'expired':
    case 'refunded':
    case 'voided':
    case 'returned':
      return 'closed';
    default:
      return 'all';
  }
}
