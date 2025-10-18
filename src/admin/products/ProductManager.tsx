// ============================================================================
// PRODUCT MANAGER - Shopify-style with Cigarro Theme
// Clean, consolidated product management using new ProductFormNew
// ============================================================================

import { useState, useEffect } from 'react';
import { Plus, Search, Package, Download, Upload, RefreshCw, Eye, EyeOff, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Checkbox } from '../../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ProductFormWizard } from './components/ProductFormWizard';
import { ProductImportExport } from './ProductImportExport';
import { supabase } from '../../utils/supabase/client';
import { Product, calculateDiscount } from '../../types/product';
import { formatINR } from '../../utils/currency';
import { toast } from 'sonner';

interface ProductManagerProps {
  onStatsUpdate?: () => void;
}

export default function ProductManager({ onStatsUpdate }: ProductManagerProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showImportExport, setShowImportExport] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_variants(id, variant_name, variant_type, price, stock, is_active)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setShowProductModal(true);
  };

  const handleCreateProduct = () => {
    setEditingProduct(null);
    setShowProductModal(true);
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!confirm(`Delete "${product.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      if (error) throw error;
      toast.success('Product deleted');
      loadProducts();
      onStatsUpdate?.();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };

  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    if (selectedProducts.length === 0) {
      toast.error('Select products first');
      return;
    }

    if (!confirm(`${action} ${selectedProducts.length} products?`)) return;

    try {
      if (action === 'delete') {
        const { error } = await supabase
          .from('products')
          .delete()
          .in('id', selectedProducts);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('products')
          .update({ is_active: action === 'activate' })
          .in('id', selectedProducts);
        if (error) throw error;
      }

      toast.success(`${selectedProducts.length} products ${action}d`);
      setSelectedProducts([]);
      loadProducts();
      onStatsUpdate?.();
    } catch (error) {
      console.error('Bulk action error:', error);
      toast.error('Bulk action failed');
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = !searchTerm || 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.brand.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && product.is_active) ||
      (statusFilter === 'inactive' && !product.is_active);

    return matchesSearch && matchesStatus;
  });

  const getStockBadge = (stock: number) => {
    if (stock === 0) return <Badge variant="destructive">Out of Stock</Badge>;
    if (stock <= 10) return <Badge className="bg-yellow-600">Low Stock</Badge>;
    return <Badge className="bg-green-600">In Stock</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-[var(--color-canyon)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-serif text-[var(--color-dark)] flex items-center gap-2">
              <Package className="w-6 h-6 text-[var(--color-canyon)]" />
              Product Management
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowImportExport(true)}
                className="border-[var(--color-coyote)] hover:bg-[var(--color-coyote)]"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import/Export
              </Button>
              <Button
                onClick={handleCreateProduct}
                className="bg-[var(--color-dark)] text-[var(--color-creme-light)] hover:bg-[var(--color-canyon)]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="bg-[var(--color-creme)] border-[var(--color-coyote)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Actions */}
          {selectedProducts.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-[var(--color-creme)] border border-[var(--color-coyote)] rounded-lg">
              <span className="text-sm font-medium text-[var(--color-dark)]">
                {selectedProducts.length} selected
              </span>
              <div className="flex gap-2 ml-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction('activate')}
                  className="border-[var(--color-coyote)]"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Activate
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction('deactivate')}
                  className="border-[var(--color-coyote)]"
                >
                  <EyeOff className="w-3 h-3 mr-1" />
                  Deactivate
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleBulkAction('delete')}
                  className="bg-red-600"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[var(--color-coyote)]">
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                    onCheckedChange={(checked) => {
                      setSelectedProducts(checked ? filteredProducts.map(p => p.id) : []);
                    }}
                  />
                </TableHead>
                <TableHead className="text-[var(--color-dark)] font-medium">Product</TableHead>
                <TableHead className="text-[var(--color-dark)] font-medium">Brand</TableHead>
                <TableHead className="text-[var(--color-dark)] font-medium">Price</TableHead>
                <TableHead className="text-[var(--color-dark)] font-medium">Stock</TableHead>
                <TableHead className="text-[var(--color-dark)] font-medium">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map(product => {
                const discount = calculateDiscount(product.price, product.compare_at_price);
                return (
                  <TableRow
                    key={product.id}
                    className="cursor-pointer hover:bg-[var(--color-creme)] transition-colors border-b border-[var(--color-coyote)]"
                    onClick={() => handleEditProduct(product)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={(checked) => {
                          setSelectedProducts(prev =>
                            checked ? [...prev, product.id] : prev.filter(id => id !== product.id)
                          );
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-[var(--color-creme)] flex-shrink-0">
                          {product.gallery_images && product.gallery_images.length > 0 ? (
                            <img
                              src={product.gallery_images[0]}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-6 h-6 text-[var(--color-coyote)]" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-[var(--color-dark)] truncate">{product.name}</p>
                          {product.product_variants && product.product_variants.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {product.product_variants.slice(0, 3).map((variant: any) => (
                                <span
                                  key={variant.id}
                                  className="text-xs px-1.5 py-0.5 bg-[var(--color-creme)] rounded text-[var(--color-dark)]/70"
                                >
                                  {variant.variant_name}
                                </span>
                              ))}
                              {product.product_variants.length > 3 && (
                                <span className="text-xs px-1.5 py-0.5 bg-[var(--color-creme)] rounded text-[var(--color-dark)]/70">
                                  +{product.product_variants.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-[var(--color-dark)]">{product.brand}</span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-[var(--color-dark)]">{formatINR(product.price)}</p>
                        {discount.discount_percentage && (
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-[var(--color-dark)]/60 line-through">
                              {formatINR(discount.compare_at_price || 0)}
                            </p>
                            <Badge className="bg-[var(--color-canyon)] text-[var(--color-creme-light)] text-xs">
                              {discount.discount_percentage}% OFF
                            </Badge>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--color-dark)]">{product.stock}</span>
                        {getStockBadge(product.stock)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {product.is_active ? (
                        <Badge className="bg-green-600">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Product Form Modal */}
      <ProductFormWizard
        product={editingProduct}
        isOpen={showProductModal}
        onClose={() => {
          setShowProductModal(false);
          setEditingProduct(null);
        }}
        onSave={() => {
          setShowProductModal(false);
          setEditingProduct(null);
          loadProducts();
          onStatsUpdate?.();
        }}
      />

      {/* Import/Export Modal */}
      <ProductImportExport
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
        onImportComplete={() => {
          loadProducts();
          onStatsUpdate?.();
        }}
      />
    </div>
  );
}
