import { useState, useEffect } from 'react';
import { 
  Eye, 
  Truck, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Package, 
  CreditCard,
  MapPin,
  Phone,
  Mail
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { toast } from 'sonner';
import { supabase } from '../../../utils/supabase/client';
import { formatINR } from '../../../utils/currency';
import { DataTable } from '../shared/DataTable';
import { StandardModal } from '../shared/StandardModal';
import { OrderDetails } from './OrderDetails';
import { ShippingModal } from './ShippingModal';

interface Order {
  id: string;
  display_order_id: string;
  user_id: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  items: Array<{
    id: string;
    name: string;
    brand: string;
    quantity: number;
    price: number;
    image?: string;
  }>;
  total: number;
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  status: 'placed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  payment_method?: string;
  payment_verified: 'YES' | 'NO' | 'REJECTED';
  payment_confirmed: boolean;
  payment_confirmed_at?: string;
  payment_verified_at?: string;
  payment_verified_by?: string;
  payment_rejection_reason?: string;
  transaction_id?: string;
  payment_proof_url?: string;
  tracking_number?: string;
  estimated_delivery?: string;
  shipping_address: string;
  shipping_city: string;
  shipping_state: string;
  shipping_zip_code: string;
  shipping_country: string;
  shipping_company?: string;
  tracking_id?: string;
  tracking_link?: string;
  shipping_method?: string;
  shipping_notes?: string;
  shipped_at?: string;
  shipped_by?: string;
  delivered_at?: string;
  delivered_by?: string;
  delivery_notes?: string;
  delivery_proof_url?: string;
  created_at: string;
  updated_at: string;
}

export function OrdersManager() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOrderDetails, setShowOrderDetails] = useState<string | null>(null);
  const [showShippingModal, setShowShippingModal] = useState<string | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      
      // Fetch orders with customer profiles
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          profiles!orders_user_id_fkey(name, email)
        `)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Fetch order items for each order
      const orderIds = ordersData?.map(order => order.id) || [];
      const { data: orderItemsData, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          *,
          products(name, brand, gallery_images)
        `)
        .in('order_id', orderIds);

      if (itemsError) throw itemsError;

      // Combine orders with their items
      const ordersWithItems = ordersData?.map(order => ({
        ...order,
        customerName: order.profiles?.name || 'Unknown Customer',
        customerEmail: order.profiles?.email || '',
        items: orderItemsData?.filter(item => item.order_id === order.id).map(item => ({
          id: item.id,
          name: item.products?.name || 'Unknown Product',
          brand: item.products?.brand || '',
          quantity: item.quantity,
          price: item.price,
          image: item.products?.gallery_images?.[0]
        })) || []
      })) || [];

      setOrders(ordersWithItems);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (orderId: string, status: string) => {
    try {
      const updateData: any = { status };
      
      if (status === 'delivered') {
        updateData.delivered_at = new Date().toISOString();
      } else if (status === 'shipped') {
        updateData.shipped_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;
      
      toast.success('Order status updated successfully');
      fetchOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update order status');
    }
  };

  const handlePaymentVerification = async (orderId: string, verified: 'YES' | 'NO' | 'REJECTED', reason?: string) => {
    try {
      const updateData: any = {
        payment_verified: verified,
        payment_verified_at: new Date().toISOString(),
        payment_verified_by: 'admin' // You might want to use actual admin user ID
      };

      if (verified === 'REJECTED' && reason) {
        updateData.payment_rejection_reason = reason;
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;
      
      toast.success(`Payment ${verified.toLowerCase()} successfully`);
      fetchOrders();
    } catch (error) {
      console.error('Error updating payment verification:', error);
      toast.error('Failed to update payment verification');
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

  const getPaymentBadgeVariant = (verified: string) => {
    switch (verified) {
      case 'YES': return 'default';
      case 'NO': return 'secondary';
      case 'REJECTED': return 'destructive';
      default: return 'outline';
    }
  };

  const columns = [
    {
      key: 'display_order_id',
      label: 'Order ID',
      sortable: true,
      render: (id: string) => (
        <div className="font-mono text-sm font-medium">#{id}</div>
      )
    },
    {
      key: 'customerName',
      label: 'Customer',
      sortable: true,
      render: (name: string, order: Order) => (
        <div>
          <div className="font-medium text-gray-900">{name}</div>
          <div className="text-sm text-gray-500">{order.customerEmail}</div>
        </div>
      )
    },
    {
      key: 'items',
      label: 'Items',
      render: (items: any[]) => (
        <div className="text-sm">
          {items.length} item{items.length !== 1 ? 's' : ''}
        </div>
      )
    },
    {
      key: 'total',
      label: 'Total',
      sortable: true,
      render: (total: number) => (
        <div className="font-medium">{formatINR(total)}</div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (status: string) => (
        <Badge variant={getStatusBadgeVariant(status)}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      )
    },
    {
      key: 'payment_verified',
      label: 'Payment',
      render: (verified: string) => (
        <Badge variant={getPaymentBadgeVariant(verified)}>
          {verified === 'YES' ? 'Verified' : verified === 'NO' ? 'Pending' : 'Rejected'}
        </Badge>
      )
    },
    {
      key: 'created_at',
      label: 'Date',
      sortable: true,
      render: (date: string) => (
        <div className="text-sm">
          {new Date(date).toLocaleDateString()}
          <div className="text-xs text-gray-500">
            {new Date(date).toLocaleTimeString()}
          </div>
        </div>
      )
    }
  ];

  const actions = [
    {
      label: 'View Details',
      icon: Eye,
      onClick: (order: Order) => setShowOrderDetails(order.id)
    },
    {
      label: 'Ship Order',
      icon: Truck,
      onClick: (order: Order) => setShowShippingModal(order.id)
    },
    {
      label: 'Mark as Processing',
      icon: Clock,
      onClick: (order: Order) => handleStatusUpdate(order.id, 'processing')
    },
    {
      label: 'Mark as Delivered',
      icon: CheckCircle,
      onClick: (order: Order) => handleStatusUpdate(order.id, 'delivered')
    }
  ];

  const filters = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'placed', label: 'Placed' },
        { value: 'processing', label: 'Processing' },
        { value: 'shipped', label: 'Shipped' },
        { value: 'delivered', label: 'Delivered' },
        { value: 'cancelled', label: 'Cancelled' }
      ]
    },
    {
      key: 'payment_verified',
      label: 'Payment',
      options: [
        { value: 'YES', label: 'Verified' },
        { value: 'NO', label: 'Pending' },
        { value: 'REJECTED', label: 'Rejected' }
      ]
    }
  ];

  const selectedOrder = orders.find(order => order.id === showOrderDetails);
  const shippingOrder = orders.find(order => order.id === showShippingModal);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-600">Manage customer orders and fulfillment</p>
        </div>
      </div>

      <DataTable
        title="Order Management"
        data={orders}
        columns={columns}
        actions={actions}
        searchPlaceholder="Search orders..."
        filters={filters}
        loading={loading}
        selectedItems={selectedOrders}
        onSelectionChange={setSelectedOrders}
      />

      {/* Order Details Modal */}
      {selectedOrder && (
        <StandardModal
          isOpen={!!showOrderDetails}
          onClose={() => setShowOrderDetails(null)}
          title={`Order #${selectedOrder.display_order_id}`}
          size="lg"
        >
          <OrderDetails 
            order={selectedOrder}
            onStatusUpdate={handleStatusUpdate}
            onPaymentVerification={handlePaymentVerification}
            onClose={() => setShowOrderDetails(null)}
          />
        </StandardModal>
      )}

      {/* Shipping Modal */}
      {shippingOrder && (
        <StandardModal
          isOpen={!!showShippingModal}
          onClose={() => setShowShippingModal(null)}
          title={`Ship Order #${shippingOrder.display_order_id}`}
          size="md"
        >
          <ShippingModal
            order={shippingOrder}
            onSave={() => {
              setShowShippingModal(null);
              fetchOrders();
            }}
            onCancel={() => setShowShippingModal(null)}
          />
        </StandardModal>
      )}
    </div>
  );
}
