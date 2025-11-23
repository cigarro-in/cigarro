import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff, Package, Star, DollarSign, Upload, Download } from 'lucide-react';
import { Switch } from '../../../components/ui/switch';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabase/client';
import { formatINR } from '../../../utils/currency';
import { DataTable } from '../../components/shared/DataTable';
import { StandardModal } from '../../components/shared/StandardModal';
import { ProductFormNew } from './ProductFormNew';
import { saveProduct } from '../productService';
import { ImageWithFallback } from '../../../components/ui/ImageWithFallback';
import { ProductImportExport } from '../ProductImportExport';
import { Product, ProductFormData } from '../../../types/product';

export function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productIsActive, setProductIsActive] = useState(true);
  const [showImportExport, setShowImportExport] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch Products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*, collections(id)')
        .order('created_at', { ascending: false });

      if (productsError) throw productsError;

      // 2. Fetch Variants manually (to ensure no join issues)
      const productIds = productsData?.map(p => p.id) || [];
      let variantsMap: Record<string, any[]> = {};

      if (productIds.length > 0) {
        const { data: variantsData, error: variantsError } = await supabase
          .from('product_variants')
          .select('*')
          .in('product_id', productIds);
        
        if (variantsError) {
          console.error("Error fetching variants manually:", variantsError);
        } else {
          // Group by product_id
          variantsData?.forEach(v => {
            if (!variantsMap[v.product_id]) variantsMap[v.product_id] = [];
            variantsMap[v.product_id].push(v);
          });
        }
      }

      // 3. Merge Data
      const mergedData = productsData?.map(p => ({
        ...p,
        product_variants: variantsMap[p.id] || []
      }));
      
      setProducts(mergedData || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setProductIsActive(true);
    setShowProductModal(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductIsActive(product.is_active);
    setShowProductModal(true);
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!confirm(`Are you sure you want to delete "${product.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      if (error) throw error;
      
      toast.success('Product deleted successfully');
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };

  const handleToggleStatus = async (product: Product) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: !product.is_active })
        .eq('id', product.id);

      if (error) throw error;
      
      toast.success(`Product ${product.is_active ? 'deactivated' : 'activated'} successfully`);
      fetchProducts();
    } catch (error) {
      console.error('Error updating product status:', error);
      toast.error('Failed to update product status');
    }
  };

  const handleBulkDelete = async (productIds: string[]) => {
    if (!confirm(`Are you sure you want to delete ${productIds.length} products?`)) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .in('id', productIds);

      if (error) throw error;
      
      toast.success(`${productIds.length} products deleted successfully`);
      setSelectedProducts([]);
      fetchProducts();
    } catch (error) {
      console.error('Error deleting products:', error);
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
      
      toast.success(`${productIds.length} products ${isActive ? 'activated' : 'deactivated'} successfully`);
      setSelectedProducts([]);
      fetchProducts();
    } catch (error) {
      console.error('Error updating product status:', error);
      toast.error('Failed to update product status');
    }
  };

  const columns = [
    {
      key: 'gallery_images',
      label: 'Image',
      render: (images: string[]) => (
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
      )
    },
    {
      key: 'name',
      label: 'Product Name',
      sortable: true,
      render: (name: string, product: Product) => (
        <div>
          <div className="font-medium text-gray-900">{name}</div>
          <div className="text-sm text-gray-500">{product.brand}</div>
        </div>
      )
    },
    {
      key: 'product_variants',
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
      key: 'rating',
      label: 'Rating',
      render: (rating: number, product: Product) => (
        <div className="flex items-center space-x-1">
          <Star className="h-4 w-4 text-yellow-400 fill-current" />
          <span className="text-sm font-medium">{rating.toFixed(1)}</span>
          <span className="text-xs text-gray-500">({product.review_count})</span>
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
      key: 'brand',
      label: 'Brand',
      options: [...new Set(products.map(p => p.brand).filter(brand => brand && brand.trim()))]
        .map(brand => ({
          value: brand,
          label: brand
        }))
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark">Products</h1>
          <p className="text-dark/70">Manage your product catalog</p>
        </div>
        <Button
          onClick={() => setShowImportExport(true)}
          variant="outline"
          className="flex items-center gap-2"
        >
          <Upload className="h-4 w-4" />
          <Download className="h-4 w-4" />
          Import/Export
        </Button>
      </div>

      <DataTable
        title="Product Catalog"
        data={products}
        columns={columns}
        onAdd={handleAddProduct}
        addButtonLabel="Add Product"
        searchPlaceholder="Search products..."
        filters={filters}
        loading={loading}
        selectedItems={selectedProducts}
        onSelectionChange={setSelectedProducts}
        bulkActions={bulkActions}
        onRowClick={handleEditProduct}
      />

      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm overflow-y-auto">
          <div className="min-h-full w-full bg-background">
            <ProductFormNew
              initialData={editingProduct || undefined}
              onSave={async (data: ProductFormData) => {
                await saveProduct(data, editingProduct?.id);
                setShowProductModal(false);
                fetchProducts();
              }}
              onCancel={() => setShowProductModal(false)}
              onDelete={editingProduct ? async () => {
                try {
                  const { error } = await supabase
                    .from('products')
                    .delete()
                    .eq('id', editingProduct.id);

                  if (error) throw error;
                  
                  toast.success('Product deleted successfully');
                  setShowProductModal(false);
                  fetchProducts();
                } catch (error) {
                  console.error('Error deleting product:', error);
                  toast.error('Failed to delete product');
                }
              } : undefined}
            />
          </div>
        </div>
      )}

      <ProductImportExport
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
        onImportComplete={() => {
          fetchProducts();
          toast.success('Products refreshed after import');
        }}
      />
    </div>
  );
}
