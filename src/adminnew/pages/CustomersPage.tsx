import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Ban, CheckCircle, Mail, Phone, Calendar, DollarSign, Users, ChevronDown } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase/client';
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
  status: 'active' | 'inactive' | 'blocked';
  created_at: string;
  updated_at: string;
}

export function CustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

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

  const handleViewCustomer = (customer: Customer) => {
    navigate(`/admin/customers/${customer.id}`);
  };

  const handleStatusUpdate = async (customerIds: string[], status: 'active' | 'blocked') => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status })
        .in('id', customerIds);

      if (error) throw error;
      
      toast.success(`${customerIds.length} customers ${status === 'blocked' ? 'blocked' : 'activated'} successfully`);
      setSelectedCustomers([]);
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
            <div className="text-xs text-gray-400 flex items-center">
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

  const bulkActions = [
    {
      label: 'Activate Selected',
      icon: CheckCircle,
      onClick: (customerIds: string[]) => handleStatusUpdate(customerIds, 'active')
    },
    {
      label: 'Block Selected',
      icon: Ban,
      onClick: (customerIds: string[]) => handleStatusUpdate(customerIds, 'blocked'),
      variant: 'destructive' as const
    }
  ];

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
        {selectedCustomers.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Actions ({selectedCustomers.length})
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {bulkActions.map((action, idx) => (
                <DropdownMenuItem
                  key={idx}
                  onClick={() => action.onClick(selectedCustomers)}
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
