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
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../ui/dropdown-menu';
import { Checkbox } from '../ui/checkbox';
import { Alert, AlertDescription } from '../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { EnhancedImageUpload } from '../ui/EnhancedImageUpload';
import { ImageUpload } from '../ui/ImageUpload';
import { ProductImportExport } from './ProductImportExport';
import { supabase } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { formatINR } from '../../utils/currency';
import { Product, Category, Brand, ProductVariant, ProductCombo } from '../../types/admin';
import { productValidator, sanitizer } from '../../utils/admin-validation';
import { auditLogger } from '../../utils/audit-logger';
import { performanceManager } from '../../utils/performance';

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
  sku: string;
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
    variant_type: 'packaging' | 'color' | 'size' | 'other';
    sku: string;
    price: number;
    stock_quantity: number;
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
    sku: '',
    image_url: '',
    gallery_images: [],
    category_id: '',
    brand_id: '',
    is_active: true,
    is_digital: false,
    requires_shipping: true
  });
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Analytics state
  const [analytics, setAnalytics] = useState({
    totalProducts: 0,
    activeProducts: 0,
    totalValue: 0,
    lowStockProducts: 0,
    topSellingProducts: [],
    recentlyAddedProducts: []
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
          brands(id, name)
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
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase())
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

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      short_description: product.short_description || '',
      price: product.price,
      compare_price: product.compare_price,
      cost_price: product.cost_price,
      stock: product.stock,
      sku: product.sku || '',
      barcode: product.barcode,
      image_url: product.image_url || '',
      image_alt_text: product.image_alt_text,
      gallery_images: product.gallery_images || [],
      category_id: product.category_id || '',
      brand_id: product.brand_id || '',
      is_active: product.is_active,
      is_digital: product.is_digital,
      requires_shipping: product.requires_shipping,
      weight: product.weight,
      dimensions: product.dimensions,
      specifications: product.specifications,
      ingredients: product.ingredients,
      origin: product.origin,
      strength: product.strength,
      pack_size: product.pack_size,
      meta_title: product.meta_title,
      meta_description: product.meta_description,
      seo_url: product.seo_url
    });
    setShowProductModal(true);
  };

  const handleCreateProduct = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      short_description: '',
      price: 0,
      stock: 0,
      sku: '',
      image_url: '',
      gallery_images: [],
      category_id: '',
      brand_id: '',
      is_active: true,
      is_digital: false,
      requires_shipping: true
    });
    setFormErrors({});
    setShowProductModal(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Product name is required';
    }

    if (!formData.description.trim()) {
      errors.description = 'Product description is required';
    }

    if (formData.price <= 0) {
      errors.price = 'Price must be greater than 0';
    }

    if (formData.stock < 0) {
      errors.stock = 'Stock cannot be negative';
    }

    if (!formData.category_id) {
      errors.category_id = 'Category is required';
    }

    if (!formData.brand_id) {
      errors.brand_id = 'Brand is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveProduct = async () => {
    if (!validateForm()) {
      toast.error('Please fix the validation errors');
      return;
    }

    setIsSaving(true);
    try {
      // Sanitize form data
      const sanitizedData = {
        ...formData,
        name: sanitizer.sanitizeText(formData.name),
        description: sanitizer.sanitizeHtml(formData.description),
        short_description: sanitizer.sanitizeText(formData.short_description || ''),
        sku: sanitizer.sanitizeText(formData.sku),
        meta_title: sanitizer.sanitizeText(formData.meta_title || ''),
        meta_description: sanitizer.sanitizeText(formData.meta_description || '')
      };

      if (editingProduct) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update(sanitizedData)
          .eq('id', editingProduct.id);

        if (error) throw error;

        // Log audit trail
        await auditLogger.logProduct('UPDATE', editingProduct.id, editingProduct, sanitizedData);

        toast.success('Product updated successfully');
      } else {
        // Create new product
        const { data, error } = await supabase
          .from('products')
          .insert(sanitizedData)
          .select()
          .single();

        if (error) throw error;

        // Log audit trail
        await auditLogger.logProduct('INSERT', data.id, null, sanitizedData);

        toast.success('Product created successfully');
      }

      setShowProductModal(false);
      await loadData();
      onStatsUpdate();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Failed to save product');
    } finally {
      setIsSaving(false);
    }
  };

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

      // Log audit trail
      await auditLogger.logProduct('DELETE', product.id, product, null);

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
              <Button onClick={handleCreateProduct} className="flex items-center gap-2">
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
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('activate')}>
                  Activate
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('deactivate')}>
                  Deactivate
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('feature')}>
                  Feature
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('unfeature')}>
                  Unfeature
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleBulkAction('delete')}>
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
                    onCheckedChange={(checked) => {
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
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map(product => {
                const stockStatus = getStockStatus(product.stock);
                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={(checked) => {
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
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted">
                          {product.image_url ? (
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
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">{product.sku}</p>
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
                          <DropdownMenuItem>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => handleDeleteProduct(product)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Product Form Modal */}
      <Dialog open={showProductModal} onOpenChange={setShowProductModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Edit Product' : 'Create Product'}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="basic" className="space-y-4">
            <TabsList>
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="pricing">Pricing & Inventory</TabsTrigger>
              <TabsTrigger value="media">Media</TabsTrigger>
              <TabsTrigger value="variants">Variants</TabsTrigger>
              <TabsTrigger value="specifications">Specifications</TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    error={formErrors.name}
                  />
                </div>

                <div>
                  <Label htmlFor="sku">SKU *</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                    error={formErrors.sku}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="short_description">Short Description</Label>
                <Textarea
                  id="short_description"
                  rows={2}
                  value={formData.short_description}
                  onChange={(e) => setFormData(prev => ({ ...prev, short_description: e.target.value }))}
                  placeholder="Brief product description for listings"
                />
              </div>

              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  error={formErrors.description}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category_id">Category *</Label>
                  <Select 
                    value={formData.category_id} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.category_id && (
                    <p className="text-sm text-red-500 mt-1">{formErrors.category_id}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="brand_id">Brand *</Label>
                  <Select 
                    value={formData.brand_id} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, brand_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map(brand => (
                        <SelectItem key={brand.id} value={brand.id}>
                          {brand.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.brand_id && (
                    <p className="text-sm text-red-500 mt-1">{formErrors.brand_id}</p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pricing" className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="price">Price *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    error={formErrors.price}
                  />
                </div>

                <div>
                  <Label htmlFor="compare_price">Compare at Price</Label>
                  <Input
                    id="compare_price"
                    type="number"
                    step="0.01"
                    value={formData.compare_price || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, compare_price: parseFloat(e.target.value) || undefined }))}
                  />
                </div>

                <div>
                  <Label htmlFor="cost_price">Cost Price</Label>
                  <Input
                    id="cost_price"
                    type="number"
                    step="0.01"
                    value={formData.cost_price || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, cost_price: parseFloat(e.target.value) || undefined }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="stock">Stock Quantity *</Label>
                  <Input
                    id="stock"
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData(prev => ({ ...prev, stock: parseInt(e.target.value) || 0 }))}
                    error={formErrors.stock}
                  />
                </div>

                <div>
                  <Label htmlFor="barcode">Barcode</Label>
                  <Input
                    id="barcode"
                    value={formData.barcode || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, barcode: e.target.value }))}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="media" className="space-y-4">
              <div>
                <Label htmlFor="image_url">Main Product Image *</Label>
                <ImageUpload
                  imageUrl={formData.image_url}
                  onImageUrlChange={(url) => setFormData(prev => ({ ...prev, image_url: url }))}
                  showSelector={true}
                  title="Select Product Image"
                  description="Choose the main product image from your library or upload a new one"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Upload or select the main product image
                </p>
              </div>

              <div>
                <Label htmlFor="image_alt_text">Image Alt Text</Label>
                <Input
                  id="image_alt_text"
                  value={formData.image_alt_text || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, image_alt_text: e.target.value }))}
                  placeholder="Descriptive text for accessibility"
                />
              </div>

              {/* Gallery images could be implemented here */}
            </TabsContent>

            <TabsContent value="variants" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Product Variants</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Add new variant logic here
                      setFormData(prev => ({
                        ...prev,
                        variants: [
                          ...(prev.variants || []),
                          {
                            id: `temp-${Date.now()}`,
                            variant_name: '',
                            variant_type: 'packaging',
                            sku: '',
                            price: 0,
                            stock_quantity: 0,
                            is_active: true,
                            sort_order: (prev.variants?.length || 0) + 1,
                            images: []
                          }
                        ]
                      }));
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Variant
                  </Button>
                </div>

                {formData.variants && formData.variants.length > 0 ? (
                  <div className="space-y-4">
                    {formData.variants.map((variant, index) => (
                      <Card key={variant.id || index}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Variant {index + 1}</CardTitle>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  variants: prev.variants?.filter((_, i) => i !== index) || []
                                }));
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor={`variant_name_${index}`}>Variant Name *</Label>
                              <Input
                                id={`variant_name_${index}`}
                                value={variant.variant_name}
                                onChange={(e) => {
                                  const newVariants = [...(formData.variants || [])];
                                  newVariants[index] = { ...variant, variant_name: e.target.value };
                                  setFormData(prev => ({ ...prev, variants: newVariants }));
                                }}
                                placeholder="e.g., Packet, Carton, Half Carton"
                              />
                            </div>

                            <div>
                              <Label htmlFor={`variant_type_${index}`}>Variant Type</Label>
                              <Select
                                value={variant.variant_type}
                                onValueChange={(value) => {
                                  const newVariants = [...(formData.variants || [])];
                                  newVariants[index] = { ...variant, variant_type: value as any };
                                  setFormData(prev => ({ ...prev, variants: newVariants }));
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="packaging">Packaging</SelectItem>
                                  <SelectItem value="color">Color</SelectItem>
                                  <SelectItem value="size">Size</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <Label htmlFor={`variant_sku_${index}`}>SKU</Label>
                              <Input
                                id={`variant_sku_${index}`}
                                value={variant.sku}
                                onChange={(e) => {
                                  const newVariants = [...(formData.variants || [])];
                                  newVariants[index] = { ...variant, sku: e.target.value };
                                  setFormData(prev => ({ ...prev, variants: newVariants }));
                                }}
                                placeholder="Variant SKU"
                              />
                            </div>

                            <div>
                              <Label htmlFor={`variant_price_${index}`}>Price *</Label>
                              <Input
                                id={`variant_price_${index}`}
                                type="number"
                                step="0.01"
                                value={variant.price}
                                onChange={(e) => {
                                  const newVariants = [...(formData.variants || [])];
                                  newVariants[index] = { ...variant, price: parseFloat(e.target.value) || 0 };
                                  setFormData(prev => ({ ...prev, variants: newVariants }));
                                }}
                                placeholder="0.00"
                              />
                            </div>

                            <div>
                              <Label htmlFor={`variant_stock_${index}`}>Stock Quantity</Label>
                              <Input
                                id={`variant_stock_${index}`}
                                type="number"
                                value={variant.stock_quantity}
                                onChange={(e) => {
                                  const newVariants = [...(formData.variants || [])];
                                  newVariants[index] = { ...variant, stock_quantity: parseInt(e.target.value) || 0 };
                                  setFormData(prev => ({ ...prev, variants: newVariants }));
                                }}
                                placeholder="0"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Switch
                                id={`variant_active_${index}`}
                                checked={variant.is_active}
                                onCheckedChange={(checked) => {
                                  const newVariants = [...(formData.variants || [])];
                                  newVariants[index] = { ...variant, is_active: checked };
                                  setFormData(prev => ({ ...prev, variants: newVariants }));
                                }}
                              />
                              <Label htmlFor={`variant_active_${index}`}>Active</Label>
                            </div>

                            <div className="flex items-center space-x-2">
                              <Label htmlFor={`variant_sort_${index}`}>Sort Order</Label>
                              <Input
                                id={`variant_sort_${index}`}
                                type="number"
                                value={variant.sort_order}
                                onChange={(e) => {
                                  const newVariants = [...(formData.variants || [])];
                                  newVariants[index] = { ...variant, sort_order: parseInt(e.target.value) || 0 };
                                  setFormData(prev => ({ ...prev, variants: newVariants }));
                                }}
                                className="w-20"
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No variants added yet</p>
                    <p className="text-sm">Add variants to offer different packaging options</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="specifications" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="origin">Origin</Label>
                  <Input
                    id="origin"
                    value={formData.origin || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, origin: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="strength">Strength</Label>
                  <Input
                    id="strength"
                    value={formData.strength || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, strength: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pack_size">Pack Size</Label>
                  <Input
                    id="pack_size"
                    value={formData.pack_size || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, pack_size: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.001"
                    value={formData.weight || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, weight: parseFloat(e.target.value) || undefined }))}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="seo" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="meta_title">Meta Title</Label>
                  <Input
                    id="meta_title"
                    value={formData.meta_title || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, meta_title: e.target.value }))}
                    placeholder="SEO title for search engines (50-60 chars)"
                    maxLength={60}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.meta_title?.length || 0}/60 characters
                  </p>
                </div>

                <div>
                  <Label htmlFor="seo_url">SEO URL Slug</Label>
                  <Input
                    id="seo_url"
                    value={formData.seo_url || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, seo_url: e.target.value }))}
                    placeholder="custom-url-slug"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="meta_description">Meta Description</Label>
                <Textarea
                  id="meta_description"
                  rows={3}
                  value={formData.meta_description || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, meta_description: e.target.value }))}
                  placeholder="SEO description for search engines (150-160 chars)"
                  maxLength={160}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.meta_description?.length || 0}/160 characters
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="meta_keywords">Meta Keywords</Label>
                  <Input
                    id="meta_keywords"
                    value={formData.meta_keywords || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, meta_keywords: e.target.value }))}
                    placeholder="keyword1, keyword2, keyword3"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Separate keywords with commas
                  </p>
                </div>

                <div>
                  <Label htmlFor="canonical_url">Canonical URL</Label>
                  <Input
                    id="canonical_url"
                    value={formData.canonical_url || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, canonical_url: e.target.value }))}
                    placeholder="https://example.com/product-page"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="og_title">Open Graph Title</Label>
                  <Input
                    id="og_title"
                    value={formData.og_title || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, og_title: e.target.value }))}
                    placeholder="Social media title"
                  />
                </div>

                <div>
                  <Label htmlFor="og_description">Open Graph Description</Label>
                  <Input
                    id="og_description"
                    value={formData.og_description || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, og_description: e.target.value }))}
                    placeholder="Social media description"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="structured_data">Structured Data (JSON-LD)</Label>
                <Textarea
                  id="structured_data"
                  rows={4}
                  value={formData.structured_data || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, structured_data: e.target.value }))}
                  placeholder='{"@context": "https://schema.org", "@type": "Product", ...}'
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Optional: Add JSON-LD structured data for rich snippets
                </p>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="is_active">Active</Label>
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                    />
                  </div>

                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="is_digital">Digital Product</Label>
                    <Switch
                      id="is_digital"
                      checked={formData.is_digital}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_digital: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="requires_shipping">Requires Shipping</Label>
                    <Switch
                      id="requires_shipping"
                      checked={formData.requires_shipping}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, requires_shipping: checked }))}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setShowProductModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveProduct} disabled={isSaving}>
              {isSaving ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
            </Button>
          </div>
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
