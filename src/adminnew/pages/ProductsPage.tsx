import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Trash2, Package, Plus, FileSpreadsheet } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { formatINR } from '../../utils/currency';
import { useInlineStatus, InlineStatus } from '../../components/common/InlineStatus';
import { DataTable } from '../components/shared/DataTable';
import { BulkActionsMenu } from '../components/shared/BulkActionsMenu';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback';
import { PageHeader } from '../components/shared/PageHeader';
import { ProductImportExport } from '../features/ProductImportExport';
import { useOrg } from '../../lib/convex/useOrg';
import { ORG_SLUG } from '../../lib/convex/org';

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
  const { status: opStatus, setError: setOpError, setOk: setOpOk } = useInlineStatus();

  // Convex is the catalog source of truth; the list is reactive so imports
  // and edits refresh it with no manual refetch.
  const rows = useQuery(api.adminCatalog.listProductsForAdmin, { orgSlug: ORG_SLUG });
  const inventoryRows = useQuery(api.inventory.list, org ? { orgId: org._id, orgSlug: ORG_SLUG } : 'skip');
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
        await deleteProduct({ supabaseId, orgSlug: ORG_SLUG });
      }
      setOpOk(`${productIds.length} products deleted`);
      setSelectedProducts([]);
    } catch (error: any) {
      setOpError(error?.data?.code === 'NOT_CATALOG_ADMIN' ? 'Admin access required' : 'Failed to delete products');
    }
  };

  const handleBulkStatusChange = async (productIds: string[], isActive: boolean) => {
    try {
      await setActive({ supabaseIds: productIds, isActive, orgSlug: ORG_SLUG });
      setOpOk(`${productIds.length} products ${isActive ? 'activated' : 'deactivated'}`);
      setSelectedProducts([]);
    } catch (error: any) {
      setOpError(error?.data?.code === 'NOT_CATALOG_ADMIN' ? 'Admin access required' : 'Failed to update status');
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
          <div className="size-10 overflow-hidden rounded-md bg-muted">
            {images && images.length > 0 ? (
              <ImageWithFallback
                src={images[0]}
                alt="Product"
                className="size-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="size-4 text-muted-foreground" />
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
          <div className="font-medium">{name}</div>
          {product.brand?.name && <div className="text-xs text-muted-foreground">{product.brand.name}</div>}
        </div>
      )
    },
    {
      key: 'variants_count',
      label: 'Variants',
      render: (_: any, product: Product) => (
        <Badge variant="secondary">
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
          <div className="text-muted-foreground">—</div>;
      }
    },
    {
      key: 'stock',
      label: 'Stock',
      render: (_: any, product: Product) => {
        const defaultVariant = product.product_variants?.find(v => v.is_default);
        const stock = defaultVariant?.stock ?? product.product_variants?.[0]?.stock ?? 0;
        return (
        <Badge variant={stock > 10 ? 'secondary' : stock > 0 ? 'outline' : 'destructive'}>
            {stock}
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
    <div className="min-h-screen bg-background">
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
        <Button onClick={handleAddProduct}>
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </PageHeader>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-3xl max-h-screen overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Products · Import / Export</DialogTitle>
          </DialogHeader>
          <ProductImportExport products={rows || []} />
        </DialogContent>
      </Dialog>
      
      <div className="mx-auto flex max-w-400 flex-col gap-4 px-4 py-4 sm:px-6">
        <InlineStatus status={opStatus} />
        <DataTable
          data={products}
          searchText={(product) => [product.name, product.slug, product.brand?.name, ...(product.product_variants ?? []).map((variant) => variant.variant_name)].join(' ')}
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
