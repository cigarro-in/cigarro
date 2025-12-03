import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Package, 
  ShoppingCart, 
  Users, 
  IndianRupee,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Clock,
  CheckCircle2,
  Truck,
  AlertCircle,
  Plus,
  BarChart3,
  Activity
} from 'lucide-react';
import { AdminCard, AdminCardContent, AdminCardHeader, AdminCardTitle, AdminCardDescription } from '../components/shared/AdminCard';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { supabase } from '../../lib/supabase/client';
import { formatINR } from '../../utils/currency';
import { PageHeader } from '../components/shared/PageHeader';

interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  pendingOrders: number;
  processingOrders: number;
  shippedOrders: number;
  totalCustomers: number;
  totalRevenue: number;
  todayOrders: number;
  todayRevenue: number;
  lowStockCount: number;
}

interface RecentOrder {
  id: string;
  display_order_id: string;
  shipping_name: string;
  total: number;
  status: string;
  created_at: string;
}

interface RecentCustomer {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    activeProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    processingOrders: 0,
    shippedOrders: 0,
    totalCustomers: 0,
    totalRevenue: 0,
    todayOrders: 0,
    todayRevenue: 0,
    lowStockCount: 0
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [recentCustomers, setRecentCustomers] = useState<RecentCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Parallel fetch all data
      const [
        productsRes,
        ordersRes,
        customersRes,
        variantsRes,
        recentOrdersRes,
        recentCustomersRes
      ] = await Promise.all([
        supabase.from('products').select('id, is_active'),
        supabase.from('orders').select('id, status, total, created_at'),
        supabase.from('profiles').select('id'),
        supabase.from('product_variants').select('id, stock'),
        supabase.from('orders')
          .select('id, display_order_id, shipping_name, total, status, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('profiles')
          .select('id, full_name, email, created_at')
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      const products = productsRes.data || [];
      const orders = ordersRes.data || [];
      const customers = customersRes.data || [];
      const variants = variantsRes.data || [];

      // Calculate stats
      const todayOrders = orders.filter(o => new Date(o.created_at) >= today);
      const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'placed');
      const processingOrders = orders.filter(o => o.status === 'processing');
      const shippedOrders = orders.filter(o => o.status === 'shipped');
      const lowStockVariants = variants.filter(v => v.stock < 10);

      setStats({
        totalProducts: products.length,
        activeProducts: products.filter(p => p.is_active).length,
        totalOrders: orders.length,
        pendingOrders: pendingOrders.length,
        processingOrders: processingOrders.length,
        shippedOrders: shippedOrders.length,
        totalCustomers: customers.length,
        totalRevenue: orders.reduce((sum, o) => sum + (o.total || 0), 0),
        todayOrders: todayOrders.length,
        todayRevenue: todayOrders.reduce((sum, o) => sum + (o.total || 0), 0),
        lowStockCount: lowStockVariants.length
      });

      setRecentOrders(recentOrdersRes.data || []);
      setRecentCustomers(recentCustomersRes.data || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
      case 'placed':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'processing':
        return <Activity className="h-4 w-4 text-blue-500" />;
      case 'shipped':
        return <Truck className="h-4 w-4 text-purple-500" />;
      case 'delivered':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
      case 'placed':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'shipped':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'delivered':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-creme)]">
      <PageHeader 
        title="Dashboard" 
        description="Welcome back! Here's what's happening today."
      >
        <Button variant="outline" size="sm" onClick={loadDashboardData} disabled={loading}>
          {loading ? <Activity className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
        <Button size="sm" className="gap-2" onClick={() => navigate('/admin/products')}>
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </PageHeader>

      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminCard className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/admin/orders')}>
          <AdminCardHeader className="flex flex-row items-center justify-between pb-2">
            <AdminCardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</AdminCardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </AdminCardHeader>
          <AdminCardContent>
            <div className="text-2xl font-bold">{formatINR(stats.totalRevenue)}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-green-600 font-medium">{formatINR(stats.todayRevenue)}</span>
              <span>today</span>
            </div>
          </AdminCardContent>
        </AdminCard>

        <AdminCard className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/admin/orders')}>
          <AdminCardHeader className="flex flex-row items-center justify-between pb-2">
            <AdminCardTitle className="text-sm font-medium text-muted-foreground">Orders</AdminCardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </AdminCardHeader>
          <AdminCardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <div className="flex items-center gap-2 text-xs mt-1">
              <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">
                {stats.pendingOrders} pending
              </Badge>
              <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                {stats.processingOrders} processing
              </Badge>
            </div>
          </AdminCardContent>
        </AdminCard>

        <AdminCard className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/admin/products')}>
          <AdminCardHeader className="flex flex-row items-center justify-between pb-2">
            <AdminCardTitle className="text-sm font-medium text-muted-foreground">Products</AdminCardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </AdminCardHeader>
          <AdminCardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
            <div className="flex items-center gap-2 text-xs mt-1">
              <span className="text-green-600">{stats.activeProducts} active</span>
              {stats.lowStockCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {stats.lowStockCount} low stock
                </Badge>
              )}
            </div>
          </AdminCardContent>
        </AdminCard>

        <AdminCard className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/admin/customers')}>
          <AdminCardHeader className="flex flex-row items-center justify-between pb-2">
            <AdminCardTitle className="text-sm font-medium text-muted-foreground">Customers</AdminCardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </AdminCardHeader>
          <AdminCardContent>
            <div className="text-2xl font-bold">{stats.totalCustomers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total registered users
            </p>
          </AdminCardContent>
        </AdminCard>
      </div>

      {/* Order Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AdminCard className="bg-yellow-50 border-yellow-200">
          <AdminCardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-800">{stats.pendingOrders}</p>
                <p className="text-xs text-yellow-600">Pending Orders</p>
              </div>
            </div>
          </AdminCardContent>
        </AdminCard>

        <AdminCard className="bg-blue-50 border-blue-200">
          <AdminCardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-800">{stats.processingOrders}</p>
                <p className="text-xs text-blue-600">Processing</p>
              </div>
            </div>
          </AdminCardContent>
        </AdminCard>

        <AdminCard className="bg-purple-50 border-purple-200">
          <AdminCardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Truck className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-800">{stats.shippedOrders}</p>
                <p className="text-xs text-purple-600">Shipped</p>
              </div>
            </div>
          </AdminCardContent>
        </AdminCard>

        <AdminCard className="bg-green-50 border-green-200">
          <AdminCardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-800">{stats.todayOrders}</p>
                <p className="text-xs text-green-600">Today's Orders</p>
              </div>
            </div>
          </AdminCardContent>
        </AdminCard>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <AdminCard>
          <AdminCardHeader className="flex flex-row items-center justify-between">
            <div>
              <AdminCardTitle>Recent Orders</AdminCardTitle>
              <AdminCardDescription>Latest orders from your store</AdminCardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/orders')}>
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </AdminCardHeader>
          <AdminCardContent>
            <div className="space-y-4">
              {recentOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No orders yet</p>
                </div>
              ) : (
                recentOrders.map(order => (
                  <div 
                    key={order.id} 
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate('/admin/orders')}
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(order.status)}
                      <div>
                        <p className="font-medium text-sm">#{order.display_order_id}</p>
                        <p className="text-xs text-muted-foreground">{order.shipping_name || 'Guest'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">{formatINR(order.total)}</p>
                      <Badge variant="outline" className={`text-xs ${getStatusColor(order.status)}`}>
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </AdminCardContent>
        </AdminCard>

        {/* Recent Customers */}
        <AdminCard>
          <AdminCardHeader className="flex flex-row items-center justify-between">
            <div>
              <AdminCardTitle>Recent Customers</AdminCardTitle>
              <AdminCardDescription>Newly registered users</AdminCardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/customers')}>
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </AdminCardHeader>
          <AdminCardContent>
            <div className="space-y-4">
              {recentCustomers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No customers yet</p>
                </div>
              ) : (
                recentCustomers.map(customer => (
                  <div 
                    key={customer.id} 
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate('/admin/customers')}
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {customer.full_name?.charAt(0)?.toUpperCase() || customer.email?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{customer.full_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground truncate">{customer.email}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(customer.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </AdminCardContent>
        </AdminCard>
      </div>

      {/* Quick Actions */}
      <AdminCard>
        <AdminCardHeader>
          <AdminCardTitle>Quick Actions</AdminCardTitle>
          <AdminCardDescription>Common tasks and shortcuts</AdminCardDescription>
        </AdminCardHeader>
        <AdminCardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/admin/products')}>
              <Package className="h-5 w-5" />
              <span>Add Product</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/admin/orders')}>
              <ShoppingCart className="h-5 w-5" />
              <span>View Orders</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/admin/discounts')}>
              <BarChart3 className="h-5 w-5" />
              <span>Discounts</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/admin/content')}>
              <Activity className="h-5 w-5" />
              <span>Content</span>
            </Button>
          </div>
        </AdminCardContent>
      </AdminCard>
    </div>
  </div>
  );
}
