import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
import { formatINR } from '../../utils/currency';
import { DataTable } from '../components/shared/DataTable';
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

export function CustomersPage() {
  const navigate = useNavigate();
  const org = useOrg();
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const rows = useQuery(
    api.adminStats.listCustomersForAdmin,
    org ? { orgId: org._id } : 'skip'
  );

  // Boundary: Convex ms dates → ISO strings the table already renders.
  const toISO = (ms?: number | null) => (ms ? new Date(ms).toISOString() : undefined);
  const customers: Customer[] = (rows || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    email: c.phone || '',
    phone: c.phone || undefined,
    is_admin: c.is_admin,
    orderCount: c.orderCount,
    totalSpent: c.totalSpent,
    averageOrderValue: c.averageOrderValue,
    lastOrderDate: toISO(c.lastOrderDate),
    firstOrderDate: toISO(c.firstOrderDate),
    created_at: new Date(c.created_at).toISOString(),
    updated_at: new Date(c.updated_at).toISOString()
  }));
  const loading = rows === undefined;

  const handleViewCustomer = (customer: Customer) => {
    navigate(`/admin/customers/${customer.id}`);
  };

  const columns = [
    {
      key: 'name',
      label: 'Customer',
      sortable: true,
      render: (name: string, customer: Customer) => (
        <div>
          <div className="font-medium text-gray-900">{name}</div>
          {customer.phone && (
            <div className="text-sm text-gray-500 flex items-center">
              <Phone className="w-3 h-3 mr-1" />
              {customer.phone}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'orderCount',
      label: 'Orders',
      sortable: true,
      render: (count: number) => (
        <div className="text-center">
          <div className="font-medium">{count}</div>
          <div className="text-xs text-gray-500">orders</div>
        </div>
      )
    },
    {
      key: 'totalSpent',
      label: 'Total Spent',
      sortable: true,
      render: (amount: number) => (
        <div className="font-medium">{formatINR(amount)}</div>
      )
    },
    {
      key: 'averageOrderValue',
      label: 'Avg. Order',
      sortable: true,
      render: (amount: number) => (
        <div className="text-sm">{formatINR(amount)}</div>
      )
    },
    {
      key: 'lastOrderDate',
      label: 'Last Order',
      sortable: true,
      render: (date?: string) => (
        <div className="text-sm">
          {date ? new Date(date).toLocaleDateString() : 'Never'}
        </div>
      )
    },
    {
      key: 'is_admin',
      label: 'Role',
      render: (_: any, customer: Customer) => (
        <div className="space-y-1">
          {customer.is_admin ? (
            <Badge variant="outline" className="text-xs">
              Admin
            </Badge>
          ) : (
            <span className="text-sm text-gray-500">Customer</span>
          )}
        </div>
      )
    },
    {
      key: 'created_at',
      label: 'Joined',
      sortable: true,
      render: (date: string) => (
        <div className="text-sm">{new Date(date).toLocaleDateString()}</div>
      )
    }
  ];

  // No bulk status actions: profiles never had a status column, so the old
  // block/activate toggle always failed. Selection stays for future actions.
  const bulkActions: { label: string; onClick: (ids: string[]) => void }[] = [];

  return (
    <div className="min-h-screen bg-[var(--color-creme)]">
      <PageHeader 
        title="Customers" 
        description="Manage customer accounts"
        search={{
          value: searchTerm,
          onChange: setSearchTerm,
          placeholder: "Search customers..."
        }}
      >
      </PageHeader>

      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <DataTable
          data={customers}
          columns={columns}
          loading={loading}
          selectedItems={selectedCustomers}
          onSelectionChange={setSelectedCustomers}
          bulkActions={bulkActions}
          onRowClick={handleViewCustomer}
          searchTerm={searchTerm}
          hideToolbar={true}
        />
      </div>
    </div>
  );
}
