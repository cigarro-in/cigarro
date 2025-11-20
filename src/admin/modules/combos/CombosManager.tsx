import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Gift, Package } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabase/client';
import { formatINR } from '../../../utils/currency';
import { DataTable } from '../../components/shared/DataTable';
import { StandardModal } from '../../components/shared/StandardModal';
import { ComboForm } from './ComboForm';

interface ProductCombo {
  id: string;
  name: string;
  description: string;
  combo_price: number;
  original_price: number;
  discount_percentage: number;
  is_active: boolean;
  valid_from: string;
  valid_until: string;
  created_at: string;
  updated_at: string;
  combo_items?: Array<{
    product_id: string;
    quantity: number;
    product: {
      name: string;
      brand: string;
      price: number;
    };
  }>;
}

export function CombosManager() {
  const [combos, setCombos] = useState<ProductCombo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComboModal, setShowComboModal] = useState(false);
  const [editingCombo, setEditingCombo] = useState<ProductCombo | null>(null);
  const [selectedCombos, setSelectedCombos] = useState<string[]>([]);

  useEffect(() => {
    fetchCombos();
  }, []);

  const fetchCombos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('product_combos')
        .select(`
          *,
          combo_items(
            product_id,
            quantity,
            products(name, brand, price)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCombos(data || []);
    } catch (error) {
      console.error('Error fetching combos:', error);
      toast.error('Failed to fetch combos');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCombo = () => {
    setEditingCombo(null);
    setShowComboModal(true);
  };

  const handleEditCombo = (combo: ProductCombo) => {
    setEditingCombo(combo);
    setShowComboModal(true);
  };

  const handleDeleteCombo = async (combo: ProductCombo) => {
    if (!confirm(`Are you sure you want to delete combo "${combo.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('product_combos')
        .delete()
        .eq('id', combo.id);

      if (error) throw error;
      
      toast.success('Combo deleted successfully');
      fetchCombos();
    } catch (error) {
      console.error('Error deleting combo:', error);
      toast.error('Failed to delete combo');
    }
  };

  const handleToggleStatus = async (combo: ProductCombo) => {
    try {
      const { error } = await supabase
        .from('product_combos')
        .update({ is_active: !combo.is_active })
        .eq('id', combo.id);

      if (error) throw error;
      
      toast.success(`Combo ${combo.is_active ? 'deactivated' : 'activated'} successfully`);
      fetchCombos();
    } catch (error) {
      console.error('Error updating combo status:', error);
      toast.error('Failed to update combo status');
    }
  };

  const isComboValid = (combo: ProductCombo) => {
    const now = new Date();
    const validFrom = new Date(combo.valid_from);
    const validUntil = new Date(combo.valid_until);
    return now >= validFrom && now <= validUntil;
  };

  const columns = [
    {
      key: 'name',
      label: 'Combo Name',
      sortable: true,
      render: (name: string, combo: ProductCombo) => (
        <div>
          <div className="font-medium text-gray-900">{name}</div>
          <div className="text-sm text-gray-500 max-w-xs truncate">
            {combo.description}
          </div>
        </div>
      )
    },
    {
      key: 'combo_items',
      label: 'Products',
      render: (items: any[]) => (
        <div className="text-sm">
          {items?.length || 0} product{(items?.length || 0) !== 1 ? 's' : ''}
        </div>
      )
    },
    {
      key: 'combo_price',
      label: 'Combo Price',
      sortable: true,
      render: (price: number, combo: ProductCombo) => (
        <div>
          <div className="font-medium text-green-600">{formatINR(price)}</div>
          <div className="text-xs text-gray-500 line-through">
            {formatINR(combo.original_price)}
          </div>
        </div>
      )
    },
    {
      key: 'discount_percentage',
      label: 'Discount',
      sortable: true,
      render: (discount: number) => (
        <Badge variant="secondary" className="text-green-600">
          {discount.toFixed(1)}% OFF
        </Badge>
      )
    },
    {
      key: 'valid_until',
      label: 'Valid Until',
      sortable: true,
      render: (date: string, combo: ProductCombo) => (
        <div>
          <div className="text-sm">{new Date(date).toLocaleDateString()}</div>
          <Badge variant={isComboValid(combo) ? 'default' : 'destructive'} className="text-xs">
            {isComboValid(combo) ? 'Active' : 'Expired'}
          </Badge>
        </div>
      )
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (isActive: boolean) => (
        <Badge variant={isActive ? 'default' : 'secondary'}>
          {isActive ? 'Active' : 'Inactive'}
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

  const actions = [
    {
      label: 'Edit',
      icon: Edit,
      onClick: handleEditCombo
    },
    {
      label: 'Toggle Status',
      icon: Gift,
      onClick: handleToggleStatus
    },
    {
      label: 'Delete',
      icon: Trash2,
      onClick: handleDeleteCombo,
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
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Combos</h1>
          <p className="text-gray-600">Create and manage product bundles and combo offers</p>
        </div>
      </div>

      <DataTable
        title="Combo Management"
        data={combos}
        columns={columns}
        actions={actions}
        onAdd={handleAddCombo}
        addButtonLabel="Add Combo"
        searchPlaceholder="Search combos..."
        filters={filters}
        loading={loading}
        selectedItems={selectedCombos}
        onSelectionChange={setSelectedCombos}
      />

      <StandardModal
        isOpen={showComboModal}
        onClose={() => setShowComboModal(false)}
        title={editingCombo ? 'Edit Combo' : 'Add New Combo'}
        size="xl"
      >
        <ComboForm
          combo={editingCombo}
          onSave={() => {
            setShowComboModal(false);
            fetchCombos();
          }}
          onCancel={() => setShowComboModal(false)}
        />
      </StandardModal>
    </div>
  );
}
