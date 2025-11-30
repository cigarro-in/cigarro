import { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter, 
  Eye, 
  EyeOff,
  Settings,
  MoreHorizontal,
  Copy,
  Archive,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Star,
  Grid,
  List,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
  ExternalLink,
  Award,
  Building
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../../../components/ui/dropdown-menu';
import { Checkbox } from '../../../components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../components/ui/dialog';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Switch } from '../../../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Separator } from '../../../components/ui/separator';
import { ImageUpload } from '../../../components/ui/ImageUpload';
import { supabase } from '../../../lib/supabase/client';
import { toast } from 'sonner';
import { sanitizer } from '../../../utils/validation';
import { auditLogger } from '../../../utils/audit-logger';

interface Brand {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  website_url?: string;
  sort_order: number;
  is_active: boolean;
  is_featured: boolean;
  heritage?: Record<string, any>;
  meta_title?: string;
  meta_description?: string;
  created_at: string;
  updated_at: string;
  product_count?: number;
}

interface BrandFormData {
  name: string;
  description: string;
  logo_url: string;
  website_url: string;
  is_active: boolean;
  is_featured: boolean;
  heritage: {
    founded_year?: string;
    origin_country?: string;
    founder?: string;
    story?: string;
  };
  meta_title: string;
  meta_description: string;
}

interface EnhancedBrandManagerProps {
  onStatsUpdate: () => void;
}

