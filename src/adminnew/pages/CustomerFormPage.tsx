import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, User, Mail, Phone, Calendar, DollarSign, ShoppingBag, MapPin, Clock } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { AdminCard, AdminCardContent, AdminCardHeader, AdminCardTitle } from '../components/shared/AdminCard';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { formatINR } from '../../utils/currency';
import { supabase } from '../../lib/supabase/client';
import { PageHeader } from '../components/shared/PageHeader';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  is_admin: boolean;
  orderCount: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate?: string;
  firstOrderDate?: string;
  status: 'active' | 'inactive' | 'blocked';
  created_at: string;
  updated_at: string;
}

interface CustomerOrder {
  id: string;
  display_order_id: string;
  total: number;
  status: string;
  created_at: string;
  items_count: number;
}

export function CustomerFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);

  useEffect(() => {
    if (isEditMode) {
      loadCustomer();
    }
  }, [id]);

  const loadCustomer = async () => {
    setLoading(true);
    try {
      // Fetch customer profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (profileError) throw profileError;

      // Fetch order statistics
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('user_id, total, created_at');

      if (ordersError) throw ordersError;

      // Calculate customer statistics
      const customerOrders = ordersData?.filter(order => order.user_id === id) || [];
      const orderCount = customerOrders.length;
      const totalSpent = customerOrders.reduce((sum, order) => sum + (order.total || 0), 0);
      const averageOrderValue = orderCount > 0 ? totalSpent / orderCount : 0;
      
      const orderDates = customerOrders.map(order => new Date(order.created_at));
      const lastOrderDate = orderDates.length > 0 ? new Date(Math.max(...orderDates.map(d => d.getTime()))).toISOString() : undefined;
      const firstOrderDate = orderDates.length > 0 ? new Date(Math.min(...orderDates.map(d => d.getTime()))).toISOString() : undefined;

      const customerData: Customer = {
        id: profileData.id,
        name: profileData.name || 'Unknown',
        email: profileData.email || '',
        phone: profileData.phone,
        is_admin: profileData.is_admin || false,
        orderCount,
        totalSpent,
        averageOrderValue,
        lastOrderDate,
        firstOrderDate,
        status: profileData.status || 'active',
        created_at: profileData.created_at,
        updated_at: profileData.updated_at
      };

      setCustomer(customerData);
      await fetchCustomerOrders();
    } catch (error) {
      console.error('Error loading customer:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerOrders = async () => {
    if (!id) return;
    
    try {
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
        .eq('user_id', id)
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
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'inactive': return 'secondary';
      case 'blocked': return 'destructive';
      default: return 'outline';
    }
  };

  const getOrderStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'delivered': return 'default';
      case 'shipped': return 'secondary';
      case 'processing': return 'outline';
      case 'pending': return 'destructive';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Customer not found</h3>
          <p className="text-gray-500">The customer you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/admin/customers')} className="mt-4">
            Back to Customers
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[var(--color-creme)] pb-20">
      {/* Header */}
      <PageHeader
        title={customer.name}
        description={`Customer since ${new Date(customer.created_at).toLocaleDateString()}`}
        backUrl="/admin/customers"
      >
        <Badge variant={getStatusBadgeVariant(customer.status)}>
          {customer.status.charAt(0).toUpperCase() + customer.status.slice(1)}
        </Badge>
        {customer.is_admin && (
          <Badge variant="outline">Admin</Badge>
        )}
      </PageHeader>

      <div className="max-w-[1600px] mx-auto px-6 grid grid-cols-[1fr_350px] gap-6 mt-6">
        
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Customer Overview */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Customer Overview</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-gray-500">
                    <User className="w-4 h-4 mr-2" />
                    Name
                  </div>
                  <div className="font-medium">{customer.name}</div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-gray-500">
                    <Mail className="w-4 h-4 mr-2" />
                    Email
                  </div>
                  <div className="font-medium">{customer.email}</div>
                </div>
                {customer.phone && (
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-gray-500">
                      <Phone className="w-4 h-4 mr-2" />
                      Phone
                    </div>
                    <div className="font-medium">{customer.phone}</div>
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-gray-500">
                    <Calendar className="w-4 h-4 mr-2" />
                    Member Since
                  </div>
                  <div className="font-medium">{new Date(customer.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            </AdminCardContent>
          </AdminCard>

          {/* Recent Orders */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Recent Orders</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <div className="space-y-4">
                {orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-4 border border-[var(--color-coyote)]/30 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">
                        #{order.display_order_id}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(order.created_at).toLocaleDateString()} • {order.items_count} items
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-900">
                        {formatINR(order.total)}
                      </div>
                      <Badge variant={getOrderStatusBadgeVariant(order.status)} className="text-xs">
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                ))}
                {orders.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <ShoppingBag className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                    <p>No orders yet</p>
                  </div>
                )}
              </div>
            </AdminCardContent>
          </AdminCard>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* Statistics */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Statistics</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Orders</span>
                <span className="font-bold text-lg">{customer.orderCount}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Spent</span>
                <span className="font-bold text-lg">{formatINR(customer.totalSpent)}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Average Order</span>
                <span className="font-bold text-lg">{formatINR(customer.averageOrderValue)}</span>
              </div>
            </AdminCardContent>
          </AdminCard>

          {/* Order Timeline */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Order Timeline</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-500">
                  <Calendar className="w-4 h-4 mr-2" />
                  First Order
                </div>
                <div className="font-medium">
                  {customer.firstOrderDate ? new Date(customer.firstOrderDate).toLocaleDateString() : 'No orders yet'}
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-500">
                  <Clock className="w-4 h-4 mr-2" />
                  Last Order
                </div>
                <div className="font-medium">
                  {customer.lastOrderDate ? new Date(customer.lastOrderDate).toLocaleDateString() : 'No orders yet'}
                </div>
              </div>
            </AdminCardContent>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
