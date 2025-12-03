import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Trash2, Package, Plus } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { supabase } from '../../lib/supabase/client';
import { formatINR } from '../../utils/currency';
import { toast } from 'sonner';
import { DataTable } from '../components/shared/DataTable';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback';
import { PageHeader } from '../components/shared/PageHeader';

interface Product {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  brand?: { id: string; name: string };
  product_variants?: Array<{
    id: string;
    variant_name: string;
    price: number;
    stock: number;
    is_default?: boolean;
    images?: string[];
  }>;
}

export function ProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*, brand:brands(id, name)')
        .order('created_at', { ascending: false });

      if (productsError) throw productsError;

      const productIds = productsData?.map(p => p.id) || [];
      let variantsMap: Record<string, any[]> = {};

      if (productIds.length > 0) {
        const { data: variantsData } = await supabase
          .from('product_variants')
          .select('*')
          .in('product_id', productIds);

        variantsData?.forEach(v => {
          if (!variantsMap[v.product_id]) variantsMap[v.product_id] = [];
          variantsMap[v.product_id].push(v);
        });
      }

      const mergedData = productsData?.map(p => ({
        ...p,
        product_variants: variantsMap[p.id] || []
      }));

      setProducts(mergedData || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = () => {
    navigate('/admin/products/new');
  };

  const handleEditProduct = (product: Product) => {
    navigate(`/admin/products/${product.id}`);
  };

  const handleBulkDelete = async (productIds: string[]) => {
    if (!confirm(`Delete ${productIds.length} products?`)) return;
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .in('id', productIds);

      if (error) throw error;
      toast.success(`${productIds.length} products deleted`);
      setSelectedProducts([]);
      fetchProducts();
    } catch (error) {
      toast.error('Failed to delete products');
    }
  };

  const handleBulkStatusChange = async (productIds: string[], isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: isActive })
        .in('id', productIds);

      if (error) throw error;
      toast.success(`${productIds.length} products ${isActive ? 'activated' : 'deactivated'}`);
      setSelectedProducts([]);
      fetchProducts();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const columns = [
    {
      key: 'image',
      label: 'Image',
      render: (_: any, product: Product) => {
        const defaultVariant = product.product_variants?.find(v => v.is_default);
        const images = defaultVariant?.images || product.product_variants?.[0]?.images || [];
        return (
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
            {images && images.length > 0 ? (
              <ImageWithFallback
                src={images[0]}
                alt="Product"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="h-6 w-6 text-gray-400" />
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'name',
      label: 'Product Name',
      sortable: true,
      render: (name: string, product: Product) => (
        <div>
          <div className="font-medium text-gray-900">{name}</div>
          <div className="text-sm text-gray-500">{product.brand?.name || ''}</div>
        </div>
      )
    },
    {
      key: 'variants_count',
      label: 'Variants',
      render: (_: any, product: Product) => (
        <Badge variant="outline" className="bg-gray-50">
          {product.product_variants?.length || 0}
        </Badge>
      )
    },
    {
      key: 'price',
      label: 'Price',
      render: (_: any, product: Product) => {
        const defaultVariant = product.product_variants?.find(v => v.is_default);
        if (defaultVariant) {
          return <div className="font-medium">{formatINR(defaultVariant.price)}</div>;
        }
        return product.product_variants && product.product_variants.length > 0 ? 
          <div className="font-medium">{formatINR(product.product_variants[0].price)}</div> :
          <div className="text-gray-400">-</div>;
      }
    },
    {
      key: 'stock',
      label: 'Stock',
      render: (_: any, product: Product) => {
        const defaultVariant = product.product_variants?.find(v => v.is_default);
        const stock = defaultVariant?.stock ?? product.product_variants?.[0]?.stock ?? 0;
        return (
          <Badge variant={stock > 10 ? 'default' : stock > 0 ? 'secondary' : 'destructive'}>
            {stock} units
          </Badge>
        );
      }
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
      onClick: (productIds: string[]) => handleBulkStatusChange(productIds, true)
    },
    {
      label: 'Deactivate Selected',
      icon: EyeOff,
      onClick: (productIds: string[]) => handleBulkStatusChange(productIds, false)
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
        title="Products" 
        description="Manage your product catalog"
        search={{
          value: searchTerm,
          onChange: setSearchTerm,
          placeholder: "Search products..."
        }}
      >
        <Button onClick={handleAddProduct} className="bg-[var(--color-canyon)] hover:bg-[var(--color-canyon)]/90 text-[var(--color-creme)]">
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </PageHeader>
      
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <DataTable
          data={products}
          columns={columns}
          loading={loading}
          selectedItems={selectedProducts}
          onSelectionChange={setSelectedProducts}
          bulkActions={bulkActions}
          onRowClick={handleEditProduct}
          searchTerm={searchTerm}
          hideToolbar={true}
        />
      </div>
    </div>
  );
}
