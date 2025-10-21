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
  image?: string;
  image_alt_text?: string;
  meta_title?: string;
  meta_description?: string;
  created_at: string;
  updated_at: string;
  product_count?: number;
}

interface CategoryFormData {
  name: string;
  description: string;
  image: string | null;
  image_alt_text: string;
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
  
  // Form state
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    description: '',
    image: null,
    image_alt_text: '',
    meta_title: '',
    meta_description: ''
  });
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Analytics
  const [analytics, setAnalytics] = useState({
    totalCategories: 0
  });

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    filterCategories();
    calculateAnalytics();
  }, [categories, searchTerm]);

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

    setFilteredCategories(filtered);
  };

  const calculateAnalytics = () => {
    const totalCategories = categories.length;

    setAnalytics({
      totalCategories
    });
  };

  const handleCreateCategory = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      image: '',
      image_alt_text: '',
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
      image: category.image || '',
      image_alt_text: category.image_alt_text || '',
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
      // Only send fields that exist in the database schema
      const sanitizedData = {
        name: sanitizer.sanitizeText(formData.name),
        slug: generateSlug(formData.name),
        description: sanitizer.sanitizeText(formData.description),
        image: formData.image || null,
        image_alt_text: sanitizer.sanitizeText(formData.image_alt_text),
        meta_title: sanitizer.sanitizeText(formData.meta_title),
        meta_description: sanitizer.sanitizeText(formData.meta_description)
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

  const handleBulkDelete = async () => {
    if (selectedCategories.length === 0) {
      toast.error('Please select categories first');
      return;
    }

    if (!confirm(`Delete ${selectedCategories.length} selected categories?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .in('id', selectedCategories);
      
      if (error) throw error;
      
      toast.success(`Deleted ${selectedCategories.length} categories`);
      setSelectedCategories([]);
      await loadCategories();
      onStatsUpdate();
    } catch (error) {
      console.error('Error deleting categories:', error);
      toast.error('Failed to delete categories');
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <ImageIcon className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{categories.filter(c => c.image).length}</p>
                <p className="text-sm text-muted-foreground">With Images</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{categories.filter(c => c.product_count && c.product_count > 0).length}</p>
                <p className="text-sm text-muted-foreground">With Products</p>
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
          <div className="w-full">
            <Input
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Bulk Actions */}
          {selectedCategories.length > 0 && (
            <div className="flex items-center gap-2 p-4 bg-muted rounded-lg mt-4">
              <span className="text-sm font-medium">
                {selectedCategories.length} categories selected
              </span>
              <Separator orientation="vertical" className="h-4" />
              <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected
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
                <TableHead>Products</TableHead>
                <TableHead>Created</TableHead>
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
                        {category.image ? (
                          <img
                            src={category.image}
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
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{category.product_count || 0}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {new Date(category.created_at).toLocaleDateString()}
                    </span>
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
            </TabsContent>

            <TabsContent value="media" className="space-y-4">
              <EnhancedImageUpload
                imageUrl={formData.image}
                onImageUrlChange={(url) => setFormData(prev => ({ ...prev, image: url }))}
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
