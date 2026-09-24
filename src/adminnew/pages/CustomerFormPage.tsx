import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, User, Mail, Calendar, ShoppingBag, Clock } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { AdminCard, AdminCardContent, AdminCardHeader, AdminCardTitle } from '../components/shared/AdminCard';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { formatINR } from '../../utils/currency';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
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
  const org = useOrg();

  // Route id is the stable userId (Supabase auth UUID, unchanged by migration).
  const data = useQuery(
    api.adminStats.getCustomerForAdmin,
    org && id ? { orgId: org._id, userId: id } : 'skip'
  );

  // Boundary: Convex ms dates → ISO strings the page already renders.
  const toISO = (ms?: number | null) => (ms ? new Date(ms).toISOString() : undefined);
  const loading = data === undefined;
  const customer: Customer | null = data
    ? {
        id: data.id,
        name: data.name,
        email: data.phone || '',
        phone: data.phone || undefined,
        is_admin: data.is_admin,
        orderCount: data.orderCount,
        totalSpent: data.totalSpent,
        averageOrderValue: data.averageOrderValue,
        lastOrderDate: toISO(data.lastOrderDate),
        firstOrderDate: toISO(data.firstOrderDate),
        created_at: new Date(data.created_at).toISOString(),
        updated_at: new Date(data.updated_at).toISOString()
      }
    : null;
  const orders: CustomerOrder[] = (data?.orders || []).map((o: any) => ({
    id: String(o.id),
    display_order_id: o.display_order_id,
    total: o.total,
    status: o.status,
    created_at: new Date(o.created_at).toISOString(),
    items_count: o.items_count
  }));

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
    <div className="min-h-screen bg-[var(--color-creme)] pb-20">
      {/* Header */}
      <PageHeader
        title={customer.name}
        description={`Customer since ${new Date(customer.created_at).toLocaleDateString()}`}
        backUrl="/admin/customers"
      >
        {customer.is_admin && (
          <Badge variant="outline">Admin</Badge>
        )}
      </PageHeader>

      <div className="max-w-[1600px] mx-auto px-6 grid grid-cols-[1fr_350px] gap-6">
        
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
                    Contact
                  </div>
                  <div className="font-medium">{customer.phone || customer.email || '—'}</div>
                </div>
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