export default function EnhancedBrandManager({ onStatsUpdate }: EnhancedBrandManagerProps) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [filteredBrands, setFilteredBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [featuredFilter, setFeaturedFilter] = useState<'all' | 'featured' | 'not_featured'>('all');
  
  // Form state
  const [formData, setFormData] = useState<BrandFormData>({
    name: '',
    description: '',
    logo_url: '',
    website_url: '',
    is_active: true,
    is_featured: false,
    heritage: {},
    meta_title: '',
    meta_description: ''
  });
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Analytics
  const [analytics, setAnalytics] = useState({
    totalBrands: 0,
    activeBrands: 0,
    featuredBrands: 0,
    brandsWithProducts: 0,
    totalProducts: 0
  });

  useEffect(() => {
    loadBrands();
  }, []);

  useEffect(() => {
    filterBrands();
    calculateAnalytics();
  }, [brands, searchTerm, statusFilter, featuredFilter]);

  const loadBrands = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('brands')
        .select(`
          *,
          product_count:products(count)
        `)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Error loading brands:', error);
        toast.error('Failed to load brands');
        setBrands([]);
        return;
      }

      // Process the data to include product counts
      const processedBrands = (data || []).map(brand => ({
        ...brand,
        product_count: brand.product_count?.[0]?.count || 0
      }));

      setBrands(processedBrands);
    } catch (error) {
      console.error('Error loading brands:', error);
      // Don't show error toast for missing table, just log it
      console.warn('Brands table not available');
      setBrands([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filterBrands = () => {
    let filtered = [...brands];

    if (searchTerm) {
      filtered = filtered.filter(brand =>
        brand.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        brand.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(brand => brand.is_active === (statusFilter === 'active'));
    }

    if (featuredFilter !== 'all') {
      filtered = filtered.filter(brand => brand.is_featured === (featuredFilter === 'featured'));
    }

    setFilteredBrands(filtered);
  };

  const calculateAnalytics = () => {
    const totalBrands = brands.length;
    const activeBrands = brands.filter(b => b.is_active).length;
    const featuredBrands = brands.filter(b => b.is_featured).length;
    const brandsWithProducts = brands.filter(b => (b.product_count || 0) > 0).length;
    const totalProducts = brands.reduce((sum, b) => sum + (b.product_count || 0), 0);

    setAnalytics({
      totalBrands,
      activeBrands,
      featuredBrands,
      brandsWithProducts,
      totalProducts
    });
  };

  const handleCreateBrand = () => {
    setEditingBrand(null);
    setFormData({
      name: '',
      description: '',
      logo_url: '',
      website_url: '',
      is_active: true,
      is_featured: false,
      heritage: {},
      meta_title: '',
      meta_description: ''
    });
    setFormErrors({});
    setShowBrandModal(true);
  };

  const handleEditBrand = (brand: Brand) => {
    setEditingBrand(brand);
    setFormData({
      name: brand.name,
      description: brand.description || '',
      logo_url: brand.logo_url || '',
      website_url: brand.website_url || '',
      is_active: brand.is_active,
      is_featured: brand.is_featured,
      heritage: brand.heritage || {},
      meta_title: brand.meta_title || '',
      meta_description: brand.meta_description || ''
    });
    setFormErrors({});
    setShowBrandModal(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Brand name is required';
    }

    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    }

    if (formData.website_url && !formData.website_url.match(/^https?:\/\/.+/)) {
      errors.website_url = 'Please enter a valid URL';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleSaveBrand = async () => {
    if (!validateForm()) {
      toast.error('Please fix the validation errors');
      return;
    }

    setIsSaving(true);
    try {
      const sanitizedData = {
        ...formData,
        name: sanitizer.sanitizeText(formData.name),
        description: sanitizer.sanitizeText(formData.description),
        website_url: sanitizer.sanitizeUrl(formData.website_url),
        meta_title: sanitizer.sanitizeText(formData.meta_title),
        meta_description: sanitizer.sanitizeText(formData.meta_description),
        slug: generateSlug(formData.name),
        sort_order: editingBrand?.sort_order || brands.length
      };

      if (editingBrand) {
        // Update existing brand
        const { error } = await supabase
          .from('brands')
          .update(sanitizedData)
          .eq('id', editingBrand.id);

        if (error) throw error;

        await auditLogger.logAction('brands', 'UPDATE', editingBrand.id, editingBrand, sanitizedData);
        toast.success('Brand updated successfully');
      } else {
        // Create new brand
        const { data, error } = await supabase
          .from('brands')
          .insert(sanitizedData)
          .select()
          .single();

        if (error) throw error;

        await auditLogger.logAction('brands', 'INSERT', data.id, null, sanitizedData);
        toast.success('Brand created successfully');
      }

      setShowBrandModal(false);
      await loadBrands();
      onStatsUpdate();
    } catch (error) {
      console.error('Error saving brand:', error);
      toast.error('Failed to save brand');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBrand = async (brand: Brand) => {
    if (!confirm(`Are you sure you want to delete "${brand.name}"?`)) {
      return;
    }

    if (brand.product_count && brand.product_count > 0) {
      toast.error('Cannot delete brand with associated products');
      return;
    }

    try {
      const { error } = await supabase
        .from('brands')
        .delete()
        .eq('id', brand.id);

      if (error) throw error;

      await auditLogger.logAction('brands', 'DELETE', brand.id, brand, null);
      toast.success('Brand deleted successfully');
      await loadBrands();
      onStatsUpdate();
    } catch (error) {
      console.error('Error deleting brand:', error);
      toast.error('Failed to delete brand');
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedBrands.length === 0) {
      toast.error('Please select brands first');
      return;
    }

    if (!confirm(`Apply ${action} to ${selectedBrands.length} selected brands?`)) {
      return;
    }

    try {
      let updateData: Partial<Brand> = {};

      switch (action) {
        case 'activate':
          updateData = { is_active: true };
          break;
        case 'deactivate':
          updateData = { is_active: false };
          break;
        case 'feature':
          updateData = { is_featured: true };
          break;
        case 'unfeature':
          updateData = { is_featured: false };
          break;
        case 'delete':
          // Check if any selected brands have products
          const brandsWithProducts = brands.filter(b => 
            selectedBrands.includes(b.id) && (b.product_count || 0) > 0
          );
          
          if (brandsWithProducts.length > 0) {
            toast.error('Cannot delete brands with associated products');
            return;
          }

          const { error: deleteError } = await supabase
            .from('brands')
            .delete()
            .in('id', selectedBrands);
          
          if (deleteError) throw deleteError;
          
          toast.success(`Deleted ${selectedBrands.length} brands`);
          setSelectedBrands([]);
          await loadBrands();
          onStatsUpdate();
          return;
      }

      const { error } = await supabase
        .from('brands')
        .update(updateData)
        .in('id', selectedBrands);

      if (error) throw error;

      toast.success(`Updated ${selectedBrands.length} brands`);
      setSelectedBrands([]);
      await loadBrands();
      onStatsUpdate();
    } catch (error) {
      console.error('Error performing bulk action:', error);
      toast.error('Failed to perform bulk action');
    }
  };

  const handleMoveBrand = async (brandId: string, direction: 'up' | 'down') => {
    try {
      const brand = brands.find(b => b.id === brandId);
      if (!brand) return;

      const currentIndex = brands.findIndex(b => b.id === brandId);
      
      if (direction === 'up' && currentIndex === 0) return;
      if (direction === 'down' && currentIndex === brands.length - 1) return;

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      const targetBrand = brands[targetIndex];

      // Swap sort orders
      await supabase
        .from('brands')
        .update({ sort_order: targetBrand.sort_order })
        .eq('id', brandId);

      await supabase
        .from('brands')
        .update({ sort_order: brand.sort_order })
        .eq('id', targetBrand.id);

      await loadBrands();
      toast.success('Brand order updated');
    } catch (error) {
      console.error('Error moving brand:', error);
      toast.error('Failed to update brand order');
    }
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Building className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{analytics.totalBrands}</p>
                <p className="text-sm text-muted-foreground">Total Brands</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{analytics.activeBrands}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{analytics.featuredBrands}</p>
                <p className="text-sm text-muted-foreground">Featured</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{analytics.brandsWithProducts}</p>
                <p className="text-sm text-muted-foreground">With Products</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{analytics.totalProducts}</p>
                <p className="text-sm text-muted-foreground">Total Products</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Brand Management</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              >
                {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
              </Button>
              <Button onClick={handleCreateBrand} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Brand
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <Input
                placeholder="Search brands..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div>
              <select
                value={featuredFilter}
                onChange={(e) => setFeaturedFilter(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="all">All Brands</option>
                <option value="featured">Featured</option>
                <option value="not_featured">Not Featured</option>
              </select>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedBrands.length > 0 && (
            <div className="flex items-center gap-2 p-4 bg-muted rounded-lg mt-4">
              <span className="text-sm font-medium">
                {selectedBrands.length} brands selected
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
        </CardContent>
      </Card>

      {/* Brands Display */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedBrands.length === filteredBrands.length}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedBrands(filteredBrands.map(b => b.id));
                      } else {
                        setSelectedBrands([]);
                      }
                    }}
                  />
                </TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Website</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBrands.map((brand, index) => (
                <TableRow key={brand.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedBrands.includes(brand.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedBrands(prev => [...prev, brand.id]);
                        } else {
                          setSelectedBrands(prev => prev.filter(id => id !== brand.id));
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted">
                        {brand.logo_url ? (
                          <img
                            src={brand.logo_url}
                            alt={brand.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Building className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{brand.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {brand.description && brand.description.length > 50 
                            ? `${brand.description.substring(0, 50)}...` 
                            : brand.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {brand.is_featured && (
                            <Badge variant="secondary" className="text-xs">
                              Featured
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{brand.product_count || 0}</span>
                  </TableCell>
                  <TableCell>
                    {brand.website_url ? (
                      <a 
                        href={brand.website_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        Visit
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {brand.is_active ? (
                      <Badge variant="default">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveBrand(brand.id, 'up')}
                        disabled={index === 0}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveBrand(brand.id, 'down')}
                        disabled={index === filteredBrands.length - 1}
                      >
                        <ArrowDown className="h-3 w-3" />
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
                        <DropdownMenuItem onClick={() => handleEditBrand(brand)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Eye className="h-4 w-4 mr-2" />
                          View Products
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={() => handleDeleteBrand(brand)}
                          disabled={(brand.product_count || 0) > 0}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Brand Form Modal */}
      <Dialog open={showBrandModal} onOpenChange={setShowBrandModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBrand ? 'Edit Brand' : 'Create Brand'}
            </DialogTitle>
            <DialogDescription>
              {editingBrand ? 'Update brand information and settings' : 'Create a new product brand with details and settings'}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="space-y-4">
            <TabsList>
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="media">Media</TabsTrigger>
              <TabsTrigger value="heritage">Heritage</TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div>
                <Label htmlFor="name">Brand Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className={formErrors.name ? 'border-red-500' : ''}
                />
                {formErrors.name && <p className="text-sm text-red-500 mt-1">{formErrors.name}</p>}
              </div>

              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className={formErrors.description ? 'border-red-500' : ''}
                />
                {formErrors.description && <p className="text-sm text-red-500 mt-1">{formErrors.description}</p>}
              </div>

              <div>
                <Label htmlFor="website_url">Website URL</Label>
                <Input
                  id="website_url"
                  type="url"
                  value={formData.website_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, website_url: e.target.value }))}
                  placeholder="https://example.com"
                  className={formErrors.website_url ? 'border-red-500' : ''}
                />
                {formErrors.website_url && <p className="text-sm text-red-500 mt-1">{formErrors.website_url}</p>}
              </div>
            </TabsContent>

            <TabsContent value="media" className="space-y-4">
              <div>
                <Label>Brand Logo</Label>
                <p className="text-sm text-muted-foreground mb-2">Upload or select a logo for this brand</p>
                <ImageUpload
                  imageUrl={formData.logo_url || null}
                  onImageUrlChange={(url: string | null) => setFormData(prev => ({ ...prev, logo_url: url || '' }))}
                  showSelector={true}
                />
              </div>
            </TabsContent>

            <TabsContent value="heritage" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="founded_year">Founded Year</Label>
                  <Input
                    id="founded_year"
                    value={formData.heritage.founded_year || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      heritage: { ...prev.heritage, founded_year: e.target.value }
                    }))}
                    placeholder="e.g., 1924"
                  />
                </div>

                <div>
                  <Label htmlFor="origin_country">Origin Country</Label>
                  <Input
                    id="origin_country"
                    value={formData.heritage.origin_country || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      heritage: { ...prev.heritage, origin_country: e.target.value }
                    }))}
                    placeholder="e.g., United States"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="founder">Founder</Label>
                <Input
                  id="founder"
                  value={formData.heritage.founder || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    heritage: { ...prev.heritage, founder: e.target.value }
                  }))}
                  placeholder="e.g., John Smith"
                />
              </div>

              <div>
                <Label htmlFor="story">Brand Story</Label>
                <Textarea
                  id="story"
                  rows={4}
                  value={formData.heritage.story || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    heritage: { ...prev.heritage, story: e.target.value }
                  }))}
                  placeholder="Tell the story of this brand..."
                />
              </div>
            </TabsContent>

            <TabsContent value="seo" className="space-y-4">
              <div>
                <Label htmlFor="meta_title">Meta Title</Label>
                <Input
                  id="meta_title"
                  value={formData.meta_title}
                  onChange={(e) => setFormData(prev => ({ ...prev, meta_title: e.target.value }))}
                  placeholder="SEO title for search engines"
                />
              </div>

              <div>
                <Label htmlFor="meta_description">Meta Description</Label>
                <Textarea
                  id="meta_description"
                  rows={3}
                  value={formData.meta_description}
                  onChange={(e) => setFormData(prev => ({ ...prev, meta_description: e.target.value }))}
                  placeholder="SEO description for search engines"
                />
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Active</Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="is_featured">Featured</Label>
                  <Switch
                    id="is_featured"
                    checked={formData.is_featured}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_featured: checked }))}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setShowBrandModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveBrand} disabled={isSaving}>
              {isSaving ? 'Saving...' : editingBrand ? 'Update Brand' : 'Create Brand'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

