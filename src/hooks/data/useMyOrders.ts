import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
import { useAuth } from '../useAuth';
import { paiseToRupees } from '../../lib/convex/money';
import { getProductImageUrl } from '../../lib/images/urls';
import { useFullCatalog } from './useCatalog';

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
  // Always resolved: snapshot → catalog fallback → placeholder. Views must
  // not rebuild this chain (no direct getProductImageUrl on raw items).
  imageUrl: string;
}

export interface NormalizedOrder {
  id: string;
  displayOrderId: string;
  // Five-digit customer-facing number (10000–99999). Absent on legacy rows —
  // views must fall back to displayOrderId.
  orderNumber?: number;
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

// Data-layer image resolution shared by every order surface (customer +
// classic page). Snapshot wins; legacy rows fall back to the live catalog
// (sold variant → default variant → product image); nothing → placeholder.
export function resolveOrderItemImageUrl(
  snapshotImage: unknown,
  productId: string,
  variantId: string | undefined,
  products: Array<{ id: string; image?: string | null; product_variants?: Array<{ id: string; images?: string[]; is_default?: boolean }> }>,
): string {
  if (typeof snapshotImage === 'string' && snapshotImage) {
    return getProductImageUrl(snapshotImage);
  }
  const p = products.find((x) => x.id === productId);
  const vs = p?.product_variants ?? [];
  const v =
    vs.find((x) => x.id === variantId) ??
    vs.find((x) => x.is_default) ??
    vs[0];
  return getProductImageUrl(v?.images?.[0] ?? p?.image ?? undefined);
}

function normalize(o: any, products: Array<{ id: string; image?: string | null; product_variants?: Array<{ id: string; images?: string[]; is_default?: boolean }> }>): NormalizedOrder {
  const rawNumber = o.orderNumber;
  const orderNumber =
    typeof rawNumber === 'number' && Number.isInteger(rawNumber) && rawNumber >= 10000 && rawNumber <= 99999
      ? rawNumber
      : undefined;
  return {
    id: o._id,
    displayOrderId: o.displayOrderId,
    orderNumber,
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
      imageUrl: resolveOrderItemImageUrl(it.image, it.productId, it.variantId, products),
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
  // Shared catalog subscription (deduped with search/header) for the legacy
  // image fallback. Snapshot-first, so live catalog edits can't rewrite
  // history thumbnails.
  const { products } = useFullCatalog();

  const orders = useMemo(() => {
    if (!raw) return [];
    const normalized = raw.map((o) => normalize(o, products));
    return options.kind
      ? normalized.filter((o) => o.kind === options.kind)
      : normalized;
  }, [raw, options.kind, products]);

  return {
    orders,
    loading: raw === undefined,
    isAuthed: !!user,
  };
}
