import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Trash2, Building2, Plus, ChevronDown } from 'lucide-react';
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
import { DataTable } from '../components/shared/DataTable';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback';
import { PageHeader } from '../components/shared/PageHeader';

interface Brand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  product_count?: number;
}

export function BrandsPage() {
  const navigate = useNavigate();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('brands')
        .select(`
          *,
          products(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const brandsWithCount = data?.map(brand => ({
        ...brand,
        product_count: brand.products?.length || 0
      })) || [];

      setBrands(brandsWithCount);
    } catch (error) {
      console.error('Error fetching brands:', error);
      toast.error('Failed to load brands');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBrand = () => {
    navigate('/admin/brands/new');
  };

  const handleEditBrand = (brand: Brand) => {
    navigate(`/admin/brands/${brand.id}`);
  };

  const handleBulkDelete = async (brandIds: string[]) => {
    if (!confirm(`Delete ${brandIds.length} brands?`)) return;
    try {
      const { error } = await supabase
        .from('brands')
        .delete()
        .in('id', brandIds);

      if (error) throw error;
      toast.success(`${brandIds.length} brands deleted`);
      setSelectedBrands([]);
      fetchBrands();
    } catch (error) {
      toast.error('Failed to delete brands');
    }
  };

  const handleBulkStatusChange = async (brandIds: string[], isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('brands')
        .update({ is_active: isActive })
        .in('id', brandIds);

      if (error) throw error;
      toast.success(`${brandIds.length} brands ${isActive ? 'activated' : 'deactivated'}`);
      setSelectedBrands([]);
      fetchBrands();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const columns = [
    {
      key: 'logo_url',
      label: 'Logo',
      render: (_: any, brand: Brand) => (
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
          {brand.logo_url ? (
            <ImageWithFallback
              src={brand.logo_url}
              alt="Brand"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Building2 className="h-6 w-6 text-gray-400" />
            </div>
          )}
        </div>
      )
    },
    {
      key: 'name',
      label: 'Brand Name',
      sortable: true,
      render: (name: string, brand: Brand) => (
        <div>
          <div className="font-medium text-gray-900">{name}</div>
          <div className="text-sm text-gray-500">{brand.slug}</div>
        </div>
      )
    },
    {
      key: 'description',
      label: 'Description',
      render: (description: string | null) => (
        <div className="max-w-xs truncate text-sm text-gray-600">
          {description || 'No description'}
        </div>
      )
    },
    {
      key: 'product_count',
      label: 'Products',
      sortable: true,
      render: (count: number) => (
        <Badge variant="outline" className="bg-gray-50">
          {count} products
        </Badge>
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

  const bulkActions = [
    {
      label: 'Activate Selected',
      icon: Eye,
      onClick: (brandIds: string[]) => handleBulkStatusChange(brandIds, true)
    },
    {
      label: 'Deactivate Selected',
      icon: EyeOff,
      onClick: (brandIds: string[]) => handleBulkStatusChange(brandIds, false)
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
        title="Brands" 
        description="Manage your product brands"
        search={{
          value: searchTerm,
          onChange: setSearchTerm,
          placeholder: "Search brands..."
        }}
      >
        {selectedBrands.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Actions ({selectedBrands.length})
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {bulkActions.map((action, idx) => (
                <DropdownMenuItem
                  key={idx}
                  onClick={() => action.onClick(selectedBrands)}
                  className={action.variant === 'destructive' ? 'text-red-600' : ''}
                >
                  {action.icon && <action.icon className="mr-2 h-4 w-4" />}
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button onClick={handleAddBrand} className="bg-[var(--color-canyon)] hover:bg-[var(--color-canyon)]/90 text-[var(--color-creme)]">
          <Plus className="mr-2 h-4 w-4" />
          Add Brand
        </Button>
      </PageHeader>

      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <DataTable
          data={brands}
          columns={columns}
          loading={loading}
          selectedItems={selectedBrands}
          onSelectionChange={setSelectedBrands}
          bulkActions={bulkActions}
          onRowClick={handleEditBrand}
          searchTerm={searchTerm}
          hideToolbar={true}
        />
      </div>
    </div>
  );
}
