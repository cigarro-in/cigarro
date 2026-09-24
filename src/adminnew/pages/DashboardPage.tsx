import type { KeyboardEvent, ReactNode } from 'react';
import { ArrowRight, ShoppingCart, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
import { formatINR } from '../../utils/currency';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Empty, EmptyHeader, EmptyTitle } from '../../components/ui/empty';
import { Skeleton } from '../../components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { PageHeader } from '../components/shared/PageHeader';

interface RecentOrder {
  id: string;
  displayOrderId: string;
  customer: string;
  total: number;
  status: string;
  createdAt: number;
}

interface RecentCustomer {
  id: string;
  name: string;
  contact: string;
  createdAt: number;
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (['paid', 'late_paid', 'delivered'].includes(status)) return 'default';
  if (['pending', 'awaiting', 'processing', 'shipped'].includes(status)) return 'secondary';
  if (['cancelled', 'refunded', 'voided'].includes(status)) return 'destructive';
  return 'outline';
}

function statusLabel(status: string) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function initial(value: string) {
  return value.trim().charAt(0).toUpperCase() || 'U';
}

function activateRow(event: KeyboardEvent<HTMLTableRowElement>, action: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
}

function SummaryMetric({
  label,
  value,
  onClick,
}: {
  label: string;
  value: ReactNode;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="text-xs font-normal text-muted-foreground">{label}</span>
      <span className="text-xl font-semibold tabular-nums sm:text-2xl">{value}</span>
    </>
  );

  if (!onClick) {
    return <div className="flex flex-col items-start gap-1 p-4 sm:p-5">{content}</div>;
  }

  return (
    <Button
      variant="ghost"
      className="h-auto w-full flex-col items-start gap-1 rounded-none p-4 text-left sm:p-5"
      onClick={onClick}
    >
      {content}
    </Button>
  );
}

