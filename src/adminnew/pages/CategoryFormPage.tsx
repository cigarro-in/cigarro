import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, FolderTree, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { AdminCard, AdminCardContent, AdminCardHeader, AdminCardTitle } from '../components/shared/AdminCard';
import { Switch } from '../../components/ui/switch';
import { SingleImagePicker } from '../components/shared/ImagePicker';
import { ProductSelector } from '../components/shared/ProductSelector';
import { PageHeader } from '../components/shared/PageHeader';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';
import { generateSlug } from '../../types/product';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  is_active: boolean;
  created_at: string;
  meta_title?: string;
  meta_description?: string;
}

interface CategoryFormData {
  name: string;
  slug: string;
  description: string;
  image: string[];
  meta_title: string;
  meta_description: string;
}

export function CategoryFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    slug: '',
    description: '',
    image: [],
    meta_title: '',
    meta_description: ''
  });

  useEffect(() => {
    if (isEditMode) {
      loadCategory();
      setIsSlugManuallyEdited(true);
    }
  }, [id]);

  useEffect(() => {
    setIsDirty(true);
  }, [formData]);

  useEffect(() => {
    setIsDirty(false);
  }, []);

  const loadCategory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setFormData({
        name: data.name || '',
        slug: data.slug || '',
        description: data.description || '',
        image: data.image ? [data.image] : [],
        meta_title: data.meta_title || '',
        meta_description: data.meta_description || ''
      });

      // Load associated products
      const { data: productData, error: productError } = await supabase
        .from('product_categories')
        .select('product_id')
        .eq('category_id', id);

      if (productError) throw productError;
      
      setSelectedProductIds(productData?.map(p => p.product_id) || []);
    } catch (error) {
      console.error('Error loading category:', error);
      toast.error('Failed to load category');
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({ ...prev, name }));
    // Auto-generate slug only if not manually edited
    if (!isSlugManuallyEdited) {
      setFormData(prev => ({ ...prev, slug: generateSlug(name) }));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSlugManuallyEdited(true);
    setFormData(prev => ({ ...prev, slug: generateSlug(e.target.value) }));
  };

  const handleChange = (updates: Partial<CategoryFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    setSaving(true);
    try {
      const categoryData = {
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        description: formData.description.trim(),
        image: formData.image[0] || null,
        meta_title: formData.meta_title.trim() || formData.name.trim(),
        meta_description: formData.meta_description.trim()
      };

      let categoryId = id;

      if (isEditMode) {
        const { error } = await supabase
          .from('categories')
          .update(categoryData)
          .eq('id', id);

        if (error) throw error;
        categoryId = id;
        toast.success('Category updated successfully');
      } else {
        const { data: newCategory, error } = await supabase
          .from('categories')
          .insert([categoryData])
          .select()
          .single();

        if (error) throw error;
        categoryId = newCategory.id;
        toast.success('Category created successfully');
      }

      // Save product associations
      // Delete existing associations
      await supabase
        .from('product_categories')
        .delete()
        .eq('category_id', categoryId);

      // Insert new associations
      if (selectedProductIds.length > 0) {
        const { error: associationError } = await supabase
          .from('product_categories')
          .insert(
            selectedProductIds.map(productId => ({
              category_id: categoryId,
              product_id: productId
            }))
          );

        if (associationError) throw associationError;
      }

      navigate('/admin/categories');
    } catch (error: any) {
      console.error('Error saving category:', error);
      toast.error(error.message || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Category deleted successfully');
      navigate('/admin/categories');
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Failed to delete category');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-creme)] pb-20">
      {/* Header */}
      <PageHeader
        title={formData.name || 'Untitled Category'}
        description={isEditMode ? 'Edit category' : 'Create new category'}
        backUrl="/admin/categories"
      >
        <Button 
          variant="outline" 
          onClick={() => navigate('/admin/categories')}
        >
          Cancel
        </Button>
        {isEditMode && (
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={saving}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        )}
        <Button 
          onClick={handleSubmit} 
          disabled={saving || !isDirty}
          className="bg-[var(--color-canyon)] hover:bg-[var(--color-canyon)]/90 text-[var(--color-creme)]"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {isEditMode ? 'Update' : 'Create'} Category
            </>
          )}
        </Button>
      </PageHeader>

      <div className="max-w-[1400px] mx-auto px-6 grid grid-cols-[1fr_300px] gap-4 mt-4">
        
        {/* LEFT COLUMN */}
        <div className="space-y-4">
          {/* Basic Information */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Category Identity</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <div className="space-y-1">
                <Label>Name <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Premium Cigarettes"
                />
              </div>

              <div className="flex items-center gap-1 text-sm text-[var(--color-dark)]/60 bg-[var(--color-creme)] px-3 py-2 rounded border border-[var(--color-coyote)]/30">
                <span>store.cigarro.in/categories/</span>
                <input
                  value={formData.slug}
                  onChange={handleSlugChange}
                  className="bg-transparent border-none focus:outline-none text-[var(--color-dark)] font-medium flex-1"
                  placeholder="category-slug"
                />
              </div>

              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => handleChange({ description: e.target.value })}
                  placeholder="Describe the category..."
                  rows={3}
                />
              </div>

              <div className="space-y-1">
                <Label>Category Image</Label>
                <SingleImagePicker
                  value={formData.image[0] || null}
                  onChange={(url) => handleChange({ image: url ? [url] : [] })}
                />
              </div>
            </AdminCardContent>
          </AdminCard>

          {/* Products */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Products</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <ProductSelector
                selectedProductIds={selectedProductIds}
                onSelectionChange={setSelectedProductIds}
              />
            </AdminCardContent>
          </AdminCard>

          {/* SEO */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>SEO Settings</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <div className="space-y-1">
                <Label htmlFor="meta_title">Meta Title</Label>
                <Input
                  id="meta_title"
                  value={formData.meta_title}
                  onChange={(e) => handleChange({ meta_title: e.target.value })}
                  placeholder="SEO title (defaults to category name)"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="meta_description">Meta Description</Label>
                <Textarea
                  id="meta_description"
                  value={formData.meta_description}
                  onChange={(e) => handleChange({ meta_description: e.target.value })}
                  placeholder="SEO description"
                  rows={2}
                />
              </div>
            </AdminCardContent>
          </AdminCard>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-4">
          {/* Status */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle className="text-xs uppercase tracking-wider">Status</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <p className="text-sm text-[var(--color-dark)]/60">
                Categories are always visible once created.
              </p>
            </AdminCardContent>
          </AdminCard>

          {/* Preview */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle className="text-xs uppercase tracking-wider">Preview</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md overflow-hidden bg-[var(--color-creme)] flex-shrink-0">
                  {formData.image[0] ? (
                    <img
                      src={formData.image[0]}
                      alt="Category"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FolderTree className="h-5 w-5 text-[var(--color-dark)]/40" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">
                    {formData.name || 'Category Name'}
                  </div>
                  <div className="text-xs text-[var(--color-dark)]/60 truncate">
                    {formData.description || 'Category description'}
                  </div>
                </div>
              </div>
            </AdminCardContent>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
