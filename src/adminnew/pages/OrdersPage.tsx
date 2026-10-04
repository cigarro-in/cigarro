import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { formatINR } from '../../utils/currency';
import { useInlineStatus, InlineStatus } from '../../components/common/InlineStatus';
import { DataTable } from '../components/shared/DataTable';
import { BulkActionsMenu } from '../components/shared/BulkActionsMenu';
import { PageHeader } from '../components/shared/PageHeader';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
import { paiseToRupees } from '../../lib/convex/money';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  product_name: string;
  variant_name?: string;
}

const mapStatusToDisplay = (paymentStatus: string, shippingStatus?: string): Order['status'] => {
  if (paymentStatus === 'paid' || paymentStatus === 'late_paid') {
    if (shippingStatus === 'processing' || shippingStatus === 'shipped' || shippingStatus === 'delivered' || shippingStatus === 'returned') return shippingStatus;
    return 'processing';
  }
  if (paymentStatus === 'pending') return 'pending';
  return paymentStatus as Order['status'];
};

interface Order {
  id: string;
  display_order_id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'returned' | 'cancelled' | 'expired' | 'refunded' | 'voided' | 'late_paid' | 'paid';
  payment_status: string;
  shipping_status?: string;
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
  const [searchParams] = useSearchParams();
  const org = useOrg();
  const convexOrders = useQuery(
    api.admin.listRecentOrders,
    org ? { orgId: org._id, limit: 100 } : 'skip',
  );
  const markPaid = useMutation(api.admin.markPaid);
  const voidOrder = useMutation(api.admin.voidOrder);

  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const { status: opStatus, setError: setOpError, setOk: setOpOk } = useInlineStatus();

  const loading = convexOrders === undefined;

  const orders: Order[] = useMemo(() => {
    if (!convexOrders) return [];
    return convexOrders.map((o: any): Order => ({
      id: o._id,
      display_order_id: o.displayOrderId,
      user_id: o.userId,
      status: mapStatusToDisplay(o.status, o.shippingStatus),
      payment_status: o.status,
      shipping_status: o.shippingStatus,
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

  const visibleOrders = useMemo(
    () => statusFilter === 'all' ? orders : orders.filter((order) =>
      statusFilter === 'paid' || statusFilter === 'late_paid'
        ? order.payment_status === statusFilter
        : order.status === statusFilter),
    [orders, statusFilter],
  );

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
      setOpOk(`${orderIds.length} orders marked paid`);
      setSelectedOrders([]);
    } catch (error: any) {
      setOpError(error?.data?.code || 'Failed to mark paid');
    }
  };

  const handleBulkVoid = async (orderIds: string[]) => {
    try {
      await Promise.all(
        orderIds.map((id) =>
          voidOrder({ orderId: id as any, reason: 'bulk void by admin' }),
        ),
      );
      setOpOk(`${orderIds.length} orders voided`);
      setSelectedOrders([]);
    } catch (error: any) {
      setOpError(error?.data?.code || 'Failed to void orders');
    }
  };

  const columns = [
    {
      key: 'display_order_id',
      label: 'Order ID',
      render: (displayId: string) => (
        <div className="font-mono text-sm font-medium text-foreground">
          #{displayId}
        </div>
      )
    },
    {
      key: 'shipping_name',
      label: 'Customer',
      render: (name: string, order: Order) => (
        <div>
          <div className="font-medium text-foreground">{name || 'Unknown'}</div>
          <div className="text-xs text-muted-foreground flex items-center">
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
            <div key={index} className="text-sm text-muted-foreground">
              {item.quantity}x {item.product_name}
              {item.variant_name && (
                <span className="text-muted-foreground"> ({item.variant_name})</span>
              )}
            </div>
          ))}
          {items?.length > 2 && (
            <div className="text-xs text-muted-foreground">
              +{items.length - 2} more items
            </div>
          )}
        </div>
      )
    },
    {
      key: 'total',
      label: 'Total',
      render: (total: number) => (
        <div className="font-medium text-foreground">
          {formatINR(total)}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (status: string) => (
        <Badge variant="secondary">
          {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown'}
        </Badge>
      )
    },
    {
      key: 'payment_status',
      label: 'Payment',
      render: (status: string) => (
        <Badge variant="secondary">
          {status.replace('_', ' ')}
        </Badge>
      )
    },
    {
      key: 'created_at',
      label: 'Date',
      render: (date: string) => (
        <div className="text-sm text-muted-foreground">
          {new Date(date).toLocaleDateString()}
          <div className="text-xs text-muted-foreground">
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
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Orders"
        description="Manage customer orders"
        search={{ value: searchTerm, onChange: setSearchTerm, placeholder: 'Search orders…' }}
      >
        <div className="flex max-w-full flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-40" aria-label="Filter orders by status"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {['pending', 'paid', 'late_paid', 'processing', 'shipped', 'delivered', 'returned', 'expired', 'cancelled', 'refunded', 'voided'].map((status) => <SelectItem key={status} value={status}>{status[0].toUpperCase() + status.slice(1).replace('_', ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
          <BulkActionsMenu selectedIds={selectedOrders} actions={bulkActions} />
        </div>
      </PageHeader>

      <div className="p-6 max-w-400 mx-auto space-y-6">
        <InlineStatus status={opStatus} />
        <DataTable
          data={visibleOrders}
          searchText={(order) => [order.display_order_id, order.shipping_name, order.shipping_phone, order.status, order.payment_status, ...(order.order_items ?? []).map((item) => `${item.product_name} ${item.variant_name ?? ''}`)].join(' ')}
          columns={columns}
          loading={loading}
          selectedItems={selectedOrders}
          onSelectionChange={setSelectedOrders}
          onRowClick={handleEditOrder}
          searchTerm={searchTerm}
        />
      </div>
    </div>
  );
}
