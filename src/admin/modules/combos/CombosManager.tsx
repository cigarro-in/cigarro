import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabase/client';
import { formatINR } from '../../../utils/currency';
import { DataTable } from '../../components/shared/DataTable';
import { StandardModal } from '../../components/shared/StandardModal';
import { ComboForm } from './ComboForm';

// Updated to use new combos + combo_items schema
interface Combo {
  id: string;
  name: string;
  slug: string;
  description?: string;
  combo_price: number;
  original_price?: number;
  discount_percentage?: number;
  image?: string;
  gallery_images?: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  combo_items?: Array<{
    id: string;
    variant_id: string;
    quantity: number;
    variant?: {
      id: string;
      variant_name: string;
      price: number;
      product?: {
        name: string;
        brand?: { name: string };
      };
    };
  }>;
}

export function CombosManager() {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComboModal, setShowComboModal] = useState(false);
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null);
  const [selectedCombos, setSelectedCombos] = useState<string[]>([]);

  useEffect(() => {
    fetchCombos();
  }, []);

  const fetchCombos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('combos')
        .select(`
          *,
          combo_items(
            id,
            variant_id,
            quantity,
            product_variants(
              id,
              variant_name,
              price,
              products(name, brand:brands(name))
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform the nested data
      const transformedData = (data || []).map(combo => ({
        ...combo,
        combo_items: combo.combo_items?.map((item: any) => ({
          ...item,
          variant: item.product_variants
        }))
      }));
      
      setCombos(transformedData);
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

  const handleEditCombo = (combo: Combo) => {
    setEditingCombo(combo);
    setShowComboModal(true);
  };

  const handleDeleteCombo = async (combo: Combo) => {
    if (!confirm(`Are you sure you want to delete combo "${combo.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('combos')
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

  const handleToggleStatus = async (combo: Combo) => {
    try {
      const { error } = await supabase
        .from('combos')
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

  const columns = [
    {
      key: 'name',
      label: 'Combo Name',
      sortable: true,
      render: (name: string, combo: Combo) => (
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
      label: 'Variants',
      render: (items: any[]) => (
        <div className="text-sm">
          {items?.length || 0} variant{(items?.length || 0) !== 1 ? 's' : ''}
        </div>
      )
    },
    {
      key: 'combo_price',
      label: 'Combo Price',
      sortable: true,
      render: (price: number, combo: Combo) => (
        <div>
          <div className="font-medium text-green-600">{formatINR(price)}</div>
          {combo.original_price && (
            <div className="text-xs text-gray-500 line-through">
              {formatINR(combo.original_price)}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'discount_percentage',
      label: 'Discount',
      sortable: true,
      render: (discount: number | undefined) => discount ? (
        <Badge variant="secondary" className="text-green-600">
          {discount.toFixed(1)}% OFF
        </Badge>
      ) : <span className="text-gray-400">-</span>
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
        onAdd={handleAddCombo}
        addButtonLabel="Add Combo"
        searchPlaceholder="Search combos..."
        filters={filters}
        loading={loading}
        selectedItems={selectedCombos}
        onSelectionChange={setSelectedCombos}
        onRowClick={handleEditCombo}
        onStatusToggle={handleToggleStatus}
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
