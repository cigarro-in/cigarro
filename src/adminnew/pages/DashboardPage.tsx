import { useState, type ReactNode } from 'react';
import { ArrowRight, ShoppingCart, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
import { formatINR } from '../../utils/currency';
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

function Metric({ label, value, to }: { label: string; value: ReactNode; to?: string }) {
  const body = (
    <>
      <span className="text-[13px] text-[var(--admin-text-muted)]">{label}</span>
      <span className="text-xl font-semibold tabular-nums text-[var(--admin-text)]">{value}</span>
    </>
  );
  const cls = 'flex flex-col gap-1 p-4';
  return to ? (
    <Link to={to} className={`${cls} transition-colors hover:bg-[var(--admin-surface-hover)]`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function StoreRow({ label, value, to }: { label: string; value: ReactNode; to?: string }) {
  const cls = 'flex h-9 items-center justify-between gap-3 rounded-[var(--admin-radius-sm)] px-2 text-sm';
  const content = (
    <>
      <span className="text-[var(--admin-text-muted)]">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </>
  );
  return to ? (
    <Link to={to} className={`${cls} hover:bg-[var(--admin-surface-hover)]`}>
      {content}
    </Link>
  ) : (
    <div className={cls}>{content}</div>
  );
}

const ORDER_COLUMNS: Column<RecentOrder>[] = [
  { id: 'number', header: 'Order', cell: (o) => <span className="font-medium tabular-nums">{o.number}</span> },
  { id: 'date', header: 'Date', hideBelow: 'sm', cell: (o) => <span className="text-[var(--admin-text-muted)]">{formatOrderDate(o.createdAt)}</span> },
  { id: 'customer', header: 'Customer', hideBelow: 'md', cell: (o) => o.customer || 'Guest' },
  { id: 'status', header: 'Status', cell: (o) => <StatusBadge order={{ status: o.paymentStatus, shippingStatus: o.shippingStatus }} /> },
  { id: 'total', header: 'Total', align: 'right', cell: (o) => <span className="tabular-nums">{formatINR(o.total)}</span> },
];

const CUSTOMER_COLUMNS: Column<RecentCustomer>[] = [
  { id: 'name', header: 'Customer', cell: (c) => <span className="font-medium">{c.name || 'Unknown'}</span> },
  { id: 'contact', header: 'Phone', cell: (c) => <span className="tabular-nums">{c.contact || '-'}</span> },
  { id: 'joined', header: 'Joined', align: 'right', cell: (c) => <span className="text-[var(--admin-text-muted)]">{formatOrderDate(c.createdAt)}</span> },
];

function OverviewSkeleton() {
  return (
    <>
      <Card padding="none">
        <div className="grid grid-cols-2 divide-x divide-y divide-[var(--admin-border)] sm:grid-cols-4 sm:divide-y-0">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-2 p-4">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-6 w-24" />
            </div>
          ))}
        </div>
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
    number: formatOrderNumber(order.order_number, order.display_order_id),
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

  return (
    <Page title="Overview" primaryAction={{ label: 'Add product', to: '/products/new' }}>
      {data === undefined ? (
        <OverviewSkeleton />
      ) : (
        <>
          <Card padding="none">
            <div className="grid grid-cols-2 divide-x divide-y divide-[var(--admin-border)] sm:grid-cols-4 sm:divide-y-0">
              <Metric label="Sales today" value={formatINR(data?.todayRevenue ?? 0)} />
              <Metric label="Orders today" value={data?.todayOrders ?? 0} />
              <Metric label="To prepare" value={data?.processingOrders ?? 0} to="/orders?status=processing" />
              <Metric label="Low stock" value={data?.lowStockCount ?? 0} to="/inventory?lowStock=1" />
            </div>
          </Card>

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
                <div className="flex justify-end border-t border-[var(--admin-border)] px-2 py-1.5">
                  <Button variant="plain" size="sm" onClick={() => navigate(view === 'orders' ? '/orders' : '/customers')}>
                    View all
                    <ArrowRight aria-hidden />
                  </Button>
                </div>
              </Card>
            }
            aside={
              <Card title="Store" actions={<span className="text-xs text-[var(--admin-text-muted)]">{data?.ordersCapped ? 'Latest 1,000 orders' : 'All time'}</span>}>
                <div className="-mx-2 flex flex-col">
                  <StoreRow label="Total sales" value={formatINR(data?.totalRevenue ?? 0)} />
                  <StoreRow label="Total orders" value={data?.totalOrders ?? 0} />
                  <StoreRow label="Awaiting payment" value={data?.pendingOrders ?? 0} to="/orders?status=pending" />
                  <StoreRow label="Shipped" value={data?.shippedOrders ?? 0} to="/orders?status=shipped" />
                  <StoreRow label="Active products" value={`${data?.activeProducts ?? 0} / ${data?.totalProducts ?? 0}`} to="/products" />
                  <StoreRow label="Customers" value={data?.totalCustomers ?? 0} to="/customers" />
                </div>
              </Card>
            }
          />
        </>
      )}
    </Page>
  );
}
