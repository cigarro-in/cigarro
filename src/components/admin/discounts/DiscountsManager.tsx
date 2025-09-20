import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Percent, Calendar, DollarSign } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { toast } from 'sonner';
import { supabase } from '../../../utils/supabase/client';
import { formatINR } from '../../../utils/currency';
import { DataTable } from '../shared/DataTable';
import { StandardModal } from '../shared/StandardModal';
import { DiscountForm } from './DiscountForm';

interface Discount {
  id: string;
  code: string;
  name: string;
  description: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  minimum_cart_value: number;
  maximum_discount_amount: number;
  usage_limit: number;
  used_count: number;
  is_active: boolean;
  valid_from: string;
  valid_until: string;
  created_at: string;
  updated_at: string;
}

export function DiscountsManager() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [selectedDiscounts, setSelectedDiscounts] = useState<string[]>([]);

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const fetchDiscounts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('discounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDiscounts(data || []);
    } catch (error) {
      console.error('Error fetching discounts:', error);
      toast.error('Failed to fetch discounts');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDiscount = () => {
    setEditingDiscount(null);
    setShowDiscountModal(true);
  };

  const handleEditDiscount = (discount: Discount) => {
    setEditingDiscount(discount);
    setShowDiscountModal(true);
  };

  const handleDeleteDiscount = async (discount: Discount) => {
    if (!confirm(`Are you sure you want to delete discount "${discount.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('discounts')
        .delete()
        .eq('id', discount.id);

      if (error) throw error;
      
      toast.success('Discount deleted successfully');
      fetchDiscounts();
    } catch (error) {
      console.error('Error deleting discount:', error);
      toast.error('Failed to delete discount');
    }
  };

  const handleToggleStatus = async (discount: Discount) => {
    try {
      const { error } = await supabase
        .from('discounts')
        .update({ is_active: !discount.is_active })
        .eq('id', discount.id);

      if (error) throw error;
      
      toast.success(`Discount ${discount.is_active ? 'deactivated' : 'activated'} successfully`);
      fetchDiscounts();
    } catch (error) {
      console.error('Error updating discount status:', error);
      toast.error('Failed to update discount status');
    }
  };

  const isDiscountValid = (discount: Discount) => {
    const now = new Date();
    const validFrom = new Date(discount.valid_from);
    const validUntil = new Date(discount.valid_until);
    return now >= validFrom && now <= validUntil;
  };

  const isDiscountUsageLimitReached = (discount: Discount) => {
    return discount.usage_limit > 0 && discount.used_count >= discount.usage_limit;
  };

  const getDiscountStatus = (discount: Discount) => {
    if (!discount.is_active) return { label: 'Inactive', variant: 'secondary' as const };
    if (!isDiscountValid(discount)) return { label: 'Expired', variant: 'destructive' as const };
    if (isDiscountUsageLimitReached(discount)) return { label: 'Limit Reached', variant: 'destructive' as const };
    return { label: 'Active', variant: 'default' as const };
  };

  const columns = [
    {
      key: 'code',
      label: 'Discount Code',
      sortable: true,
      render: (code: string, discount: Discount) => (
        <div>
          <div className="font-mono font-medium text-gray-900">{code}</div>
          <div className="text-sm text-gray-500">{discount.name}</div>
        </div>
      )
    },
    {
      key: 'discount_type',
      label: 'Type & Value',
      render: (type: string, discount: Discount) => (
        <div className="flex items-center space-x-2">
          <Badge variant="outline">
            {type === 'percentage' 
              ? `${discount.discount_value}%` 
              : formatINR(discount.discount_value)
            }
          </Badge>
          <span className="text-xs text-gray-500">
            {type === 'percentage' ? 'Percentage' : 'Fixed Amount'}
          </span>
        </div>
      )
    },
    {
      key: 'minimum_cart_value',
      label: 'Min. Cart Value',
      sortable: true,
      render: (value: number) => (
        <div className="text-sm">
          {value > 0 ? formatINR(value) : 'No minimum'}
        </div>
      )
    },
    {
      key: 'usage_limit',
      label: 'Usage',
      render: (limit: number, discount: Discount) => (
        <div className="text-sm">
          <div>{discount.used_count} / {limit > 0 ? limit : '∞'}</div>
          <div className="text-xs text-gray-500">used</div>
        </div>
      )
    },
    {
      key: 'valid_until',
      label: 'Valid Until',
      sortable: true,
      render: (date: string) => (
        <div className="text-sm">{new Date(date).toLocaleDateString()}</div>
      )
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (_: any, discount: Discount) => {
        const status = getDiscountStatus(discount);
        return <Badge variant={status.variant}>{status.label}</Badge>;
      }
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (date: string) => new Date(date).toLocaleDateString()
    }
  ];

  const actions = [
    {
      label: 'Edit',
      icon: Edit,
      onClick: handleEditDiscount
    },
    {
      label: 'Toggle Status',
      icon: Percent,
      onClick: handleToggleStatus
    },
    {
      label: 'Delete',
      icon: Trash2,
      onClick: handleDeleteDiscount,
      variant: 'destructive' as const
    }
  ];

  const filters = [
    {
      key: 'is_active',
      label: 'Status',
      options: [
        { value: 'true', label: 'Active' },
        { value: 'false', label: 'Inactive' }
      ]
    },
    {
      key: 'discount_type',
      label: 'Type',
      options: [
        { value: 'percentage', label: 'Percentage' },
        { value: 'fixed', label: 'Fixed Amount' }
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Discount Codes</h1>
          <p className="text-gray-600">Create and manage discount codes and promotions</p>
        </div>
      </div>

      <DataTable
        title="Discount Management"
        data={discounts}
        columns={columns}
        actions={actions}
        onAdd={handleAddDiscount}
        addButtonLabel="Add Discount"
        searchPlaceholder="Search discounts..."
        filters={filters}
        loading={loading}
        selectedItems={selectedDiscounts}
        onSelectionChange={setSelectedDiscounts}
      />

      <StandardModal
        isOpen={showDiscountModal}
        onClose={() => setShowDiscountModal(false)}
        title={editingDiscount ? 'Edit Discount' : 'Add New Discount'}
        size="lg"
      >
        <DiscountForm
          discount={editingDiscount}
          onSave={() => {
            setShowDiscountModal(false);
            fetchDiscounts();
          }}
          onCancel={() => setShowDiscountModal(false)}
        />
      </StandardModal>
    </div>
  );
}
