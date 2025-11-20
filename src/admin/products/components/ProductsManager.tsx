import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff, Package, Star, DollarSign } from 'lucide-react';
import { Switch } from '../../../components/ui/switch';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabase/client';
import { formatINR } from '../../../utils/currency';
import { DataTable } from '../../components/shared/DataTable';
import { StandardModal } from '../../components/shared/StandardModal';
import { ProductForm } from './ProductForm';
import { ImageWithFallback } from '../../../components/ui/ImageWithFallback';

interface Product {
  id: string;
  name: string;
  slug: string;
  brand: string;
  price: number;
  description: string;
  stock: number;
  is_active: boolean;
  rating: number;
  review_count: number;
  origin: string;
  strength: string;
  pack_size: string;
  specifications: Record<string, string>;
  ingredients: string[];
  gallery_images: string[];
  meta_title: string;
  meta_description: string;
  image_alt_text: string;
  created_at: string;
  updated_at: string;
}

export function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productIsActive, setProductIsActive] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
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

      <ProductForm
        product={editingProduct}
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        onSave={() => {
          setShowProductModal(false);
          fetchProducts();
        }}
      />
    </div>
  );
}
