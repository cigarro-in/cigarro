import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
  Truck,
  Ban,
  CheckCircle2,
  Clock,
  Package,
  MapPin,
  Phone,
  Mail,
  ChevronDown
} from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { formatINR } from '../../utils/currency';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';
import { DataTable } from '../components/shared/DataTable';
import { PageHeader } from '../components/shared/PageHeader';

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  product_name: string;
  variant_name?: string;
}

interface Order {
  id: string;
  display_order_id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  payment_verified: string;
  payment_method: string;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  // Shipping info from orders table
  shipping_name: string;
  shipping_address: string;
  shipping_city: string;
  shipping_state: string;
  shipping_zip_code: string;
  shipping_phone: string;
  // User info from profiles join
  profiles?: {
    name: string;
    email: string;
  };
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
}

export function OrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          profiles:user_id(name, email),
          order_items(id, product_id, quantity, product_price, product_name, variant_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleEditOrder = (order: Order) => {
    navigate(`/admin/orders/${order.id}`);
  };

  const handleBulkStatusChange = async (orderIds: string[], status: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .in('id', orderIds);

      if (error) throw error;
      toast.success(`${orderIds.length} orders updated to ${status}`);
      setSelectedOrders([]);
      fetchOrders();
    } catch (error) {
      toast.error('Failed to update order status');
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

  const columns = [
    {
      key: 'display_order_id',
      label: 'Order ID',
      sortable: true,
      render: (displayId: string) => (
        <div className="font-mono text-sm font-medium text-gray-900">
          #{displayId}
        </div>
      )
    },
    {
      key: 'shipping_name',
      label: 'Customer',
      sortable: true,
      render: (name: string, order: Order) => (
        <div>
          <div className="font-medium text-gray-900">{name || order.profiles?.name || 'Unknown'}</div>
          <div className="text-sm text-gray-500">{order.profiles?.email || ''}</div>
          <div className="text-xs text-gray-400 flex items-center">
            <Phone className="w-3 h-3 mr-1" />
            {order.shipping_phone || 'N/A'}
          </div>
        </div>
      )
    },
    {
      key: 'order_items',
      label: 'Items',
      render: (items: OrderItem[]) => (
        <div className="space-y-1">
          {items?.slice(0, 2).map((item, index) => (
            <div key={index} className="text-sm text-gray-600">
              {item.quantity}x {item.product_name}
              {item.variant_name && (
                <span className="text-gray-400"> ({item.variant_name})</span>
              )}
            </div>
          ))}
          {items?.length > 2 && (
            <div className="text-xs text-gray-400">
              +{items.length - 2} more items
            </div>
          )}
        </div>
      )
    },
    {
      key: 'total',
      label: 'Total',
      sortable: true,
      render: (total: number) => (
        <div className="font-medium text-gray-900">
          {formatINR(total)}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (status: string) => (
        <Badge className={getStatusColor(status)}>
          {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown'}
        </Badge>
      )
    },
    {
      key: 'payment_verified',
      label: 'Payment',
      render: (status: string) => (
        <Badge className={status === 'YES' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
          {status === 'YES' ? 'Verified' : 'Pending'}
        </Badge>
      )
    },
    {
      key: 'created_at',
      label: 'Date',
      sortable: true,
      render: (date: string) => (
        <div className="text-sm text-gray-600">
          {new Date(date).toLocaleDateString()}
          <div className="text-xs text-gray-400">
            {new Date(date).toLocaleTimeString()}
          </div>
        </div>
      )
    }
  ];

  const bulkActions = [
    {
      label: 'Mark as Processing',
      icon: Clock,
      onClick: (orderIds: string[]) => handleBulkStatusChange(orderIds, 'processing')
    },
    {
      label: 'Mark as Shipped',
      icon: Truck,
      onClick: (orderIds: string[]) => handleBulkStatusChange(orderIds, 'shipped')
    },
    {
      label: 'Mark as Delivered',
      icon: CheckCircle2,
      onClick: (orderIds: string[]) => handleBulkStatusChange(orderIds, 'delivered')
    },
    {
      label: 'Cancel Orders',
      icon: Ban,
      onClick: (orderIds: string[]) => handleBulkStatusChange(orderIds, 'cancelled'),
      variant: 'destructive' as const
    }
  ];

  return (
    <div className="min-h-screen bg-[var(--color-creme)]">
      <PageHeader
        title="Orders"
        description="Manage customer orders"
        search={{
          value: searchTerm,
          onChange: setSearchTerm,
          placeholder: "Search orders..."
        }}
      >
        {selectedOrders.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Actions ({selectedOrders.length})
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {bulkActions.map((action, idx) => (
                <DropdownMenuItem
                  key={idx}
                  onClick={() => action.onClick(selectedOrders)}
                  className={action.variant === 'destructive' ? 'text-red-600' : ''}
                >
                  {action.icon && <action.icon className="mr-2 h-4 w-4" />}
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </PageHeader>

      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <DataTable
          data={orders}
          columns={columns}
          loading={loading}
          selectedItems={selectedOrders}
          onSelectionChange={setSelectedOrders}
          bulkActions={bulkActions}
          onRowClick={handleEditOrder}
          searchTerm={searchTerm}
          hideToolbar={true}
        />
      </div>
    </div>
  );
}