function StoreMetric({ label, value, onClick }: { label: string; value: ReactNode; onClick?: () => void }) {
  if (!onClick) {
    return (
      <div className="flex h-9 items-center justify-between px-4 text-sm">
        <span>{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
    );
  }

  return (
    <Button variant="ghost" className="justify-between" onClick={onClick}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </Button>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-label="Loading dashboard">
      <Card className="gap-0 py-0">
        <CardContent className="grid grid-cols-2 p-0 sm:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="flex flex-col gap-2 p-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-10 w-full" />)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-20" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-8 w-full" />)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const org = useOrg();
  const data = useQuery(
    api.adminStats.getDashboardStats,
    org ? { orgId: org._id } : 'skip',
  );

  const recentOrders: RecentOrder[] = (data?.recentOrders ?? []).map((order) => ({
    id: String(order.id),
    displayOrderId: order.display_order_id,
    customer: order.shipping_name,
    total: order.total,
    status: order.status,
    createdAt: Number(order.created_at),
  }));

  const recentCustomers: RecentCustomer[] = (data?.recentCustomers ?? []).map((customer) => ({
    id: String(customer.id),
    name: customer.name,
    contact: customer.phone || '',
    createdAt: Number(customer.created_at),
  }));

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Overview" />

      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 pb-6 sm:px-6">
        {data === undefined ? (
          <DashboardSkeleton />
        ) : (
          <>
            <Card className="gap-0 py-0">
              <CardContent className="grid grid-cols-2 divide-x divide-y p-0 sm:grid-cols-4 sm:divide-y-0">
                <SummaryMetric
                  label="Sales today"
                  value={formatINR(data?.todayRevenue ?? 0)}
                />
                <SummaryMetric
                  label="Orders today"
                  value={data?.todayOrders ?? 0}
                />
                <SummaryMetric
                  label="To fulfil"
                  value={data?.processingOrders ?? 0}
                  onClick={() => navigate('/admin/orders?status=processing')}
                />
                <SummaryMetric
                  label="Low stock"
                  value={data?.lowStockCount ?? 0}
                  onClick={() => navigate('/admin/inventory?lowStock=1')}
                />
              </CardContent>
            </Card>

            <div className="grid items-start gap-4 lg:grid-cols-3">
              <Tabs defaultValue="orders" className="gap-0 lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent</CardTitle>
                    <CardAction>
                      <TabsList>
                        <TabsTrigger value="orders">Orders</TabsTrigger>
                        <TabsTrigger value="customers">Customers</TabsTrigger>
                      </TabsList>
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    <TabsContent value="orders" className="flex flex-col gap-3">
                      {recentOrders.length === 0 ? (
                        <Empty className="min-h-48 border">
                          <EmptyHeader>
                            <ShoppingCart aria-hidden />
                            <EmptyTitle>No orders yet</EmptyTitle>
                          </EmptyHeader>
                        </Empty>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Order</TableHead>
                              <TableHead>Customer</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {recentOrders.map((order) => {
                              const openOrder = () => navigate(`/admin/orders/${order.id}`);
                              return (
                                <TableRow
                                  key={order.id}
                                  role="link"
                                  tabIndex={0}
                                  className="cursor-pointer"
                                  aria-label={`Open order ${order.displayOrderId}`}
                                  onClick={openOrder}
                                  onKeyDown={(event) => activateRow(event, openOrder)}
                                >
                                  <TableCell className="font-medium">#{order.displayOrderId}</TableCell>
                                  <TableCell>{order.customer || 'Guest'}</TableCell>
                                  <TableCell>
                                    <Badge variant={statusBadgeVariant(order.status)}>
                                      {statusLabel(order.status)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right font-medium">{formatINR(order.total)}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      )}
                      <Button variant="ghost" size="sm" className="self-end" onClick={() => navigate('/admin/orders')}>
                        View all
                        <ArrowRight data-icon="inline-end" aria-hidden />
                      </Button>
                    </TabsContent>

                    <TabsContent value="customers" className="flex flex-col gap-3">
                      {recentCustomers.length === 0 ? (
                        <Empty className="min-h-48 border">
                          <EmptyHeader>
                            <Users aria-hidden />
                            <EmptyTitle>No customers yet</EmptyTitle>
                          </EmptyHeader>
                        </Empty>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Customer</TableHead>
                              <TableHead>Contact</TableHead>
                              <TableHead className="text-right">Joined</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {recentCustomers.map((customer) => {
                              const openCustomer = () => navigate(`/admin/customers/${customer.id}`);
                              return (
                                <TableRow
                                  key={customer.id}
                                  role="link"
                                  tabIndex={0}
                                  className="cursor-pointer"
                                  aria-label={`Open customer ${customer.name}`}
                                  onClick={openCustomer}
                                  onKeyDown={(event) => activateRow(event, openCustomer)}
                                >
                                  <TableCell>
                                    <span className="flex items-center gap-2 font-medium">
                                      <Avatar className="size-7">
                                        <AvatarFallback>{initial(customer.name || customer.contact)}</AvatarFallback>
                                      </Avatar>
                                      {customer.name || 'Unknown'}
                                    </span>
                                  </TableCell>
                                  <TableCell>{customer.contact || '—'}</TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    {new Date(customer.createdAt).toLocaleDateString()}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      )}
                      <Button variant="ghost" size="sm" className="self-end" onClick={() => navigate('/admin/customers')}>
                        View all
                        <ArrowRight data-icon="inline-end" aria-hidden />
                      </Button>
                    </TabsContent>
                  </CardContent>
                </Card>
              </Tabs>

              <Card>
                <CardHeader>
                  <CardTitle>Store</CardTitle>
                  <CardDescription>{data?.ordersCapped ? 'Latest 1,000 orders' : 'All time'}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-1">
                  <StoreMetric label="Total sales" value={formatINR(data?.totalRevenue ?? 0)} />
                  <StoreMetric label="Total orders" value={data?.totalOrders ?? 0} />
                  <StoreMetric
                    label="Awaiting payment"
                    value={data?.pendingOrders ?? 0}
                    onClick={() => navigate('/admin/orders?status=pending')}
                  />
                  <StoreMetric
                    label="Shipped"
                    value={data?.shippedOrders ?? 0}
                    onClick={() => navigate('/admin/orders?status=shipped')}
                  />
                  <StoreMetric
                    label="Active products"
                    value={`${data?.activeProducts ?? 0} / ${data?.totalProducts ?? 0}`}
                    onClick={() => navigate('/admin/products')}
                  />
                  <StoreMetric
                    label="Customers"
                    value={data?.totalCustomers ?? 0}
                    onClick={() => navigate('/admin/customers')}
                  />
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => navigate('/admin/products/new')}>
                    Add product
                    <ArrowRight data-icon="inline-end" aria-hidden />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
