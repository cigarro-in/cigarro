import { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Package,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  Search,
  Filter,
  Monitor
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Switch } from '../../ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Badge } from '../../ui/badge';
import { Alert, AlertDescription } from '../../ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Checkbox } from '../../ui/checkbox';
import { ImageUpload } from '../../ui/ImageUpload';
import { supabase } from '../../../utils/supabase/client';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  gallery_images?: string[];
  is_active: boolean;
  is_showcase: boolean;
  showcase_order?: number | null;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface ProductShowcaseManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function ProductShowcaseManager({ open, onOpenChange, onUpdate }: ProductShowcaseManagerProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sectionConfig, setSectionConfig] = useState({
    title: 'Discover Our Most Celebrated Collections',
    background_image: '' as string | null,
    is_enabled: true
  });

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [productsResult, categoriesResult, configResult] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, slug, price, gallery_images, is_active, is_showcase, showcase_order')
          .order('name'),
        supabase
          .from('categories')
          .select('id, name, slug')
          .order('name'),
        supabase
          .from('section_configurations')
          .select('title, background_image, is_enabled')
          .eq('section_name', 'product_showcase')
          .single()
      ]);

      if (productsResult.error) throw productsResult.error;
      if (categoriesResult.error) throw categoriesResult.error;

      setProducts(productsResult.data || []);
      setCategories(categoriesResult.data || []);
      
      // Load section configuration
      if (configResult.data) {
        setSectionConfig({
          title: configResult.data.title || 'Discover Our Most Celebrated Collections',
          background_image: configResult.data.background_image || '',
          is_enabled: configResult.data.is_enabled !== false
        });
      } else if (configResult.error && configResult.error.code !== 'PGRST116') {
        console.error('Error loading section config:', configResult.error);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || 
      (product as any).category?.id === categoryFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && product.is_active) ||
      (statusFilter === 'inactive' && !product.is_active);
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleToggleShowcase = async (productId: string, isShowcase: boolean) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ 
          is_showcase: isShowcase,
          showcase_order: isShowcase ? (products.filter(p => p.is_showcase).length + 1) : null
        })
        .eq('id', productId);

      if (error) throw error;

      setProducts(prev => prev.map(p => 
        p.id === productId ? { ...p, is_showcase: isShowcase, showcase_order: isShowcase ? (products.filter(p => p.is_showcase).length + 1) : null } : p
      ));

      toast.success(`Product ${isShowcase ? 'added to' : 'removed from'} showcase`);
      onUpdate();
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('Failed to update product');
    }
  };


  const handleReorderShowcase = async (productId: string, direction: 'up' | 'down') => {
    const showcaseProducts = products.filter(p => p.is_showcase).sort((a, b) => (a.showcase_order || 0) - (b.showcase_order || 0));
    const currentIndex = showcaseProducts.findIndex(p => p.id === productId);
    
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= showcaseProducts.length) return;

    // Swap the products
    const reorderedProducts = [...showcaseProducts];
    [reorderedProducts[currentIndex], reorderedProducts[newIndex]] = [reorderedProducts[newIndex], reorderedProducts[currentIndex]];

    // Update the showcase_order for all affected products
    const updates = reorderedProducts.map((product, index) => ({
      id: product.id,
      showcase_order: index + 1
    }));

    try {
      for (const update of updates) {
        const { error } = await supabase
          .from('products')
          .update({ showcase_order: update.showcase_order })
          .eq('id', update.id);

        if (error) throw error;
      }

      setProducts(prev => prev.map(p => {
        const update = updates.find(u => u.id === p.id);
        return update ? { ...p, showcase_order: update.showcase_order } : p;
      }));

      toast.success('Showcase order updated');
      onUpdate();
    } catch (error) {
      console.error('Error reordering showcase:', error);
      toast.error('Failed to reorder showcase');
    }
  };

  const handleSaveSectionConfig = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('section_configurations')
        .upsert({
          section_name: 'product_showcase',
          title: sectionConfig.title,
          background_image: sectionConfig.background_image,
          is_enabled: sectionConfig.is_enabled,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'section_name'
        });

      if (error) throw error;

      toast.success('Section configuration saved successfully');
      onUpdate();
    } catch (error) {
      console.error('Error saving section config:', error);
      toast.error('Failed to save section configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const showcaseProducts = products.filter(p => p.is_showcase).sort((a, b) => (a.showcase_order || 0) - (b.showcase_order || 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Product Showcase Management
          </DialogTitle>
          <DialogDescription>
            Manage which products appear in the Product Showcase section on your homepage. Select specific products, reorder them, and configure the section content.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Alert>
            <Package className="h-4 w-4" />
            <AlertDescription>
              Manage which products appear in the Product Showcase section on your homepage. You can select specific products and reorder them.
            </AlertDescription>
          </Alert>

          {/* Section Content Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Section Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="section_title">Section Title</Label>
                  <Input
                    id="section_title"
                    value={sectionConfig.title}
                    onChange={(e) => setSectionConfig(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter section title"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="section_enabled"
                    checked={sectionConfig.is_enabled}
                    onCheckedChange={(checked: boolean) => setSectionConfig(prev => ({ ...prev, is_enabled: checked }))}
                  />
                  <Label htmlFor="section_enabled">Enable Section</Label>
                </div>
              </div>
              <div>
                <Label>Featured Image</Label>
                <div className="space-y-2">
                  <ImageUpload
                    imageUrl={sectionConfig.background_image}
                    onImageUrlChange={(url: string | null) => {
                      setSectionConfig(prev => ({ ...prev, background_image: url || '' }));
                    }}
                    showSelector={true}
                    title="Select Featured Image"
                    description="Choose a featured image for the first column of the product showcase section"
                  />
                  <p className="text-xs text-muted-foreground">
                    This image will be displayed in the first column of the showcase section. Recommended size: 800x1000px
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button 
                  onClick={handleSaveSectionConfig}
                  disabled={isSaving}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save Section Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Current Showcase Products */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Current Showcase Products ({showcaseProducts.length})</span>
                <Badge variant="outline">
                  {showcaseProducts.length} Products
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {showcaseProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No products in showcase yet</p>
                  <p className="text-sm">Select products below to add them to the showcase</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {showcaseProducts.map((product, index) => (
                    <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-muted rounded-lg overflow-hidden">
                          <img
                            src={product.gallery_images && product.gallery_images.length > 0 ? product.gallery_images[0] : '/placeholder-product.jpg'}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">₹{product.price.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReorderShowcase(product.id, 'up')}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReorderShowcase(product.id, 'down')}
                          disabled={index === showcaseProducts.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleShowcase(product.id, false)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Product Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Products for Showcase</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search products..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by category" />
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
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="inactive">Inactive Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>


              {/* Products Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading ? (
                  <div className="col-span-full text-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    No products found
                  </div>
                ) : (
                  filteredProducts.map(product => (
                    <div key={product.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-16 h-16 bg-muted rounded overflow-hidden flex-shrink-0">
                          <img
                            src={product.gallery_images && product.gallery_images.length > 0 ? product.gallery_images[0] : '/placeholder-product.jpg'}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{product.name}</h3>
                          <p className="text-sm text-muted-foreground">₹{product.price.toLocaleString()}</p>
                          <Badge variant={product.is_active ? "default" : "secondary"} className="text-xs">
                            {product.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Switch
                          checked={product.is_showcase}
                          onCheckedChange={(checked: boolean) => handleToggleShowcase(product.id, checked)}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleShowcase(product.id, !product.is_showcase)}
                          className="flex items-center gap-2"
                        >
                          {product.is_showcase ? (
                            <>
                              <Trash2 className="h-4 w-4" />
                              Remove
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4" />
                              Add
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between gap-2">
            <Button 
              onClick={handleSaveSectionConfig}
              disabled={isSaving}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save All Changes'}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}