import { useNavigate } from 'react-router-dom';
import {
  Package,
  ShoppingCart,
  Users,
  IndianRupee,
  Clock,
  CheckCircle2,
  Truck,
  AlertCircle,
  Plus,
  Activity,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
import { formatINR } from '../../utils/currency';
import { PageHeader } from '../components/shared/PageHeader';

interface RecentOrder {
  id: string;
  display_order_id: string;
  shipping_name: string;
  total: number;
  status: string;
  created_at: number;
}

interface RecentCustomer {
  id: string;
  full_name: string;
  email: string;
  created_at: number;
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'pending':
    case 'awaiting':
    case 'processing':
      return 'secondary';
    case 'paid':
    case 'late_paid':
    case 'delivered':
      return 'default';
    default:
      return 'outline';
  }
}

function statusLabel(status: string) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'pending':
      return <Clock className="h-4 w-4 text-sunflower" aria-hidden />;
    case 'paid':
    case 'late_paid':
    case 'delivered':
      return <CheckCircle2 className="h-4 w-4 text-canyon" aria-hidden />;
    case 'awaiting':
    case 'processing':
      return <Activity className="h-4 w-4 text-dark" aria-hidden />;
    case 'shipped':
      return <Truck className="h-4 w-4 text-coyote" aria-hidden />;
    default:
      return <AlertCircle className="h-4 w-4 text-dark" aria-hidden />;
  }
}

const cardShell =
  'bg-creme-light border-coyote/40 shadow-sm';

