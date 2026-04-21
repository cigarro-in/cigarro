import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
import { useAuth } from '../useAuth';
import { paiseToRupees } from '../../lib/convex/money';

export type OrderUiStatus =
  | 'pending'
  | 'placed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned';

export interface NormalizedOrderItem {
  productId: string;
  variantId?: string;
  name: string;
  qty: number;
  unitPrice: number;
}

export interface NormalizedOrder {
  id: string;
  displayOrderId: string;
  kind: 'purchase' | 'wallet_load';
  paymentStatus: 'pending' | 'paid' | 'late_paid' | 'expired' | 'cancelled' | 'refunded' | 'voided';
  shippingStatus?: 'awaiting' | 'processing' | 'shipped' | 'delivered' | 'returned';
  uiStatus: OrderUiStatus;
  isPaid: boolean;
  isTerminal: boolean;
  createdAt: Date;
  paidAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  items: NormalizedOrderItem[];
  itemsCount: number;
  subtotal: number;
  walletUsed: number;
  total: number;
  address?: {
    name: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  tracking?: {
    carrier?: string;
    number?: string;
    url?: string;
    notes?: string;
  };
  upiUrl?: string;
  retryOfOrderId?: string;
}

const TERMINAL_STATUSES = new Set(['expired', 'cancelled', 'refunded', 'voided']);

function deriveUiStatus(o: any): OrderUiStatus {
  if (o.status === 'pending') return 'pending';
  if (TERMINAL_STATUSES.has(o.status)) return 'cancelled';
  // paid / late_paid — overlay shipping
  switch (o.shippingStatus) {
    case 'processing': return 'processing';
    case 'shipped': return 'shipped';
    case 'delivered': return 'delivered';
    case 'returned': return 'returned';
    default: return 'placed';
  }
}

function normalize(o: any): NormalizedOrder {
  return {
    id: o._id,
    displayOrderId: o.displayOrderId,
    kind: o.kind,
    paymentStatus: o.status,
    shippingStatus: o.shippingStatus,
    uiStatus: deriveUiStatus(o),
    isPaid: o.status === 'paid' || o.status === 'late_paid',
    isTerminal: TERMINAL_STATUSES.has(o.status),
    createdAt: new Date(o._creationTime),
    paidAt: o.paidAt ? new Date(o.paidAt) : undefined,
    shippedAt: o.shippedAt ? new Date(o.shippedAt) : undefined,
    deliveredAt: o.deliveredAt ? new Date(o.deliveredAt) : undefined,
    items: (o.items || []).map((it: any) => ({
      productId: it.productId,
      variantId: it.variantId,
      name: it.name,
      qty: it.qty,
      unitPrice: paiseToRupees(it.unitPricePaise),
    })),
    itemsCount: (o.items || []).length,
    subtotal: paiseToRupees(o.cartTotalPaise),
    walletUsed: paiseToRupees(o.walletDebitPaise),
    total: paiseToRupees(o.finalAmountPaise),
    address: o.address
      ? {
          name: o.address.name,
          phone: o.address.phone,
          line1: o.address.line1,
          line2: o.address.line2,
          city: o.address.city,
          state: o.address.state,
          pincode: o.address.pincode,
        }
      : undefined,
    tracking:
      o.trackingCarrier || o.trackingNumber || o.trackingUrl || o.shippingNotes
        ? {
            carrier: o.trackingCarrier,
            number: o.trackingNumber,
            url: o.trackingUrl,
            notes: o.shippingNotes,
          }
        : undefined,
    upiUrl: o.upiUrl,
    retryOfOrderId: o.retryOfOrderId,
  };
}

export interface UseMyOrdersOptions {
  limit?: number;
  kind?: 'purchase' | 'wallet_load';
}

export interface UseMyOrdersResult {
  orders: NormalizedOrder[];
  loading: boolean;
  isAuthed: boolean;
}

export function useMyOrders(options: UseMyOrdersOptions = {}): UseMyOrdersResult {
  const { user } = useAuth();
  const org = useOrg();
  const raw = useQuery(
    api.orders.listMyOrders,
    org && user ? { orgId: org._id, limit: options.limit ?? 50 } : 'skip',
  );

  const orders = useMemo(() => {
    if (!raw) return [];
    const normalized = raw.map(normalize);
    return options.kind
      ? normalized.filter((o) => o.kind === options.kind)
      : normalized;
  }, [raw, options.kind]);

  return {
    orders,
    loading: raw === undefined,
    isAuthed: !!user,
  };
}
