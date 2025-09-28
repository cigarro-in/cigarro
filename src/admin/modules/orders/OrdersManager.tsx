import { useState, useEffect } from 'react';
import { 
  CreditCard,
  MapPin,
  Phone,
  Mail
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '../../../utils/supabase/client';
import { formatINR } from '../../../utils/currency';
import { DataTable } from '../../components/shared/DataTable';
import { StandardModal } from '../../components/shared/StandardModal';
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
      
      // Fetch orders directly (customer info is stored in shipping fields)
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Fetch order items for each order
      const orderIds = ordersData?.map(order => order.id) || [];
      const { data: orderItemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds);

      if (itemsError) throw itemsError;

      // Combine orders with their items
      const ordersWithItems = ordersData?.map(order => ({
        ...order,
        customerName: order.shipping_name || 'Unknown Customer',
        customerEmail: order.payment_link_email || '',
        customerPhone: order.shipping_phone || '',
        items: orderItemsData?.filter(item => item.order_id === order.id).map(item => ({
          id: item.id,
          name: item.product_name || 'Unknown Product',
          brand: item.product_brand || '',
          quantity: item.quantity,
          price: item.product_price,
          image: item.product_image
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
        payment_verified_at: new Date().toISOString()
        // Note: payment_verified_by field removed to avoid UUID constraint error
        // TODO: Implement proper admin user ID tracking if needed
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
      render: (id: string, order: Order) => (
        <div className="font-mono text-sm font-medium">
          #{getOrderNumber(order)}
        </div>
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

  const handleRowClick = (order: Order) => {
    setShowOrderDetails(order.id);
  };

  const getOrderNumber = (order: Order) => {
    // With the new migration, display_order_id should always be populated
    // Fallback logic kept for safety during transition period
    return order.display_order_id || 
      new Date(order.created_at).getTime().toString().slice(-6).padStart(6, '0');
  };

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
        searchPlaceholder="Search orders..."
        filters={filters}
        loading={loading}
        selectedItems={selectedOrders}
        onSelectionChange={setSelectedOrders}
        onRowClick={handleRowClick}
      />

      {/* Order Details Modal */}
      {selectedOrder && (
        <StandardModal
          isOpen={!!showOrderDetails}
          onClose={() => setShowOrderDetails(null)}
          title={`Order #${getOrderNumber(selectedOrder)}`}
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
          title={`Ship Order #${getOrderNumber(shippingOrder)}`}
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
