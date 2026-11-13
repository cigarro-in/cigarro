// One display stage per order, shared by the admin and the customer views.
//
// Orders carry two lifecycles in Convex (convex/schema.ts):
//   payment  status:          pending | paid | late_paid | expired | cancelled | refunded | voided
//   shipping shippingStatus:  awaiting | processing | shipped | delivered | returned   (optional)
// Showing both side by side confused admins and customers. Every view derives
// a single OrderStage from them here instead of mapping statuses itself.

export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'late_paid'
  | 'expired'
  | 'cancelled'
  | 'refunded'
  | 'voided';

export type ShippingStatus = 'awaiting' | 'processing' | 'shipped' | 'delivered' | 'returned';

export type OrderStage =
  | 'unpaid' // placed, awaiting payment
  | 'paid' // paid, new, to prepare
  | 'preparing'
  | 'shipped'
  | 'delivered'
  | 'cancelled' // cancelled, expired or voided
  | 'refunded'
  | 'returned';

export type StageTone = 'neutral' | 'info' | 'success' | 'warning' | 'critical' | 'attention';

/** Accepts the raw Convex order (`status`, `shippingStatus`) or any object with those fields. */
export interface OrderStageInput {
  status?: PaymentStatus | string | null;
  paymentStatus?: PaymentStatus | string | null;
  shippingStatus?: ShippingStatus | string | null;
}

export function deriveOrderStage(order: OrderStageInput): OrderStage {
  const payment = order.paymentStatus ?? order.status ?? 'pending';
  switch (payment) {
    case 'pending':
      return 'unpaid';
    case 'refunded':
      return 'refunded';
    case 'expired':
    case 'cancelled':
    case 'voided':
      return 'cancelled';
    default:
      break; // paid / late_paid: the shipping lifecycle decides
  }
  switch (order.shippingStatus) {
    case 'processing':
      return 'preparing';
    case 'shipped':
      return 'shipped';
    case 'delivered':
      return 'delivered';
    case 'returned':
      return 'returned';
    default:
      return 'paid';
  }
}

export const ORDER_STAGES: readonly OrderStage[] = [
  'unpaid',
  'paid',
  'preparing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
  'returned',
];

/** Admin-facing labels. */
export const STAGE_LABEL: Record<OrderStage, string> = {
  unpaid: 'Awaiting payment',
  paid: 'To prepare',
  preparing: 'Preparing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  returned: 'Returned',
};

/** Customer-facing labels (same stages, shopper wording). */
export const STAGE_CUSTOMER_LABEL: Record<OrderStage, string> = {
  unpaid: 'Awaiting payment',
  paid: 'Order placed',
  preparing: 'Preparing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  returned: 'Returned',
};

/** Badge tone per stage (see StatusBadge in src/adminnew/ui). */
export const STAGE_TONE: Record<OrderStage, StageTone> = {
  unpaid: 'warning',
  paid: 'attention',
  preparing: 'info',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'neutral',
  refunded: 'neutral',
  returned: 'critical',
};

/**
 * Next actions an admin can take per stage. Ids map to Convex mutations:
 *   mark_paid       -> admin.markPaid
 *   cancel          -> admin.voidOrder
 *   start_preparing -> admin.updateShipping { shippingStatus: 'processing' }
 *   mark_shipped    -> admin.updateShipping { shippingStatus: 'shipped' }
 *   mark_delivered  -> admin.updateShipping { shippingStatus: 'delivered' }
 *   mark_returned   -> admin.updateShipping { shippingStatus: 'returned' }
 *   refund          -> admin.refundOrder
 */
export type OrderAction =
  | 'mark_paid'
  | 'cancel'
  | 'start_preparing'
  | 'mark_shipped'
  | 'mark_delivered'
  | 'mark_returned'
  | 'refund';

export const ORDER_ACTION_LABEL: Record<OrderAction, string> = {
  mark_paid: 'Mark as paid',
  cancel: 'Cancel order',
  start_preparing: 'Start preparing',
  mark_shipped: 'Mark as shipped',
  mark_delivered: 'Mark as delivered',
  mark_returned: 'Mark as returned',
  refund: 'Refund',
};

/** First entry is the primary action for the stage. */
export const STAGE_ACTIONS: Record<OrderStage, readonly OrderAction[]> = {
  unpaid: ['mark_paid', 'cancel'],
  paid: ['start_preparing', 'mark_shipped', 'refund'],
  preparing: ['mark_shipped', 'refund'],
  shipped: ['mark_delivered', 'mark_returned'],
  delivered: ['mark_returned', 'refund'],
  cancelled: [],
  refunded: [],
  returned: ['refund'],
};

export function nextOrderActions(order: OrderStageInput): readonly OrderAction[] {
  return STAGE_ACTIONS[deriveOrderStage(order)];
}

/** True once the order needs no more work (cancelled, refunded, delivered). */
export function isClosedStage(stage: OrderStage): boolean {
  return stage === 'cancelled' || stage === 'refunded' || stage === 'delivered';
}
