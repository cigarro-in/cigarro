import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, ChevronDown } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { formatINR } from '../../utils/currency';
import { toast } from 'sonner';
import { DataTable } from '../components/shared/DataTable';
import { PageHeader } from '../components/shared/PageHeader';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
import { paiseToRupees } from '../../lib/convex/money';

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  product_name: string;
  variant_name?: string;
}

const mapStatusToDisplay = (s: string): Order['status'] => {
  if (s === 'paid' || s === 'late_paid') return 'processing';
  if (s === 'pending') return 'pending';
  return 'cancelled';
};

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
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
}

export function OrdersPage() {
  const navigate = useNavigate();
  const org = useOrg();
  const convexOrders = useQuery(
    api.admin.listRecentOrders,
    org ? { orgId: org._id, limit: 100 } : 'skip',
  );
  const markPaid = useMutation(api.admin.markPaid);
  const voidOrder = useMutation(api.admin.voidOrder);

  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const loading = convexOrders === undefined;

  const orders: Order[] = useMemo(() => {
    if (!convexOrders) return [];
    return convexOrders.map((o: any): Order => ({
      id: o._id,
      display_order_id: o.displayOrderId,
      user_id: o.userId,
      status: mapStatusToDisplay(o.status),
      payment_verified: o.status === 'paid' || o.status === 'late_paid' ? 'YES' : 'NO',
      payment_method: 'upi',
      subtotal: paiseToRupees(o.cartTotalPaise),
      shipping: 0,
      discount: paiseToRupees(o.walletDebitPaise),
      total: paiseToRupees(o.finalAmountPaise),
      shipping_name: o.address?.name || '',
      shipping_address: o.address?.line1 || '',
      shipping_city: o.address?.city || '',
      shipping_state: o.address?.state || '',
      shipping_zip_code: o.address?.pincode || '',
      shipping_phone: o.address?.phone || '',
      created_at: new Date(o._creationTime).toISOString(),
      updated_at: new Date(o._creationTime).toISOString(),
      order_items: (o.items || []).map((it: any, idx: number) => ({
        id: `${o._id}-${idx}`,
        product_id: it.productId,
        quantity: it.qty,
        price: paiseToRupees(it.unitPricePaise),
        product_name: it.name,
        variant_name: it.variantId,
      })),
    }));
  }, [convexOrders]);

  const handleEditOrder = (order: Order) => {
    navigate(`/admin/orders/${order.id}`);
  };

  const handleBulkMarkPaid = async (orderIds: string[]) => {
    try {
      await Promise.all(
        orderIds.map((id) =>
          markPaid({
            orderId: id as any,
            reference: `admin:bulk:${new Date().toISOString()}`,
          }),
        ),
      );
      toast.success(`${orderIds.length} orders marked paid`);
      setSelectedOrders([]);
    } catch (error: any) {
      toast.error(error?.data?.code || 'Failed to mark paid');
    }
  };

  const handleBulkVoid = async (orderIds: string[]) => {
    try {
      await Promise.all(
        orderIds.map((id) =>
          voidOrder({ orderId: id as any, reason: 'bulk void by admin' }),
        ),
      );
      toast.success(`${orderIds.length} orders voided`);
      setSelectedOrders([]);
    } catch (error: any) {
      toast.error(error?.data?.code || 'Failed to void orders');
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
          <div className="font-medium text-gray-900">{name || 'Unknown'}</div>
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
      label: 'Mark Paid',
      onClick: (orderIds: string[]) => handleBulkMarkPaid(orderIds),
    },
    {
      label: 'Void Orders',
      onClick: (orderIds: string[]) => handleBulkVoid(orderIds),
      variant: 'destructive' as const,
    },
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
