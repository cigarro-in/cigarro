import { deriveOrderStage, STAGE_LABEL } from '../../../lib/orders/orderStage';

/** Shape returned by api.adminStats.searchAdmin. */
export interface AdminSearchData {
  orders: Array<{
    id: string;
    number: number | null;
    customer: string;
    paymentStatus: string;
    shippingStatus: string | null;
    total: number;
    createdAt: number;
  }>;
  products: Array<{ id: string; name: string; isActive: boolean }>;
  customers: Array<{ id: string; name: string; phone: string }>;
}

export type SearchGroupTitle = 'Orders' | 'Products' | 'Customers';

export interface SearchItem {
  key: string;
  group: SearchGroupTitle;
  label: string;
  sublabel?: string;
  /** Router-relative path. */
  to: string;
}

export interface SearchGroup {
  title: SearchGroupTitle;
  items: SearchItem[];
}

/** Groups in display order. Empty groups are dropped. Flatten with `flatItems` for keyboard navigation. */
export function groupResults(data: AdminSearchData | undefined): SearchGroup[] {
  if (!data) return [];
  const orders: SearchItem[] = data.orders.map((o) => {
    const stage = deriveOrderStage({ paymentStatus: o.paymentStatus, shippingStatus: o.shippingStatus });
    return {
      key: `order-${o.id}`,
      group: 'Orders',
      label: o.number != null ? `Order ${o.number}` : 'Order',
      sublabel: [o.customer, STAGE_LABEL[stage]].filter(Boolean).join(' · '),
      to: `/orders/${o.id}`,
    };
  });
  const products: SearchItem[] = data.products.map((p) => ({
    key: `product-${p.id}`,
    group: 'Products',
    label: p.name,
    sublabel: p.isActive ? undefined : 'Inactive',
    to: `/products/${p.id}`,
  }));
  const customers: SearchItem[] = data.customers.map((c) => ({
    key: `customer-${c.id}`,
    group: 'Customers',
    label: c.name || 'Unnamed customer',
    sublabel: c.phone || undefined,
    to: `/customers/${encodeURIComponent(c.id)}`,
  }));
  const groups: SearchGroup[] = [
    { title: 'Orders', items: orders },
    { title: 'Products', items: products },
    { title: 'Customers', items: customers },
  ];
  return groups.filter((g) => g.items.length > 0);
}

export function flatItems(groups: SearchGroup[]): SearchItem[] {
  return groups.flatMap((g) => g.items);
}
