import { useState, useEffect, useRef } from 'react';
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
import { Req, ReqError, isBlank } from '../components/shared/requiredFields';
import { PageHeader } from '../components/shared/PageHeader';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
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

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [saveAttempted, setSaveAttempted] = useState(false);

  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    slug: '',
    description: '',
    image: [],
    meta_title: '',
    meta_description: ''
  });

  const categoryRows = useQuery(api.adminCatalog.listCategoriesForAdmin, {});
  const createCategory = useMutation(api.adminCatalog.createCategory);
  const updateCategory = useMutation(api.adminCatalog.updateCategory);
  const removeCategory = useMutation(api.adminCatalog.deleteCategory);
  const linkProducts = useMutation(api.adminCatalog.setCategoryProducts);
  const populatedRef = useRef(false);

  useEffect(() => {
    if (isEditMode) setIsSlugManuallyEdited(true);
  }, [id]);

  // Populate once from the Convex admin list (carries linked product ids).
  useEffect(() => {
    if (!isEditMode || !categoryRows || populatedRef.current) return;
    populatedRef.current = true;
    const data: any = categoryRows.find((c: any) => c.supabaseId === id);
    if (!data) {
      toast.error('Category not found');
      navigate('/admin/categories');
      return;
    }
    setFormData({
      name: data.name || '',
      slug: data.slug || '',
      description: data.description || '',
      image: data.image ? [data.image] : [],
      meta_title: data.metaTitle || '',
      meta_description: data.metaDescription || ''
    });
    setSelectedProductIds(data.productSupabaseIds || []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryRows]);

  useEffect(() => {
    setIsDirty(true);
  }, [formData]);

  useEffect(() => {
    setIsDirty(false);
  }, []);

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
    setSaveAttempted(true);
    if (!formData.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    setSaving(true);
    try {
      const args = {
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        description: formData.description.trim() || undefined,
        image: formData.image[0] || undefined,
        metaTitle: formData.meta_title.trim() || formData.name.trim(),
        metaDescription: formData.meta_description.trim() || undefined,
      };

      let categoryId = id;
      if (isEditMode) {
        await updateCategory({ supabaseId: id!, patch: args });
        toast.success('Category updated successfully');
      } else {
        const { supabaseId } = await createCategory(args);
        categoryId = supabaseId;
        toast.success('Category created successfully');
      }

      // Replace product links (same replace-set semantics as before).
      await linkProducts({ supabaseId: categoryId!, productSupabaseIds: selectedProductIds });

      navigate('/admin/categories');
    } catch (error: any) {
      console.error('Error saving category:', error);
      const code = error?.data?.code;
      toast.error(
        code === 'SLUG_TAKEN'
          ? 'Slug is taken by another category'
          : code === 'NOT_CATALOG_ADMIN'
            ? 'Admin access required'
            : error.message || 'Failed to save category'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    setSaving(true);
    try {
      await removeCategory({ supabaseId: id! });
      toast.success('Category deleted successfully');
      navigate('/admin/categories');
    } catch (error: any) {
      console.error('Error deleting category:', error);
      toast.error(error?.data?.code === 'NOT_CATALOG_ADMIN' ? 'Admin access required' : 'Failed to delete category');
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

      <div className="max-w-[1600px] mx-auto px-6 grid grid-cols-[1fr_350px] gap-6 mt-6">
        
        {/* LEFT COLUMN */}
        <div className="space-y-4">
          {/* Basic Information */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Category Identity</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <div className="space-y-1">
                <Label>Name <Req /></Label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Premium Cigarettes"
                  aria-invalid={saveAttempted && isBlank(formData.name)}
                />
                <ReqError show={saveAttempted && isBlank(formData.name)} />
              </div>

              <div className={`flex items-center gap-1 text-sm text-[var(--color-dark)]/60 bg-[var(--color-creme)] px-3 py-2 rounded border border-[var(--color-coyote)]/30${saveAttempted && isBlank(formData.slug) ? ' border-red-500' : ''}`}>
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
                  searchHint={formData.name ? `${formData.name} category` : undefined}
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
