import React, { useState } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  Package,
  MoreHorizontal,
  Eye,
  Copy,
  Archive,
  Settings,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Badge } from '../../../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../../../../components/ui/dropdown-menu';
import { Checkbox } from '../../../../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { Separator } from '../../../../components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../../components/ui/dialog';
import { Product, ProductVariant } from '../types/index';
import { formatINR } from '../../../../utils/currency';
import { toast } from 'sonner';
import { ProductForm } from '../../../../admin/products/components/ProductForm';

interface DashboardProductsTabProps {
  products: Product[];
  variants: ProductVariant[];
  onAddVariant: () => void;
  onEditVariant: (variant: ProductVariant) => void;
  onDeleteVariant: (variantId: string) => void;
}

export function DashboardProductsTab({
  products,
  variants,
  onAddVariant,
  onEditVariant,
  onDeleteVariant
}: DashboardProductsTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.brand?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && product.is_active) ||
                         (statusFilter === 'inactive' && !product.is_active);
    return matchesSearch && matchesStatus;
  });

  // Get variants for a specific product
  const getProductVariants = (productId: string) => {
    return variants.filter(variant => variant.product_id === productId);
  };

  // Toggle product expansion
  const toggleProductExpansion = (productId: string) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedProducts(newExpanded);
  };

  // Handle add product
  const handleAddProduct = () => {
    setEditingProduct(null);
    setShowProductModal(true);
  };

  // Handle edit product
  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setShowProductModal(true);
  };

  // Handle add variant - open product form with this product
  const handleAddVariant = (product: Product) => {
    setEditingProduct(product);
    setShowProductModal(true);
  };

  // Handle edit variant - open product form with the parent product
  const handleEditVariant = (variant: ProductVariant) => {
    const parentProduct = products.find(p => p.id === variant.product_id);
    if (parentProduct) {
      setEditingProduct(parentProduct);
      setShowProductModal(true);
    }
  };

  // Handle delete variant
  const handleDeleteVariant = async (variantId: string) => {
    if (confirm('Are you sure you want to delete this variant?')) {
      await onDeleteVariant(variantId);
    }
  };

  // Handle bulk actions
  const handleBulkAction = (action: string) => {
    if (selectedProducts.length === 0) {
      toast.error('Please select products first');
      return;
    }
    
    switch (action) {
      case 'activate':
        toast.success(`Activated ${selectedProducts.length} products`);
        break;
      case 'deactivate':
        toast.success(`Deactivated ${selectedProducts.length} products`);
        break;
      case 'delete':
        toast.success(`Deleted ${selectedProducts.length} products`);
        break;
    }
    setSelectedProducts([]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Products & Variants</h2>
          <p className="text-muted-foreground">Manage your product catalog and variants</p>
        </div>
        <Button onClick={handleAddProduct}>
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold">{products.length}</p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Variants</p>
                <p className="text-2xl font-bold">{variants.length}</p>
              </div>
              <Settings className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Products</p>
                <p className="text-2xl font-bold">{products.filter(p => p.is_active).length}</p>
              </div>
              <Eye className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Variants</p>
                <p className="text-2xl font-bold">{variants.filter(v => v.is_active).length}</p>
              </div>
              <Settings className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedProducts.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedProducts.length} product(s) selected
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleBulkAction('activate')}>
                  Activate
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkAction('deactivate')}>
                  Deactivate
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkAction('delete')}>
                  Delete
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                    onCheckedChange={(checked: boolean) => {
                      if (checked) {
                        setSelectedProducts(filteredProducts.map(p => p.id));
                      } else {
                        setSelectedProducts([]);
                      }
                    }}
                  />
                </TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Variants</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => {
                const productVariants = getProductVariants(product.id);
                const isExpanded = expandedProducts.has(product.id);
                
                return (
                  <React.Fragment key={product.id}>
                    {/* Product Row */}
                    <TableRow>
                      <TableCell>
                        <Checkbox
                          checked={selectedProducts.includes(product.id)}
                          onCheckedChange={(checked: boolean) => {
                            if (checked) {
                              setSelectedProducts([...selectedProducts, product.id]);
                            } else {
                              setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleProductExpansion(product.id)}
                            className="p-0 h-auto"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                          <div>
                            <div className="font-medium">{product.name}</div>
                            <div className="text-sm text-muted-foreground">{product.slug}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{product.brand || '-'}</TableCell>
                      <TableCell>{formatINR(product.price)}</TableCell>
                      <TableCell>{product.stock || 0}</TableCell>
                      <TableCell>
                        <Badge variant={product.is_active ? 'default' : 'secondary'}>
                          {product.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{productVariants.length} variants</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddVariant(product)}
                            className="h-6 px-2"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditProduct(product)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleAddVariant(product)}>
                              <Plus className="h-4 w-4 mr-2" />
                              Add Variant
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDeleteVariant(product.id)}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>

                    {/* Variants Row */}
                    {isExpanded && productVariants.length > 0 && (
                      <TableRow className="bg-muted/50">
                        <TableCell colSpan={8}>
                          <div className="p-4">
                            <h4 className="font-medium mb-3">Variants</h4>
                            <div className="space-y-2">
                              {productVariants.map((variant) => (
                                <div key={variant.id} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                                  <div className="flex items-center gap-4">
                                    <div>
                                      <div className="font-medium">{variant.variant_name}</div>
                                      <div className="text-sm text-muted-foreground">
                                        {variant.variant_type} • {formatINR(variant.price)}
                                      </div>
                                    </div>
                                    <Badge variant={variant.is_active ? 'default' : 'secondary'}>
                                      {variant.is_active ? 'Active' : 'Inactive'}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditVariant(variant)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteVariant(variant.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Product Modal */}
      <Dialog open={showProductModal} onOpenChange={setShowProductModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add Product'}</DialogTitle>
            <DialogDescription>
              {editingProduct ? 'Update product information and variants' : 'Create a new product with variants'}
            </DialogDescription>
          </DialogHeader>
          <ProductForm
            product={editingProduct}
            isActive={true}
            onSave={() => {
              setShowProductModal(false);
              setEditingProduct(null);
              // Refresh products data
              window.location.reload();
            }}
            onCancel={() => {
              setShowProductModal(false);
              setEditingProduct(null);
            }}
            onDelete={editingProduct ? () => {
              if (confirm('Are you sure you want to delete this product?')) {
                // Handle delete
                setShowProductModal(false);
                setEditingProduct(null);
                // Refresh products data
                window.location.reload();
              }
            } : undefined}
          />
        </DialogContent>
      </Dialog>

    </div>
  );
}