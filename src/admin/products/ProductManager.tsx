import { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter, 
  Eye, 
  EyeOff,
  Package, 
  Star,
  MoreHorizontal,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Download,
  Upload,
  Copy,
  Archive,
  Settings,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  BarChart3,
  Calendar,
  Tag,
  Image as ImageIcon
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../../components/ui/dropdown-menu';
import { Checkbox } from '../../components/ui/checkbox';
import { Alert, AlertDescription } from '../../components/ui/alert';
// Tabs removed from modal; keep UI lean and standardized via ProductForm
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Separator } from '../../components/ui/separator';
import { EnhancedImageUpload } from '../../components/ui/EnhancedImageUpload';
import { ImageUpload } from '../../components/ui/ImageUpload';
import { ProductImportExport } from './ProductImportExport';
import { ProductForm } from './components/ProductForm';
import { supabase } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { formatINR } from '../../utils/currency';
// Minimal local admin types for this manager (standardized modal uses ProductForm)
type Category = { id: string; name: string };
type Brand = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  short_description?: string;
  price: number;
  compare_price?: number;
  cost_price?: number;
  stock: number;
  barcode?: string;
  image_url?: string;
  image_alt_text?: string;
  gallery_images?: string[];
  category_id?: string;
  brand_id?: string;
  is_active: boolean;
  is_digital?: boolean;
  requires_shipping?: boolean;
  weight?: number;
  dimensions?: Record<string, any>;
  specifications?: Record<string, any>;
  ingredients?: string[];
  origin?: string;
  strength?: string;
  pack_size?: string;
  meta_title?: string;
  meta_description?: string;
  seo_url?: string;
  rating?: number;
  created_at: string;
  brand?: { id: string; name: string };
  category?: { id: string; name: string };
  product_variants?: Array<{
    id: string;
    variant_name: string;
    variant_type: string;
    price: number;
    is_active: boolean;
  }>;
};
type ProductVariant = any;
type ProductCombo = any;

interface CommercialProductManagerProps {
  onStatsUpdate: () => void;
}

interface ProductFormData {
  name: string;
  description: string;
  short_description: string;
  price: number;
  compare_price?: number;
  cost_price?: number;
  stock: number;
  barcode?: string;
  image_url: string;
  image_alt_text?: string;
  gallery_images: string[];
  category_id: string;
  brand_id: string;
  is_active: boolean;
  is_digital: boolean;
  requires_shipping: boolean;
  weight?: number;
  dimensions?: Record<string, any>;
  specifications?: Record<string, any>;
  ingredients?: string[];
  origin?: string;
  strength?: string;
  pack_size?: string;
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  canonical_url?: string;
  og_title?: string;
  og_description?: string;
  structured_data?: string;
  seo_url?: string;
  variants?: Array<{
    id?: string;
    variant_name: string;
    variant_type: 'packaging' | 'color' | 'size' | 'material' | 'flavor' | 'other';
    price: number;
    stock: number;
    is_active: boolean;
    sort_order: number;
    images: string[];
  }>;
}

