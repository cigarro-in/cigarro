import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  ShoppingBag, 
  Users, 
  IndianRupee,
  Eye,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { supabase } from '../../../utils/supabase/client';
import { formatINR } from '../../../utils/currency';

interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  pendingOrders: number;
  totalCustomers: number;
  totalRevenue: number;
  monthlyRevenue: number;
  revenueGrowth: number;
}

interface RecentOrder {
  id: string;
  display_order_id: string;
  customerName: string;
  total: number;
  status: string;
  created_at: string;
}

export function DashboardOverview() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    activeProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    totalCustomers: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    revenueGrowth: 0
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch products stats
      const { data: products } = await supabase.from('products').select('id, is_active');
      const totalProducts = products?.length || 0;
      const activeProducts = products?.filter(p => p.is_active).length || 0;

      // Fetch orders stats
      const { data: orders } = await supabase.from('orders').select('id, total, status, created_at');
      const totalOrders = orders?.length || 0;
      const pendingOrders = orders?.filter(o => o.status === 'placed' || o.status === 'processing').length || 0;
      
      // Calculate revenue
      const totalRevenue = orders?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;
      
      // Calculate monthly revenue (current month)
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const monthlyRevenue = orders?.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
      }).reduce((sum, order) => sum + (order.total || 0), 0) || 0;

      // Fetch customers count
      const { data: customers } = await supabase.from('profiles').select('id');
      const totalCustomers = customers?.length || 0;

      // Fetch recent orders with customer info
      const { data: recentOrdersData } = await supabase
        .from('orders')
        .select(`
          id,
          display_order_id,
          total,
          status,
          created_at,
          user_id
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      const formattedRecentOrders = recentOrdersData?.map(order => ({
        id: order.id,
        display_order_id: order.display_order_id,
        customerName: 'Customer',
        total: order.total,
        status: order.status,
        created_at: order.created_at
      })) || [];

      setStats({
        totalProducts,
        activeProducts,
        totalOrders,
        pendingOrders,
        totalCustomers,
        totalRevenue,
        monthlyRevenue,
        revenueGrowth: 12.5 // This would need proper calculation with previous month data
      });

      setRecentOrders(formattedRecentOrders);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards: Array<{
    title: string;
    value: string;
    change: string;
    changeType: 'positive' | 'negative' | 'neutral';
    icon: any;
    description: string;
  }> = [
    {
      title: 'Total Revenue',
      value: formatINR(stats.totalRevenue),
      change: `+${stats.revenueGrowth}%`,
      changeType: 'positive' as const,
      icon: IndianRupee,
      description: 'Total sales revenue'
    },
    {
      title: 'Monthly Revenue',
      value: formatINR(stats.monthlyRevenue),
      change: '+8.2%',
      changeType: 'positive' as const,
      icon: TrendingUp,
      description: 'This month\'s revenue'
    },
    {
      title: 'Total Orders',
      value: stats.totalOrders.toString(),
      change: `${stats.pendingOrders} pending`,
      changeType: 'neutral' as const,
      icon: ShoppingBag,
      description: 'All time orders'
    },
    {
      title: 'Products',
      value: stats.totalProducts.toString(),
      change: `${stats.activeProducts} active`,
      changeType: 'neutral' as const,
      icon: Package,
      description: 'Total products in catalog'
    },
    {
      title: 'Customers',
      value: stats.totalCustomers.toString(),
      change: '+5.4%',
      changeType: 'positive' as const,
      icon: Users,
      description: 'Registered customers'
    }
  ];

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'delivered': return 'default';
      case 'shipped': return 'secondary';
      case 'processing': return 'outline';
      case 'placed': return 'destructive';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark">Dashboard Overview</h1>
          <p className="text-dark/70">Welcome back! Here's what's happening with your store.</p>
        </div>
        <Button onClick={fetchDashboardData} variant="outline" className="border-coyote text-dark hover:bg-coyote/20">
          <Eye className="mr-2 h-4 w-4" />
          Refresh Data
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="hover:shadow-md transition-shadow bg-creme-light border-coyote">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-dark/70">{stat.title}</p>
                    <p className="text-2xl font-bold text-dark">{stat.value}</p>
                  </div>
                  <div className="h-12 w-12 bg-canyon/10 rounded-lg flex items-center justify-center">
                    <Icon className="h-6 w-6 text-canyon" />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-dark/60">{stat.description}</span>
                  <span className={`text-xs font-medium ${
                    stat.changeType === 'positive' ? 'text-canyon' : 
                    stat.changeType === 'negative' ? 'text-red-600' : 
                    stat.changeType === 'neutral' ? 'text-dark/60' : 'text-dark/60'
                  }`}>
                    {stat.change}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Recent Orders
              <Badge variant="secondary">{recentOrders.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentOrders.length > 0 ? (
                recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">#{order.display_order_id}</p>
                      <p className="text-xs text-gray-600">{order.customerName}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">{formatINR(order.total)}</p>
                      <Badge variant={getStatusBadgeVariant(order.status)} className="text-xs">
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingBag className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p>No recent orders</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
                <Package className="h-6 w-6 mb-2" />
                <span className="text-sm">Add Product</span>
              </Button>
              <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
                <ShoppingBag className="h-6 w-6 mb-2" />
                <span className="text-sm">View Orders</span>
              </Button>
              <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
                <Users className="h-6 w-6 mb-2" />
                <span className="text-sm">Customers</span>
              </Button>
              <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
                <AlertTriangle className="h-6 w-6 mb-2" />
                <span className="text-sm">Low Stock</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
