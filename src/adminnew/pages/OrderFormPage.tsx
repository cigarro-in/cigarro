import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Package, Truck, CheckCircle2, Clock, Ban, MapPin, Phone, Mail } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { AdminCard, AdminCardContent, AdminCardHeader, AdminCardTitle } from '../components/shared/AdminCard';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';
import { formatINR } from '../../utils/currency';
import { PageHeader } from '../components/shared/PageHeader';

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  product_name: string;
  variant_name?: string;
  product_image?: string;
}

interface Order {
  id: string;
  display_id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  user_phone: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_method: string;
  subtotal: number;
  shipping_cost: number;
  discount_amount: number;
  total: number;
  shipping_address: any;
  billing_address?: any;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
}

export function OrderFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (isEditMode) {
      loadOrder();
    }
  }, [id]);

  const loadOrder = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setOrder(data);
    } catch (error) {
      console.error('Error loading order:', error);
      toast.error('Failed to load order');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!order) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', order.id);

      if (error) throw error;
      toast.success(`Order status updated to ${newStatus}`);
      loadOrder();
    } catch (error) {
      toast.error('Failed to update order status');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'shipped': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'refunded': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'processing': return <Package className="w-4 h-4" />;
      case 'shipped': return <Truck className="w-4 h-4" />;
      case 'delivered': return <CheckCircle2 className="w-4 h-4" />;
      case 'cancelled': return <Ban className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Order not found</h3>
          <p className="text-gray-500">The order you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/admin/orders')} className="mt-4">
            Back to Orders
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[var(--color-creme)] pb-20">
      {/* Header */}
      <PageHeader
        title={`Order #${order.display_id}`}
        description={`${new Date(order.created_at).toLocaleDateString()} at ${new Date(order.created_at).toLocaleTimeString()}`}
        backUrl="/admin/orders"
      >
        <Badge className={getStatusColor(order.status)}>
          {getStatusIcon(order.status)}
          <span className="ml-2">{order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'Unknown'}</span>
        </Badge>
      </PageHeader>

      <div className="max-w-[1600px] mx-auto px-6 grid grid-cols-[1fr_350px] gap-6 mt-6">
        
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Customer Information */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Customer Information</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <div>
                <div className="font-medium text-gray-900">{order.user_name}</div>
                <div className="text-sm text-gray-500 flex items-center">
                  <Mail className="w-4 h-4 mr-2" />
                  {order.user_email}
                </div>
                <div className="text-sm text-gray-500 flex items-center">
                  <Phone className="w-4 h-4 mr-2" />
                  {order.user_phone}
                </div>
              </div>
            </AdminCardContent>
          </AdminCard>

          {/* Shipping Address */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Shipping Address</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <div className="space-y-2">
                <div className="flex items-start">
                  <MapPin className="w-4 h-4 mr-2 mt-1 text-gray-400" />
                  <div>
                    <div className="font-medium text-gray-900">
                      {order.shipping_address?.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {order.shipping_address?.address_line_1}
                      {order.shipping_address?.address_line_2 && (
                        <>, {order.shipping_address.address_line_2}</>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      {order.shipping_address?.city}, {order.shipping_address?.state} {order.shipping_address?.postal_code}
                    </div>
                    <div className="text-sm text-gray-600">
                      {order.shipping_address?.country}
                    </div>
                  </div>
                </div>
              </div>
            </AdminCardContent>
          </AdminCard>

          {/* Order Items */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Order Items</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <div className="space-y-4">
                {order.order_items?.map((item, index) => (
                  <div key={item.id} className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      {item.product_image ? (
                        <img
                          src={item.product_image}
                          alt={item.product_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{item.product_name}</div>
                      {item.variant_name && (
                        <div className="text-sm text-gray-500">{item.variant_name}</div>
                      )}
                      <div className="text-sm text-gray-500">Qty: {item.quantity}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-900">
                        {formatINR(item.price * item.quantity)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatINR(item.price)} each
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </AdminCardContent>
          </AdminCard>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* Order Status */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Order Status</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              {order.status === 'pending' && (
                <Button
                  onClick={() => handleStatusChange('processing')}
                  disabled={saving}
                  className="w-full"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Mark as Processing
                </Button>
              )}
              {order.status === 'processing' && (
                <Button
                  onClick={() => handleStatusChange('shipped')}
                  disabled={saving}
                  className="w-full"
                >
                  <Truck className="w-4 h-4 mr-2" />
                  Mark as Shipped
                </Button>
              )}
              {order.status === 'shipped' && (
                <Button
                  onClick={() => handleStatusChange('delivered')}
                  disabled={saving}
                  className="w-full"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark as Delivered
                </Button>
              )}
              {!['delivered', 'cancelled'].includes(order.status) && (
                <Button
                  onClick={() => handleStatusChange('cancelled')}
                  disabled={saving}
                  variant="outline"
                  className="w-full border-red-200 text-red-600 hover:bg-red-50"
                >
                  <Ban className="w-4 h-4 mr-2" />
                  Cancel Order
                </Button>
              )}
            </AdminCardContent>
          </AdminCard>

          {/* Order Summary */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Order Summary</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatINR(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Shipping</span>
                <span className="font-medium">{formatINR(order.shipping_cost)}</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Discount</span>
                  <span className="font-medium text-green-600">-{formatINR(order.discount_amount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between">
                <span className="font-medium">Total</span>
                <span className="font-bold text-lg">{formatINR(order.total)}</span>
              </div>
            </AdminCardContent>
          </AdminCard>

          {/* Payment Information */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Payment Information</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Method</span>
                <span className="font-medium">{order.payment_method}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Status</span>
                <Badge className={getPaymentStatusColor(order.payment_status)}>
                  {order.payment_status ? order.payment_status.charAt(0).toUpperCase() + order.payment_status.slice(1) : 'Unknown'}
                </Badge>
              </div>
            </AdminCardContent>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
