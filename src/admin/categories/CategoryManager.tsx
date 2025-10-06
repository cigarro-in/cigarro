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
  Tag
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../../components/ui/dropdown-menu';
import { Checkbox } from '../../components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Separator } from '../../components/ui/separator';
import { EnhancedImageUpload } from '../../components/ui/EnhancedImageUpload';
import { supabase } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { sanitizer } from '../../utils/validation';
import { auditLogger } from '../../utils/audit-logger';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  image_alt_text?: string;
  parent_id?: string;
  sort_order: number;
  is_active: boolean;
  is_featured: boolean;
  meta_title?: string;
  meta_description?: string;
  created_at: string;
  updated_at: string;
  product_count?: number;
  parent?: Category;
  children?: Category[];
}

interface CategoryFormData {
  name: string;
  description: string;
  image_url: string | null;
  image_alt_text: string;
  parent_id: string;
  is_active: boolean;
  is_featured: boolean;
  meta_title: string;
  meta_description: string;
}

interface EnhancedCategoryManagerProps {
  onStatsUpdate: () => void;
}

export default function EnhancedCategoryManager({ onStatsUpdate }: EnhancedCategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [featuredFilter, setFeaturedFilter] = useState<'all' | 'featured' | 'not_featured'>('all');
  const [parentFilter, setParentFilter] = useState<string>('all');
  
  // Form state
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    description: '',
    image_url: null,
    image_alt_text: '',
    parent_id: 'none',
    is_active: true,
    is_featured: false,
    meta_title: '',
    meta_description: ''
  });
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Analytics
  const [analytics, setAnalytics] = useState({
    totalCategories: 0,
    activeCategories: 0,
    featuredCategories: 0,
    parentCategories: 0,
    subcategories: 0
  });

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    filterCategories();
    calculateAnalytics();
  }, [categories, searchTerm, statusFilter, featuredFilter, parentFilter]);

  const loadCategories = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select(`
          *,
          product_count:product_categories(count)
        `)
        .order('created_at', { ascending: true });

      if (error) {
        // If the relationship doesn't exist, try without it
        console.warn('Product count relationship not found, loading categories without counts');
        const { data: simpleData, error: simpleError } = await supabase
          .from('categories')
          .select('*')
          .order('created_at', { ascending: true });
        
        if (simpleError) throw simpleError;
        
        const processedCategories = (simpleData || []).map(category => ({
          ...category,
          product_count: 0
        }));
        
        setCategories(processedCategories);
        return;
      }

      // Process the data to include product counts
      const processedCategories = (data || []).map(category => ({
        ...category,
        product_count: category.product_count?.[0]?.count || 0
      }));

      setCategories(processedCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  };

  const filterCategories = () => {
    let filtered = [...categories];

    if (searchTerm) {
      filtered = filtered.filter(category =>
        category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        category.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(category => category.is_active === (statusFilter === 'active'));
    }

    if (featuredFilter !== 'all') {
      filtered = filtered.filter(category => category.is_featured === (featuredFilter === 'featured'));
    }

    if (parentFilter !== 'all') {
      if (parentFilter === 'root') {
        filtered = filtered.filter(category => !category.parent_id);
      } else {
        filtered = filtered.filter(category => category.parent_id === parentFilter);
      }
    }

    setFilteredCategories(filtered);
  };

  const calculateAnalytics = () => {
    const totalCategories = categories.length;
    const activeCategories = categories.filter(c => c.is_active).length;
    const featuredCategories = categories.filter(c => c.is_featured).length;
    const parentCategories = categories.filter(c => !c.parent_id).length;
    const subcategories = categories.filter(c => c.parent_id).length;

    setAnalytics({
      totalCategories,
      activeCategories,
      featuredCategories,
      parentCategories,
      subcategories
    });
  };

  const handleCreateCategory = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      image_url: '',
      image_alt_text: '',
      parent_id: 'none',
      is_active: true,
      is_featured: false,
      meta_title: '',
      meta_description: ''
    });
    setFormErrors({});
    setShowCategoryModal(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      image_url: category.image_url || '',
      image_alt_text: category.image_alt_text || '',
      parent_id: category.parent_id || 'none',
      is_active: category.is_active,
      is_featured: category.is_featured,
      meta_title: category.meta_title || '',
      meta_description: category.meta_description || ''
    });
    setFormErrors({});
    setShowCategoryModal(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Category name is required';
    }

    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    }

    // Check for circular reference
    if (editingCategory && formData.parent_id === editingCategory.id) {
      errors.parent_id = 'Category cannot be its own parent';
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

  const handleSaveCategory = async () => {
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
        image_alt_text: sanitizer.sanitizeText(formData.image_alt_text),
        meta_title: sanitizer.sanitizeText(formData.meta_title),
        meta_description: sanitizer.sanitizeText(formData.meta_description),
        slug: generateSlug(formData.name),
        parent_id: formData.parent_id === 'none' ? null : formData.parent_id || null,
        sort_order: editingCategory?.sort_order || categories.length
      };

      if (editingCategory) {
        // Update existing category
        const { error } = await supabase
          .from('categories')
          .update(sanitizedData)
          .eq('id', editingCategory.id);

        if (error) throw error;

        await auditLogger.logAction('categories', 'UPDATE', editingCategory.id, editingCategory, sanitizedData);
        toast.success('Category updated successfully');
      } else {
        // Create new category
        const { data, error } = await supabase
          .from('categories')
          .insert(sanitizedData)
          .select()
          .single();

        if (error) throw error;

        await auditLogger.logAction('categories', 'INSERT', data.id, null, sanitizedData);
        toast.success('Category created successfully');
      }

      setShowCategoryModal(false);
      await loadCategories();
      onStatsUpdate();
    } catch (error) {
      console.error('Error saving category:', error);
      toast.error('Failed to save category');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    if (!confirm(`Are you sure you want to delete "${category.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', category.id);

      if (error) throw error;

      await auditLogger.logAction('categories', 'DELETE', category.id, category, null);
      toast.success('Category deleted successfully');
      await loadCategories();
      onStatsUpdate();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Failed to delete category');
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedCategories.length === 0) {
      toast.error('Please select categories first');
      return;
    }

    if (!confirm(`Apply ${action} to ${selectedCategories.length} selected categories?`)) {
      return;
    }

    try {
      let updateData: Partial<Category> = {};

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
          const { error: deleteError } = await supabase
            .from('categories')
            .delete()
            .in('id', selectedCategories);
          
          if (deleteError) throw deleteError;
          
          toast.success(`Deleted ${selectedCategories.length} categories`);
          setSelectedCategories([]);
          await loadCategories();
          onStatsUpdate();
          return;
      }

      const { error } = await supabase
        .from('categories')
        .update(updateData)
        .in('id', selectedCategories);

      if (error) throw error;

      toast.success(`Updated ${selectedCategories.length} categories`);
      setSelectedCategories([]);
      await loadCategories();
      onStatsUpdate();
    } catch (error) {
      console.error('Error performing bulk action:', error);
      toast.error('Failed to perform bulk action');
    }
  };

  const handleMoveCategory = async (categoryId: string, direction: 'up' | 'down') => {
    try {
      const category = categories.find(c => c.id === categoryId);
      if (!category) return;

      const siblings = categories.filter(c => c.parent_id === category.parent_id);
      const currentIndex = siblings.findIndex(c => c.id === categoryId);
      
      if (direction === 'up' && currentIndex === 0) return;
      if (direction === 'down' && currentIndex === siblings.length - 1) return;

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      const targetCategory = siblings[targetIndex];

      // Swap sort orders
      await supabase
        .from('categories')
        .update({ sort_order: targetCategory.sort_order })
        .eq('id', categoryId);

      await supabase
        .from('categories')
        .update({ sort_order: category.sort_order })
        .eq('id', targetCategory.id);

      await loadCategories();
      toast.success('Category order updated');
    } catch (error) {
      console.error('Error moving category:', error);
      toast.error('Failed to update category order');
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
              <Tag className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{analytics.totalCategories}</p>
                <p className="text-sm text-muted-foreground">Total Categories</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{analytics.activeCategories}</p>
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
                <p className="text-2xl font-bold">{analytics.featuredCategories}</p>
                <p className="text-sm text-muted-foreground">Featured</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{analytics.parentCategories}</p>
                <p className="text-sm text-muted-foreground">Parent Categories</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{analytics.subcategories}</p>
                <p className="text-sm text-muted-foreground">Subcategories</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Category Management</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              >
                {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
              </Button>
              <Button onClick={handleCreateCategory} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Category
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <Input
                placeholder="Search categories..."
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

            <Select value={featuredFilter} onValueChange={(value: any) => setFeaturedFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Featured" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="featured">Featured</SelectItem>
                <SelectItem value="not_featured">Not Featured</SelectItem>
              </SelectContent>
            </Select>

            <Select value={parentFilter} onValueChange={setParentFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="root">Parent Categories</SelectItem>
                {categories.filter(c => !c.parent_id).map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    Subcategories of {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Actions */}
          {selectedCategories.length > 0 && (
            <div className="flex items-center gap-2 p-4 bg-muted rounded-lg mt-4">
              <span className="text-sm font-medium">
                {selectedCategories.length} categories selected
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

      {/* Categories Display */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedCategories.length === filteredCategories.length}
                    onCheckedChange={(checked: boolean) => {
                      if (checked) {
                        setSelectedCategories(filteredCategories.map(c => c.id));
                      } else {
                        setSelectedCategories([]);
                      }
                    }}
                  />
                </TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCategories.map((category, index) => (
                <TableRow key={category.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedCategories.includes(category.id)}
                      onCheckedChange={(checked: boolean) => {
                        if (checked) {
                          setSelectedCategories(prev => [...prev, category.id]);
                        } else {
                          setSelectedCategories(prev => prev.filter(id => id !== category.id));
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted">
                        {category.image_url ? (
                          <img
                            src={category.image_url}
                            alt={category.image_alt_text || category.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Tag className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{category.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {category.description && category.description.length > 50 
                            ? `${category.description.substring(0, 50)}...` 
                            : category.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {category.is_featured && (
                            <Badge variant="secondary" className="text-xs">
                              Featured
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {category.parent ? (
                      <span className="text-sm">{category.parent.name}</span>
                    ) : (
                      <Badge variant="outline" className="text-xs">Root</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{category.product_count || 0}</span>
                  </TableCell>
                  <TableCell>
                    {category.is_active ? (
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
                        onClick={() => handleMoveCategory(category.id, 'up')}
                        disabled={index === 0}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveCategory(category.id, 'down')}
                        disabled={index === filteredCategories.length - 1}
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
                        <DropdownMenuItem onClick={() => handleEditCategory(category)}>
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
                          onClick={() => handleDeleteCategory(category)}
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

      {/* Category Form Modal */}
      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Edit Category' : 'Create Category'}
            </DialogTitle>
            <DialogDescription>
              {editingCategory ? 'Update category information and settings' : 'Create a new product category with details and settings'}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="space-y-4">
            <TabsList>
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="media">Media</TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div>
                <Label htmlFor="name">Category Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className={formErrors.name ? 'border-red-500' : ''}
                />
                {formErrors.name && (
                  <p className="text-sm text-red-500 mt-1">{formErrors.name}</p>
                )}
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
                {formErrors.description && (
                  <p className="text-sm text-red-500 mt-1">{formErrors.description}</p>
                )}
              </div>

              <div>
                <Label htmlFor="parent_id">Parent Category</Label>
                <Select 
                  value={formData.parent_id} 
                  onValueChange={(value: string) => setFormData(prev => ({ ...prev, parent_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent category (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Parent (Root Category)</SelectItem>
                    {categories
                      .filter(c => !c.parent_id && c.id !== editingCategory?.id)
                      .map(category => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {formErrors.parent_id && (
                  <p className="text-sm text-red-500 mt-1">{formErrors.parent_id}</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="media" className="space-y-4">
              <EnhancedImageUpload
                imageUrl={formData.image_url}
                onImageUrlChange={(url) => setFormData(prev => ({ ...prev, image_url: url }))}
                title="Category Image"
                description="Upload or select an image for this category"
                aspectRatio="square"
              />

              <div>
                <Label htmlFor="image_alt_text">Image Alt Text</Label>
                <Input
                  id="image_alt_text"
                  value={formData.image_alt_text}
                  onChange={(e) => setFormData(prev => ({ ...prev, image_alt_text: e.target.value }))}
                  placeholder="Descriptive text for accessibility"
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
                    onCheckedChange={(checked: boolean) => setFormData(prev => ({ ...prev, is_active: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="is_featured">Featured</Label>
                  <Switch
                    id="is_featured"
                    checked={formData.is_featured}
                    onCheckedChange={(checked: boolean) => setFormData(prev => ({ ...prev, is_featured: checked }))}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setShowCategoryModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCategory} disabled={isSaving}>
              {isSaving ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
