import { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  DollarSign, 
  ShoppingBag,
  MapPin,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Separator } from '../../ui/separator';
import { formatINR } from '../../../utils/currency';
import { supabase } from '../../../utils/supabase/client';

interface CustomerDetailsProps {
  customer: any;
  onClose: () => void;
}

interface CustomerOrder {
  id: string;
  display_order_id: string;
  total: number;
  status: string;
  created_at: string;
  items_count: number;
}

export function CustomerDetails({ customer, onClose }: CustomerDetailsProps) {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomerOrders();
  }, [customer.id]);

  const fetchCustomerOrders = async () => {
    try {
      setLoading(true);
      
      // Fetch customer orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          display_order_id,
          total,
          status,
          created_at
        `)
        .eq('user_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (ordersError) throw ordersError;

      // Fetch order items count for each order
      const orderIds = ordersData?.map(order => order.id) || [];
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('order_id, quantity')
        .in('order_id', orderIds);

      if (itemsError) throw itemsError;

      // Combine orders with item counts
      const ordersWithItems = ordersData?.map(order => ({
        ...order,
        items_count: itemsData?.filter(item => item.order_id === order.id)
          .reduce((sum, item) => sum + item.quantity, 0) || 0
      })) || [];

      setOrders(ordersWithItems);
    } catch (error) {
      console.error('Error fetching customer orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'delivered': return 'default';
      case 'shipped': return 'secondary';
      case 'processing': return 'outline';
      case 'placed': return 'destructive';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Customer Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="mr-2 h-5 w-5" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-gray-400" />
              <span className="font-medium">{customer.name}</span>
              {customer.is_admin && (
                <Badge variant="outline" className="text-xs">Admin</Badge>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <Mail className="h-4 w-4 text-gray-400" />
              <span>{customer.email}</span>
            </div>
            
            {customer.phone && (
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <span>{customer.phone}</span>
              </div>
            )}
            
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span>Joined {new Date(customer.created_at).toLocaleDateString()}</span>
            </div>

            <div className="pt-2">
              <Badge variant={customer.status === 'active' ? 'default' : 'destructive'}>
                {customer.status.charAt(0).toUpperCase() + customer.status.slice(1)}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <DollarSign className="mr-2 h-5 w-5" />
              Purchase Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold">{customer.orderCount}</div>
                <div className="text-sm text-gray-500">Total Orders</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{formatINR(customer.totalSpent)}</div>
                <div className="text-sm text-gray-500">Total Spent</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-lg font-semibold">{formatINR(customer.averageOrderValue)}</div>
                <div className="text-sm text-gray-500">Avg. Order Value</div>
              </div>
              <div>
                <div className="text-lg font-semibold">
                  {customer.lastOrderDate 
                    ? new Date(customer.lastOrderDate).toLocaleDateString()
                    : 'Never'
                  }
                </div>
                <div className="text-sm text-gray-500">Last Order</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <ShoppingBag className="mr-2 h-5 w-5" />
              Recent Orders
            </div>
            <Badge variant="secondary">{orders.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : orders.length > 0 ? (
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium">#{order.display_order_id}</div>
                    <div className="text-sm text-gray-600">
                      {order.items_count} item{order.items_count !== 1 ? 's' : ''}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {new Date(order.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatINR(order.total)}</div>
                    <Badge variant={getStatusBadgeVariant(order.status)} className="text-xs">
                      {order.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <ShoppingBag className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p>No orders found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
