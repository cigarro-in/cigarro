import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Trash2, Package, Plus, FileSpreadsheet } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { formatINR } from '../../utils/currency';
import { toast } from 'sonner';
import { DataTable } from '../components/shared/DataTable';
import { BulkActionsMenu } from '../components/shared/BulkActionsMenu';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback';
import { PageHeader } from '../components/shared/PageHeader';
import { ProductImportExport } from '../features/ProductImportExport';
import { useOrg } from '../../lib/convex/useOrg';

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
  const org = useOrg();
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  // Convex is the catalog source of truth; the list is reactive so imports
  // and edits refresh it with no manual refetch.
  const rows = useQuery(api.adminCatalog.listProductsForAdmin, {});
  const inventoryRows = useQuery(api.inventory.list, org ? { orgId: org._id } : 'skip');
  const inventoryByVariant = new Map((inventoryRows || []).map((row: any) => [row.variantSupabaseId, row]));
  const deleteProduct = useMutation(api.adminCatalog.deleteProduct);
  const setActive = useMutation(api.adminCatalog.setProductsActive);

  // Boundary normalization: Convex (camelCase, priceRupees) → table shape.
  const products: Product[] = (rows || []).map((p: any) => ({
    id: p.supabaseId,
    name: p.name,
    slug: p.slug,
    is_active: p.isActive,
    created_at: p.createdAt ? new Date(p.createdAt).toISOString() : '',
    brand: p.brand ? { id: p.brand.supabaseId, name: p.brand.name } : undefined,
    product_variants: (p.product_variants || []).map((v: any) => ({
      id: v.supabaseId,
      variant_name: v.variantName,
      price: v.priceRupees,
      stock: inventoryByVariant.get(v.supabaseId)?.available ?? v.stock ?? 0,
      is_default: v.isDefault,
      images: v.images || [],
    })),
  }));
  const loading = rows === undefined;

  const handleAddProduct = () => {
    navigate('/admin/products/new');
  };

  const handleEditProduct = (product: Product) => {
    navigate(`/admin/products/${product.id}`);
  };

  const handleBulkDelete = async (productIds: string[]) => {
    if (!confirm(`Delete ${productIds.length} products?`)) return;
    try {
      for (const supabaseId of productIds) {
        await deleteProduct({ supabaseId });
      }
      toast.success(`${productIds.length} products deleted`);
      setSelectedProducts([]);
    } catch (error: any) {
      toast.error(error?.data?.code === 'NOT_CATALOG_ADMIN' ? 'Admin access required' : 'Failed to delete products');
    }
  };

  const handleBulkStatusChange = async (productIds: string[], isActive: boolean) => {
    try {
      await setActive({ supabaseIds: productIds, isActive });
      toast.success(`${productIds.length} products ${isActive ? 'activated' : 'deactivated'}`);
      setSelectedProducts([]);
    } catch (error: any) {
      toast.error(error?.data?.code === 'NOT_CATALOG_ADMIN' ? 'Admin access required' : 'Failed to update status');
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
        <BulkActionsMenu selectedIds={selectedProducts} actions={bulkActions} />
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Import / Export
        </Button>
        <Button onClick={handleAddProduct} className="bg-[var(--color-canyon)] hover:bg-[var(--color-canyon)]/90 text-[var(--color-creme)]">
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </PageHeader>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Products · Import / Export</DialogTitle>
          </DialogHeader>
          <ProductImportExport products={rows || []} />
        </DialogContent>
      </Dialog>
      
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <DataTable
          data={products}
          columns={columns}
          loading={loading}
          selectedItems={selectedProducts}
          onSelectionChange={setSelectedProducts}
          onRowClick={handleEditProduct}
          searchTerm={searchTerm}
        />
      </div>
    </div>
  );
}
