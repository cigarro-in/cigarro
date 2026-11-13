import { useState, type ReactNode } from 'react';
import { ArrowRight, ShoppingCart, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
import { formatINR } from '../../utils/currency';
import { AttentionRow, type AttentionItem } from '../features/overview/AttentionRow';
import { SalesComparison } from '../features/overview/SalesComparison';
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  Page,
  PageLayout,
  Skeleton,
  StatusBadge,
  Tabs,
  formatOrderDate,
  formatOrderNumber,
  type Column,
} from '../ui';

interface RecentOrder {
  id: string;
  number: string;
  customer: string;
  total: number;
  paymentStatus: string;
  shippingStatus: string | null;
  createdAt: number;
}

interface RecentCustomer {
  id: string;
  name: string;
  contact: string;
  createdAt: number;
}

function StoreRow({ label, value, to }: { label: string; value: ReactNode; to?: string }) {
  const cls = 'flex h-9 items-center justify-between gap-3 rounded-md px-2 text-sm';
  const content = (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </>
  );
  return to ? (
    <Link to={to} className={`${cls} hover:bg-muted`}>
      {content}
    </Link>
  ) : (
    <div className={cls}>{content}</div>
  );
}

const ORDER_COLUMNS: Column<RecentOrder>[] = [
  { id: 'number', header: 'Order', cell: (o) => <span className="font-medium tabular-nums">{o.number}</span> },
  { id: 'date', header: 'Date', hideBelow: 'sm', cell: (o) => <span className="text-muted-foreground">{formatOrderDate(o.createdAt)}</span> },
  { id: 'customer', header: 'Customer', hideBelow: 'md', cell: (o) => o.customer || 'Guest' },
  { id: 'status', header: 'Status', cell: (o) => <StatusBadge order={{ status: o.paymentStatus, shippingStatus: o.shippingStatus }} /> },
  { id: 'total', header: 'Total', align: 'right', cell: (o) => <span className="tabular-nums">{formatINR(o.total)}</span> },
];

const CUSTOMER_COLUMNS: Column<RecentCustomer>[] = [
  { id: 'name', header: 'Customer', cell: (c) => <span className="font-medium">{c.name || 'Unknown'}</span> },
  { id: 'contact', header: 'Phone', cell: (c) => <span className="tabular-nums">{c.contact || '-'}</span> },
  { id: 'joined', header: 'Joined', align: 'right', cell: (c) => <span className="text-muted-foreground">{formatOrderDate(c.createdAt)}</span> },
];

function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function OverviewSkeleton() {
  return (
    <>
      <Card padding="none">
        <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-2 p-4">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-6 w-24" />
            </div>
          ))}
        </div>
      </Card>
      <Card title="Needs attention">
        <Skeleton className="h-14 w-full" />
      </Card>
      <PageLayout
        main={
          <Card padding="none" title="Recent">
            <div className="flex flex-col gap-3 p-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          </Card>
        }
        aside={
          <Card title="Store">
            <div className="flex flex-col gap-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          </Card>
        }
      />
    </>
  );
}

/** Overview. Reference implementation of the admin UI primitives (see ../ui/README.md). */
export function DashboardPage() {
  const navigate = useNavigate();
  const org = useOrg();
  const data = useQuery(api.adminStats.getDashboardStats, org ? { orgId: org._id } : 'skip');
  const [view, setView] = useState<'orders' | 'customers'>('orders');

  const recentOrders: RecentOrder[] = (data?.recentOrders ?? []).map((order) => ({
    id: String(order.id),
    // Never fall back to the ORD-xxxx display id.
    number: formatOrderNumber(order.order_number) || 'Order',
    customer: order.shipping_name,
    total: order.total,
    paymentStatus: order.payment_status,
    shippingStatus: order.shipping_status,
    createdAt: Number(order.created_at),
  }));

  const recentCustomers: RecentCustomer[] = (data?.recentCustomers ?? []).map((customer) => ({
    id: String(customer.id),
    name: customer.name,
    contact: customer.phone || '',
    createdAt: Number(customer.created_at),
  }));

  const storeName = org?.name;
  const title = `${greetingFor(new Date())}${storeName ? `, ${storeName}` : ''}`;

  const attention: AttentionItem[] = data
    ? [
        { key: 'unpaid', label: 'Awaiting payment', count: data.pendingOrders, to: '/orders?status=pending' },
        { key: 'prepare', label: 'To prepare', count: data.processingOrders, to: '/orders?status=processing' },
        {
          key: 'unmatched',
          label: 'Unmatched payments',
          count: data.unmatchedPayments,
          capped: data.unmatchedCapped,
          to: '/payments/unmatched',
        },
        { key: 'stock', label: 'Low stock', count: data.lowStockCount, to: '/inventory?lowStock=1' },
      ]
    : [];

  if (data === null) {
    return (
      <Page title="Overview">
        <Card padding="none">
          <EmptyState icon={<ShoppingCart />} title="Store not found" />
        </Card>
      </Page>
    );
  }

  return (
    <Page title={title} primaryAction={{ label: 'Add product', to: '/products/new' }}>
      {data === undefined ? (
        <OverviewSkeleton />
      ) : (
        <>
          <SalesComparison
            todayRevenue={data.todayRevenue}
            yesterdayRevenue={data.yesterdayRevenue}
            todayOrders={data.todayOrders}
            yesterdayOrders={data.yesterdayOrders}
          />

          <AttentionRow items={attention} />

          <PageLayout
            main={
              <Card padding="none">
                <Tabs
                  value={view}
                  onChange={setView}
                  tabs={[
                    { id: 'orders', label: 'Recent orders' },
                    { id: 'customers', label: 'New customers' },
                  ]}
                />
                {view === 'orders' ? (
                  <DataTable
                    columns={ORDER_COLUMNS}
                    rows={recentOrders}
                    getRowId={(o) => o.id}
                    onRowClick={(o) => navigate(`/orders/${o.id}`)}
                    rowLabel={(o) => `Open order ${o.number}`}
                    empty={<EmptyState icon={<ShoppingCart />} title="No orders yet" />}
                  />
                ) : (
                  <DataTable
                    columns={CUSTOMER_COLUMNS}
                    rows={recentCustomers}
                    getRowId={(c) => c.id}
                    onRowClick={(c) => navigate(`/customers/${c.id}`)}
                    rowLabel={(c) => `Open customer ${c.name}`}
                    empty={<EmptyState icon={<Users />} title="No customers yet" />}
                  />
                )}
                <div className="flex justify-end border-t border-border px-2 py-1.5">
                  <Button variant="plain" size="sm" onClick={() => navigate(view === 'orders' ? '/orders' : '/customers')}>
                    View all
                    <ArrowRight aria-hidden />
                  </Button>
                </div>
              </Card>
            }
            aside={
              <Card title="Store" actions={<span className="text-xs text-muted-foreground">{data.ordersCapped ? 'Latest 1,000 orders' : 'All time'}</span>}>
                <div className="-mx-2 flex flex-col">
                  <StoreRow label="Total sales" value={formatINR(data.totalRevenue)} />
                  <StoreRow label="Total orders" value={data.totalOrders} />
                  <StoreRow label="Shipped" value={data.shippedOrders} to="/orders?status=shipped" />
                  <StoreRow label="Active products" value={`${data.activeProducts} / ${data.totalProducts}`} to="/products" />
                  <StoreRow label="Customers" value={data.totalCustomers} to="/customers" />
                </div>
              </Card>
            }
          />
        </>
      )}
    </Page>
  );
}
