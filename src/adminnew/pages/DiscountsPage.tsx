import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Trash2, Percent, Tag, Calendar, Plus, ChevronDown } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';
import { formatINR } from '../../utils/currency';
import { DataTable } from '../components/shared/DataTable';
import { PageHeader } from '../components/shared/PageHeader';

// Database-aligned Discount interface
interface Discount {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  type: 'percentage' | 'fixed_amount' | 'cart_value';
  value: number;
  min_cart_value: number | null;
  max_discount_amount: number | null;
  applicable_to: 'all' | 'products' | 'combos' | 'variants';
  product_ids: string[] | null;
  combo_ids: string[] | null;
  variant_ids: string[] | null;
  start_date: string | null;
  end_date: string | null;
  usage_limit: number | null;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function DiscountsPage() {
  const navigate = useNavigate();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDiscounts, setSelectedDiscounts] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadDiscounts();
  }, []);

  const loadDiscounts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('discounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDiscounts(data || []);
    } catch (error) {
      console.error('Error loading discounts:', error);
      toast.error('Failed to load discounts');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDiscount = () => {
    navigate('/admin/discounts/new');
  };

  const handleEditDiscount = (discount: Discount) => {
    navigate(`/admin/discounts/${discount.id}`);
  };

  const handleBulkDelete = async (discountIds: string[]) => {
    if (!confirm(`Delete ${discountIds.length} discounts?`)) return;
    try {
      const { error } = await supabase
        .from('discounts')
        .delete()
        .in('id', discountIds);

      if (error) throw error;
      toast.success(`${discountIds.length} discounts deleted`);
      setSelectedDiscounts([]);
      loadDiscounts();
    } catch (error) {
      toast.error('Failed to delete discounts');
    }
  };

  const handleBulkStatusChange = async (discountIds: string[], isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('discounts')
        .update({ is_active: isActive })
        .in('id', discountIds);

      if (error) throw error;
      toast.success(`${discountIds.length} discounts ${isActive ? 'activated' : 'deactivated'}`);
      setSelectedDiscounts([]);
      loadDiscounts();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const formatDiscountValue = (discount: Discount) => {
    switch (discount.type) {
      case 'percentage':
        return `${discount.value}%`;
      case 'fixed_amount':
        return formatINR(discount.value);
      case 'cart_value':
        return `Cart value: ${formatINR(discount.value)}`;
      default:
        return formatINR(discount.value);
    }
  };

  const getStatusColor = (isActive: boolean, startDate?: string | null, endDate?: string | null) => {
    if (!isActive) return 'bg-gray-100 text-gray-800';
    
    const now = new Date();
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    
    if (start && start > now) return 'bg-yellow-100 text-yellow-800';
    if (end && end < now) return 'bg-red-100 text-red-800';
    return 'bg-green-100 text-green-800';
  };

  const getStatusText = (isActive: boolean, startDate?: string | null, endDate?: string | null) => {
    if (!isActive) return 'Inactive';
    
    const now = new Date();
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    
    if (start && start > now) return 'Scheduled';
    if (end && end < now) return 'Expired';
    return 'Active';
  };

  const columns = [
    {
      key: 'name',
      label: 'Discount Name',
      sortable: true,
      render: (name: string, discount: Discount) => (
        <div>
          <div className="font-medium text-gray-900">{name}</div>
          <div className="text-sm text-gray-500">{discount.description}</div>
          {discount.code && (
            <div className="text-xs text-gray-400 font-mono">{discount.code}</div>
          )}
        </div>
      )
    },
    {
      key: 'type',
      label: 'Type',
      render: (type: string, discount: Discount) => (
        <div>
          <Badge variant="outline" className="capitalize">
            {type.replace('_', ' ')}
          </Badge>
          <div className="text-sm font-medium text-gray-900 mt-1">
            {formatDiscountValue(discount)}
          </div>
        </div>
      )
    },
    {
      key: 'applicable_to',
      label: 'Applies To',
      render: (applicableTo: string) => (
        <Badge variant="outline" className="capitalize">
          {applicableTo}
        </Badge>
      )
    },
    {
      key: 'usage_count',
      label: 'Usage',
      sortable: true,
      render: (count: number, discount: Discount) => (
        <div className="text-sm">
          <div className="font-medium">{count}</div>
          {discount.usage_limit && (
            <div className="text-gray-500">of {discount.usage_limit}</div>
          )}
        </div>
      )
    },
    {
      key: 'dates',
      label: 'Duration',
      render: (_: any, discount: Discount) => (
        <div className="text-sm text-gray-600">
          {discount.start_date && (
            <div>From: {new Date(discount.start_date).toLocaleDateString()}</div>
          )}
          {discount.end_date && (
            <div>To: {new Date(discount.end_date).toLocaleDateString()}</div>
          )}
          {!discount.start_date && !discount.end_date && (
            <div className="text-gray-400">No limits</div>
          )}
        </div>
      )
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (_: any, discount: Discount) => (
        <Badge className={getStatusColor(discount.is_active, discount.start_date, discount.end_date)}>
          {getStatusText(discount.is_active, discount.start_date, discount.end_date)}
        </Badge>
      )
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (date: string) => new Date(date).toLocaleDateString()
    }
  ];

  const bulkActions = [
    {
      label: 'Activate Selected',
      icon: Eye,
      onClick: (discountIds: string[]) => handleBulkStatusChange(discountIds, true)
    },
    {
      label: 'Deactivate Selected',
      icon: EyeOff,
      onClick: (discountIds: string[]) => handleBulkStatusChange(discountIds, false)
    },
    {
      label: 'Delete Selected',
      icon: Trash2,
      onClick: handleBulkDelete,
      variant: 'destructive' as const
    }
  ];

  return (
    <div className="min-h-screen bg-[var(--color-creme)]">
      <PageHeader 
        title="Discounts" 
        description="Manage discount codes and promotions"
        search={{
          value: searchTerm,
          onChange: setSearchTerm,
          placeholder: "Search discounts..."
        }}
      >
        {selectedDiscounts.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Actions ({selectedDiscounts.length})
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {bulkActions.map((action, idx) => (
                <DropdownMenuItem
                  key={idx}
                  onClick={() => action.onClick(selectedDiscounts)}
                  className={action.variant === 'destructive' ? 'text-red-600' : ''}
                >
                  {action.icon && <action.icon className="mr-2 h-4 w-4" />}
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button onClick={handleAddDiscount} className="bg-[var(--color-canyon)] hover:bg-[var(--color-canyon)]/90 text-[var(--color-creme)]">
          <Plus className="mr-2 h-4 w-4" />
          Add Discount
        </Button>
      </PageHeader>

      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <DataTable
          data={discounts}
          columns={columns}
          loading={loading}
          selectedItems={selectedDiscounts}
          onSelectionChange={setSelectedDiscounts}
          bulkActions={bulkActions}
          onRowClick={handleEditDiscount}
          searchTerm={searchTerm}
          hideToolbar={true}
        />
      </div>
    </div>
  );
}
