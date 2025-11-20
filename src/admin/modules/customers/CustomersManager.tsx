import { useState, useEffect } from 'react';
import { Users, Eye, Ban, CheckCircle, Mail, Phone, Calendar, DollarSign } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabase/client';
import { formatINR } from '../../../utils/currency';
import { DataTable } from '../../components/shared/DataTable';
import { StandardModal } from '../../components/shared/StandardModal';
import { CustomerDetails } from './CustomerDetails';

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

export function CustomersManager() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCustomerDetails, setShowCustomerDetails] = useState<string | null>(null);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      
      // Fetch customer profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch order statistics for each customer
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('user_id, total, created_at');

      if (ordersError) throw ordersError;

      // Calculate customer statistics
      const customersWithStats = profilesData?.map(profile => {
        const customerOrders = ordersData?.filter(order => order.user_id === profile.id) || [];
        const orderCount = customerOrders.length;
        const totalSpent = customerOrders.reduce((sum, order) => sum + (order.total || 0), 0);
        const averageOrderValue = orderCount > 0 ? totalSpent / orderCount : 0;
        
        const orderDates = customerOrders.map(order => new Date(order.created_at));
        const lastOrderDate = orderDates.length > 0 ? new Date(Math.max(...orderDates.map(d => d.getTime()))).toISOString() : undefined;
        const firstOrderDate = orderDates.length > 0 ? new Date(Math.min(...orderDates.map(d => d.getTime()))).toISOString() : undefined;

        return {
          id: profile.id,
          name: profile.name || 'Unknown',
          email: profile.email || '',
          phone: profile.phone,
          is_admin: profile.is_admin || false,
          orderCount,
          totalSpent,
          averageOrderValue,
          lastOrderDate,
          firstOrderDate,
          status: profile.status || 'active',
          created_at: profile.created_at,
          updated_at: profile.updated_at
        };
      }) || [];

      setCustomers(customersWithStats);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (customerId: string, status: 'active' | 'blocked') => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status })
        .eq('id', customerId);

      if (error) throw error;
      
      toast.success(`Customer ${status === 'blocked' ? 'blocked' : 'activated'} successfully`);
      fetchCustomers();
    } catch (error) {
      console.error('Error updating customer status:', error);
      toast.error('Failed to update customer status');
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

  const columns = [
    {
      key: 'name',
      label: 'Customer',
      sortable: true,
      render: (name: string, customer: Customer) => (
        <div>
          <div className="font-medium text-gray-900">{name}</div>
          <div className="text-sm text-gray-500">{customer.email}</div>
          {customer.phone && (
            <div className="text-xs text-gray-400">{customer.phone}</div>
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
      key: 'status',
      label: 'Status',
      render: (status: string, customer: Customer) => (
        <div className="space-y-1">
          <Badge variant={getStatusBadgeVariant(status)}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
          {customer.is_admin && (
            <Badge variant="outline" className="text-xs">
              Admin
            </Badge>
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


  const filters = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
        { value: 'blocked', label: 'Blocked' }
      ]
    },
    {
      key: 'is_admin',
      label: 'Type',
      options: [
        { value: 'true', label: 'Admin' },
        { value: 'false', label: 'Customer' }
      ]
    }
  ];

  const selectedCustomer = customers.find(customer => customer.id === showCustomerDetails);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark">Customers</h1>
          <p className="text-dark/70">Manage customer accounts and relationships</p>
        </div>
      </div>

      <DataTable
        title="Customer Management"
        data={customers}
        columns={columns}
        searchPlaceholder="Search customers..."
        filters={filters}
        loading={loading}
        selectedItems={selectedCustomers}
        onSelectionChange={setSelectedCustomers}
        onRowClick={(customer) => setShowCustomerDetails(customer.id)}
      />

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <StandardModal
          isOpen={!!showCustomerDetails}
          onClose={() => setShowCustomerDetails(null)}
          title={`Customer: ${selectedCustomer.name}`}
          size="lg"
        >
          <CustomerDetails 
            customer={selectedCustomer}
            onClose={() => setShowCustomerDetails(null)}
          />
        </StandardModal>
      )}
    </div>
  );
}
