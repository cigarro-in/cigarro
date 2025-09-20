import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Layers, Package } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { toast } from 'sonner';
import { supabase } from '../../../utils/supabase/client';
import { formatINR } from '../../../utils/currency';
import { DataTable } from '../shared/DataTable';
import { StandardModal } from '../shared/StandardModal';
import { VariantForm } from './VariantForm';

interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  attributes: Record<string, string>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product?: {
    name: string;
    brand: string;
  };
}

export function VariantsManager() {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<string[]>([]);

  useEffect(() => {
    fetchVariants();
  }, []);

  const fetchVariants = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('product_variants')
        .select(`
          *,
          products(name, brand)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVariants(data || []);
    } catch (error) {
      console.error('Error fetching variants:', error);
      toast.error('Failed to fetch variants');
    } finally {
      setLoading(false);
    }
  };

  const handleAddVariant = () => {
    setEditingVariant(null);
    setShowVariantModal(true);
  };

  const handleEditVariant = (variant: ProductVariant) => {
    setEditingVariant(variant);
    setShowVariantModal(true);
  };

  const handleDeleteVariant = async (variant: ProductVariant) => {
    if (!confirm(`Are you sure you want to delete variant "${variant.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('product_variants')
        .delete()
        .eq('id', variant.id);

      if (error) throw error;
      
      toast.success('Variant deleted successfully');
      fetchVariants();
    } catch (error) {
      console.error('Error deleting variant:', error);
      toast.error('Failed to delete variant');
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Variant Name',
      sortable: true,
      render: (name: string, variant: ProductVariant) => (
        <div>
          <div className="font-medium text-gray-900">{name}</div>
          <div className="text-sm text-gray-500">
            {variant.product?.name} - {variant.product?.brand}
          </div>
        </div>
      )
    },
    {
      key: 'sku',
      label: 'SKU',
      render: (sku: string) => (
        <div className="font-mono text-sm">{sku}</div>
      )
    },
    {
      key: 'price',
      label: 'Price',
      sortable: true,
      render: (price: number) => (
        <div className="font-medium">{formatINR(price)}</div>
      )
    },
    {
      key: 'stock',
      label: 'Stock',
      sortable: true,
      render: (stock: number) => (
        <Badge variant={stock > 10 ? 'default' : stock > 0 ? 'secondary' : 'destructive'}>
          {stock} units
        </Badge>
      )
    },
    {
      key: 'attributes',
      label: 'Attributes',
      render: (attributes: Record<string, string>) => (
        <div className="space-y-1">
          {Object.entries(attributes || {}).slice(0, 2).map(([key, value]) => (
            <div key={key} className="text-xs">
              <span className="font-medium">{key}:</span> {value}
            </div>
          ))}
          {Object.keys(attributes || {}).length > 2 && (
            <div className="text-xs text-gray-500">
              +{Object.keys(attributes).length - 2} more
            </div>
          )}
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
      onClick: handleEditVariant
    },
    {
      label: 'Delete',
      icon: Trash2,
      onClick: handleDeleteVariant,
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
          <h1 className="text-2xl font-bold text-gray-900">Product Variants</h1>
          <p className="text-gray-600">Manage product variations and options</p>
        </div>
      </div>

      <DataTable
        title="Product Variants"
        data={variants}
        columns={columns}
        searchPlaceholder="Search variants..."
        loading={loading}
        selectedItems={selectedVariants}
        onSelectionChange={setSelectedVariants}
        onRowClick={handleEditVariant}
      />

      <StandardModal
        isOpen={showVariantModal}
        onClose={() => setShowVariantModal(false)}
        title={editingVariant ? 'Edit Variant' : 'Add New Variant'}
        size="lg"
      >
        <VariantForm
          variant={editingVariant}
          onSave={() => {
            setShowVariantModal(false);
            fetchVariants();
          }}
          onCancel={() => setShowVariantModal(false)}
        />
      </StandardModal>
    </div>
  );
}