export default function CommercialProductManager({ onStatsUpdate }: CommercialProductManagerProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [combos, setCombos] = useState<ProductCombo[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingProductForForm, setEditingProductForForm] = useState<any | null>(null);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [showComboModal, setShowComboModal] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [sortBy, setSortBy] = useState<'created_at' | 'name' | 'price' | 'stock' | 'rating'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Form state
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    short_description: '',
    price: 0,
    stock: 0,
    image_url: '',
    gallery_images: [],
    category_id: '',
    brand_id: '',
    is_active: true,
    is_digital: false,
    requires_shipping: true
  });
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Analytics state (typed)
  type AnalyticsState = {
    totalProducts: number;
    activeProducts: number;
    totalValue: number;
    lowStockProducts: number;
    topSellingProducts: Product[];
    recentlyAddedProducts: Product[];
  };
  const [analytics, setAnalytics] = useState<AnalyticsState>({
    totalProducts: 0,
    activeProducts: 0,
    totalValue: 0,
    lowStockProducts: 0,
    topSellingProducts: [] as Product[],
    recentlyAddedProducts: [] as Product[]
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const debounced = setTimeout(() => {
      filterAndSortProducts();
    }, 300);
    return () => clearTimeout(debounced);
  }, [searchTerm, statusFilter, categoryFilter, brandFilter, stockFilter, sortBy, sortOrder]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadProducts(),
        loadCategories(),
        loadBrands(),
        loadVariants(),
        loadCombos(),
        loadAnalytics()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load product data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_categories!inner(category:categories(id, name)),
          brands(id, name),
          product_variants(id, variant_name, variant_type, price, is_active)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      throw error;
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadBrands = async () => {
    try {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setBrands(data || []);
    } catch (error) {
      console.error('Error loading brands:', error);
    }
  };

  const loadVariants = async () => {
    try {
      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      setVariants(data || []);
    } catch (error) {
      console.error('Error loading variants:', error);
    }
  };

  const loadCombos = async () => {
    try {
      const { data, error } = await supabase
        .from('product_combos')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      setCombos(data || []);
    } catch (error) {
      console.error('Error loading combos:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      const totalProducts = products.length;
      const activeProducts = products.filter(p => p.is_active).length;
      const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
      const lowStockProducts = products.filter(p => p.stock <= 10).length;

      setAnalytics({
        totalProducts,
        activeProducts,
        totalValue,
        lowStockProducts,
        topSellingProducts: products.slice(0, 5),
        recentlyAddedProducts: products.slice(0, 5)
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const filterAndSortProducts = () => {
    let filtered = [...products];

    // Apply filters
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(term) ||
        product.description?.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(product => product.is_active === (statusFilter === 'active'));
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(product => product.category_id === categoryFilter);
    }

    if (brandFilter !== 'all') {
      filtered = filtered.filter(product => product.brand_id === brandFilter);
    }

    if (stockFilter !== 'all') {
      filtered = filtered.filter(product => {
        switch (stockFilter) {
          case 'in_stock':
            return product.stock > 10;
          case 'low_stock':
            return product.stock > 0 && product.stock <= 10;
          case 'out_of_stock':
            return product.stock === 0;
          default:
            return true;
        }
      });
    }


    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'price':
          aValue = a.price;
          bValue = b.price;
          break;
        case 'stock':
          aValue = a.stock;
          bValue = b.stock;
          break;
        case 'rating':
          aValue = a.rating || 0;
          bValue = b.rating || 0;
          break;
        default:
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    setProducts(filtered);
  };

  const handleEditProduct = async (product: Product) => {
    setEditingProduct(product);
    try {
      // Load full product details for the unified ProductForm
      const { data, error } = await supabase
        .from('products')
        .select('id, name, slug, brand, price, description, stock, is_active, rating, review_count, origin, pack_size, specifications, gallery_images, meta_title, meta_description, meta_keywords, canonical_url, og_title, og_description, og_image, twitter_title, twitter_description, twitter_image, image_alt_text, structured_data, seo_score')
        .eq('id', product.id)
        .single();
      if (error) throw error;
      setEditingProductForForm(data);
      setShowProductModal(true);
    } catch (e) {
      console.error('Failed to load product details', e);
      toast.error('Failed to load full product details');
    }
  };

  const handleCreateProduct = () => {
    setEditingProduct(null);
    setEditingProductForForm(null);
    setShowProductModal(true);
  };

  // Saving logic is handled by the standardized ProductForm component

  const handleDeleteProduct = async (product: Product) => {
    if (!confirm(`Are you sure you want to delete "${product.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      if (error) throw error;

      toast.success('Product deleted successfully');
      await loadData();
      onStatsUpdate();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedProducts.length === 0) {
      toast.error('Please select products first');
      return;
    }

    if (!confirm(`Apply ${action} to ${selectedProducts.length} selected products?`)) {
      return;
    }

    try {
      let updateData: Partial<Product> = {};

      switch (action) {
        case 'activate':
          updateData = { is_active: true };
          break;
        case 'deactivate':
          updateData = { is_active: false };
          break;
        case 'delete':
          const { error: deleteError } = await supabase
            .from('products')
            .delete()
            .in('id', selectedProducts);
          
          if (deleteError) throw deleteError;
          
          toast.success(`Deleted ${selectedProducts.length} products`);
          setSelectedProducts([]);
          await loadData();
          onStatsUpdate();
          return;
      }

      const { error } = await supabase
        .from('products')
        .update(updateData)
        .in('id', selectedProducts);

      if (error) throw error;

      toast.success(`Updated ${selectedProducts.length} products`);
      setSelectedProducts([]);
      await loadData();
      onStatsUpdate();
    } catch (error) {
      console.error('Error performing bulk action:', error);
      toast.error('Failed to perform bulk action');
    }
  };

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { label: 'Out of Stock', color: 'bg-red-500' };
    if (stock <= 10) return { label: 'Low Stock', color: 'bg-yellow-500' };
    return { label: 'In Stock', color: 'bg-green-500' };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Analytics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{analytics.totalProducts}</p>
                <p className="text-sm text-muted-foreground">Total Products</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{analytics.activeProducts}</p>
                <p className="text-sm text-muted-foreground">Active Products</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{formatINR(analytics.totalValue)}</p>
                <p className="text-sm text-muted-foreground">Total Inventory Value</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{analytics.lowStockProducts}</p>
                <p className="text-sm text-muted-foreground">Low Stock Items</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{analytics.totalProducts}</p>
                <p className="text-sm text-muted-foreground">Total Products</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Product Management</span>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowImportExport(true)}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Import/Export
              </Button>
              <Button type="button" onClick={handleCreateProduct} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Product
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search and Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="lg:col-span-2">
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>

              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brands</SelectItem>
                  {brands.map(brand => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={stockFilter} onValueChange={(value: any) => setStockFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stock</SelectItem>
                  <SelectItem value="in_stock">In Stock</SelectItem>
                  <SelectItem value="low_stock">Low Stock</SelectItem>
                  <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bulk Actions */}
            {selectedProducts.length > 0 && (
              <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
                <span className="text-sm font-medium">
                  {selectedProducts.length} products selected
                </span>
                <Separator orientation="vertical" className="h-4" />
                <Button type="button" size="sm" variant="outline" onClick={() => handleBulkAction('activate')}>
                  Activate
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => handleBulkAction('deactivate')}>
                  Deactivate
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => handleBulkAction('feature')}>
                  Feature
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => handleBulkAction('unfeature')}>
                  Unfeature
                </Button>
                <Button type="button" size="sm" variant="destructive" onClick={() => handleBulkAction('delete')}>
                  Delete
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedProducts.length === products.length}
                    onCheckedChange={(checked: boolean) => {
                      if (checked) {
                        setSelectedProducts(products.map(p => p.id));
                      } else {
                        setSelectedProducts([]);
                      }
                    }}
                  />
                </TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map(product => {
                const stockStatus = getStockStatus(product.stock);
                return (
                  <TableRow 
                    key={product.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleEditProduct(product)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={(checked: boolean) => {
                          if (checked) {
                            setSelectedProducts(prev => [...prev, product.id]);
                          } else {
                            setSelectedProducts(prev => prev.filter(id => id !== product.id));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                          {product.gallery_images && product.gallery_images.length > 0 ? (
                            <img
                              src={product.gallery_images[0]}
                              alt={product.image_alt_text || product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.image_alt_text || product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{product.name}</p>
                          {product.product_variants && product.product_variants.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1 ml-2">
                              {product.product_variants.slice(0, 3).map((variant: any, idx: number) => (
                                <span 
                                  key={variant.id} 
                                  className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground"
                                >
                                  {variant.variant_name}
                                </span>
                              ))}
                              {product.product_variants.length > 3 && (
                                <span className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                                  +{product.product_variants.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{product.category?.name || 'No Category'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{product.brand?.name || 'No Brand'}</span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{formatINR(product.price)}</p>
                        {product.compare_price && product.compare_price > product.price && (
                          <p className="text-sm text-muted-foreground line-through">
                            {formatINR(product.compare_price)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{product.stock}</span>
                        <div className={`w-2 h-2 rounded-full ${stockStatus.color}`} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {product.is_active ? (
                          <Badge variant="default">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Product Form Modal - standardized using ProductForm */}
      <Dialog open={showProductModal} onOpenChange={setShowProductModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Edit Product' : 'Create Product'}
            </DialogTitle>
            <DialogDescription>
              {editingProduct ? 'Update product information and settings' : 'Create a new product with details, variants, and settings'}
            </DialogDescription>
          </DialogHeader>
          <ProductForm
            product={editingProductForForm}
            onSave={async () => {
              setShowProductModal(false);
              await loadData();
              onStatsUpdate();
            }}
            onCancel={() => setShowProductModal(false)}
            onDelete={async () => {
              setShowProductModal(false);
              await loadData();
              onStatsUpdate();
            }}
          />
        </DialogContent>
      </Dialog>
      
      {/* Import/Export Modal */}
      <ProductImportExport
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
        onImportComplete={() => {
          loadData();
          onStatsUpdate();
        }}
      />
    </div>
  );
}