export function DashboardPage() {
  const navigate = useNavigate();
  const org = useOrg();
  const data = useQuery(
    api.adminStats.getDashboardStats,
    org ? { orgId: org._id } : 'skip'
  );
  const loading = data === undefined;

  const recentOrders: RecentOrder[] = (data?.recentOrders ?? []).map((o: any) => ({
    id: String(o.id),
    display_order_id: o.display_order_id,
    shipping_name: o.shipping_name,
    total: o.total,
    status: o.status,
    created_at: Number(o.created_at),
  }));
  const recentCustomers: RecentCustomer[] = (data?.recentCustomers ?? []).map((c: any) => ({
    id: String(c.id),
    full_name: c.name,
    email: c.phone || '',
    created_at: Number(c.created_at),
  }));

  const todayRevenue = data?.todayRevenue ?? 0;
  const todayOrders = data?.todayOrders ?? 0;
  const totalRevenue = data?.totalRevenue ?? 0;
  const totalOrders = data?.totalOrders ?? 0;
  const pendingOrders = data?.pendingOrders ?? 0;
  const processingOrders = data?.processingOrders ?? 0;
  const shippedOrders = data?.shippedOrders ?? 0;
  const totalProducts = data?.totalProducts ?? 0;
  const activeProducts = data?.activeProducts ?? 0;
  const totalCustomers = data?.totalCustomers ?? 0;
  const lowStockCount = data?.lowStockCount ?? 0;

  return (
    <div className="min-h-screen bg-creme">
      <PageHeader
        title="Store overview"
        description="Today's trade, open orders, and recent activity."
      >
        <Button size="sm" className="gap-2" onClick={() => navigate('/admin/products/new')}>
          <Plus className="h-4 w-4" aria-hidden />
          New Product
        </Button>
      </PageHeader>

      <div className="p-6 max-w-400 mx-auto space-y-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Loading store stats">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className={cardShell}>
                <CardContent className="pt-6">
                  <div className="h-4 w-24 rounded bg-coyote/40 animate-pulse" />
                  <div className="h-8 w-28 rounded mt-3 bg-coyote/40 animate-pulse" />
                  <div className="h-3 w-20 rounded mt-2 bg-coyote/30 animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {/* Today + lifetime — each metric shown once */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className={cardShell}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-dark/70">Today&apos;s revenue</CardTitle>
                  <IndianRupee className="h-4 w-4 text-canyon" aria-hidden />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-dark">{formatINR(todayRevenue)}</div>
                  <p className="text-xs text-dark/60 mt-1">Paid orders placed today</p>
                </CardContent>
              </Card>

              <Card className={cardShell}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-dark/70">Today&apos;s orders</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-canyon" aria-hidden />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-dark">{todayOrders}</div>
                  <p className="text-xs text-dark/60 mt-1">All orders placed today</p>
                </CardContent>
              </Card>

              <Card className={cardShell}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-dark/70">Total revenue</CardTitle>
                  <IndianRupee className="h-4 w-4 text-dark/50" aria-hidden />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-dark">{formatINR(totalRevenue)}</div>
                  <p className="text-xs text-dark/60 mt-1">Lifetime paid orders</p>
                </CardContent>
              </Card>

              <Card className={cardShell}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-dark/70">Total orders</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-dark/50" aria-hidden />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-dark">{totalOrders}</div>
                  <p className="text-xs text-dark/60 mt-1">Lifetime orders</p>
                </CardContent>
              </Card>
            </div>

            {/* Actionable pipeline — open work, each count shown once */}
            <section aria-label="Orders needing attention">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => navigate('/admin/orders')}
                  className="text-left rounded-xl border border-sunflower/60 bg-creme-light p-4 hover:shadow-md transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canyon"
                  aria-label={`${pendingOrders} orders awaiting payment. View orders.`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-sunflower/25 rounded-lg">
                      <Clock className="h-5 w-5 text-canyon" aria-hidden />
                    </div>
                    <div className="flex-1">
                      <p className="text-2xl font-bold text-dark">{pendingOrders}</p>
                      <p className="text-xs text-canyon">Awaiting payment</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-sunflower" aria-hidden />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/admin/orders')}
                  className="text-left rounded-xl border border-canyon/40 bg-creme-light p-4 hover:shadow-md transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canyon"
                  aria-label={`${processingOrders} paid orders to fulfil. View orders.`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-canyon/10 rounded-lg">
                      <Activity className="h-5 w-5 text-canyon" aria-hidden />
                    </div>
                    <div className="flex-1">
                      <p className="text-2xl font-bold text-dark">{processingOrders}</p>
                      <p className="text-xs text-canyon">Paid · to fulfil</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-canyon" aria-hidden />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/admin/orders')}
                  className="text-left rounded-xl border border-coyote bg-creme-light p-4 hover:shadow-md transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canyon"
                  aria-label={`${shippedOrders} orders shipped. View orders.`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-coyote/30 rounded-lg">
                      <Truck className="h-5 w-5 text-dark" aria-hidden />
                    </div>
                    <div className="flex-1">
                      <p className="text-2xl font-bold text-dark">{shippedOrders}</p>
                      <p className="text-xs text-canyon">Shipped · in transit</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-coyote" aria-hidden />
                  </div>
                </button>
              </div>
            </section>

            {/* Catalog + customers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className={cardShell}>
                <CardContent className="pt-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-canyon/10">
                      <Package className="h-5 w-5 text-canyon" aria-hidden />
                    </div>
                    <div className="flex-1">
                      <p className="text-2xl font-bold text-dark">
                        {activeProducts}
                        <span className="text-sm font-normal text-dark/60"> / {totalProducts} products</span>
                      </p>
                      <p className="text-xs text-dark/60">Catalog live</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/admin/inventory')}>
                      Inventory <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                  {lowStockCount > 0 && (
                    <button
                      type="button"
                      onClick={() => navigate('/admin/inventory')}
                      className="mt-3 w-full text-left flex items-center justify-between gap-2 rounded-lg border border-canyon/50 bg-creme-light px-3 py-2 hover:shadow-sm transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canyon"
                      aria-label={`${lowStockCount} variants low on stock. View inventory.`}
                    >
                      <span className="text-sm text-canyon font-medium">{lowStockCount} variant{lowStockCount === 1 ? '' : 's'} low on stock</span>
                      <span className="text-xs text-canyon font-medium flex items-center gap-1">
                        Restock <ChevronRight className="h-3 w-3" aria-hidden />
                      </span>
                    </button>
                  )}
                </CardContent>
              </Card>

              <Card className={cardShell}>
                <CardContent className="pt-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-canyon/10">
                      <Users className="h-5 w-5 text-canyon" aria-hidden />
                    </div>
                    <div className="flex-1">
                      <p className="text-2xl font-bold text-dark">{totalCustomers}</p>
                      <p className="text-xs text-dark/60">Registered customers</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/admin/customers')}>
                      View all <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {!loading && data?.ordersCapped && (
          <p className="text-sm text-dark/60">
            Showing the latest 1,000 orders in order totals.
          </p>
        )}

        {/* Recent activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className={cardShell}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-dark">Recent orders</CardTitle>
                <CardDescription>Latest orders from your store</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin/orders')}>
                View all <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {loading ? (
                  [0, 1, 2].map((i) => (
                    <div key={i} className="h-16 rounded-lg border border-coyote/30 bg-creme animate-pulse" />
                  ))
                ) : recentOrders.length === 0 ? (
                  <div className="text-center py-8 text-dark/60">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" aria-hidden />
                    <p>No orders yet</p>
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/admin/orders')}>
                      Go to orders
                    </Button>
                  </div>
                ) : (
                  recentOrders.map((order) => (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => navigate(`/admin/orders/${order.id}`)}
                      className="w-full flex items-center justify-between gap-3 p-3 rounded-lg border border-coyote/30 bg-white/60 hover:bg-white transition-colors text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canyon"
                      aria-label={`Order ${order.display_order_id}, ${order.status}, ${formatINR(order.total)}`}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <StatusIcon status={order.status} />
                        <span className="min-w-0">
                          <span className="block font-medium text-sm text-dark">#{order.display_order_id}</span>
                          <span className="block text-xs text-dark/60 truncate">{order.shipping_name || 'Guest'}</span>
                        </span>
                      </span>
                      <span className="text-right shrink-0">
                        <span className="block font-medium text-sm text-dark">{formatINR(order.total)}</span>
                        <Badge variant={statusBadgeVariant(order.status)} className="mt-1 text-xs">
                          {statusLabel(order.status)}
                        </Badge>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className={cardShell}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-dark">Recent customers</CardTitle>
                <CardDescription>Newly registered users</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin/customers')}>
                View all <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {loading ? (
                  [0, 1, 2].map((i) => (
                    <div key={i} className="h-16 rounded-lg border border-coyote/30 bg-creme animate-pulse" />
                  ))
                ) : recentCustomers.length === 0 ? (
                  <div className="text-center py-8 text-dark/60">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" aria-hidden />
                    <p>No customers yet</p>
                  </div>
                ) : (
                  recentCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => navigate('/admin/customers')}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-coyote/30 bg-white/60 hover:bg-white transition-colors text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canyon"
                      aria-label={`Customer ${customer.full_name}`}
                    >
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="bg-canyon/10 text-canyon">
                          {customer.full_name?.charAt(0)?.toUpperCase() || customer.email?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium text-sm truncate text-dark">{customer.full_name || 'Unknown'}</span>
                        <span className="block text-xs text-dark/60 truncate">{customer.email}</span>
                      </span>
                      <span className="text-xs text-dark/60 shrink-0">
                        {new Date(customer.created_at).toLocaleDateString()}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
