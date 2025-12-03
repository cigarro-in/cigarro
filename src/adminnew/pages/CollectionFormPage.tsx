import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, LayoutGrid, Trash2 } from 'lucide-react';
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

interface Collection {
  id: string;
  title: string;
  slug: string;
  description?: string;
  image_url?: string;
  is_active: boolean;
  display_order: number;
  meta_title?: string;
  meta_description?: string;
}

interface CollectionFormData {
  title: string;
  slug: string;
  description: string;
  image_url: string[];
  is_active: boolean;
  display_order: number;
  meta_title: string;
  meta_description: string;
}

export function CollectionFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const [formData, setFormData] = useState<CollectionFormData>({
    title: '',
    slug: '',
    description: '',
    image_url: [],
    is_active: true,
    display_order: 1,
    meta_title: '',
    meta_description: ''
  });

  useEffect(() => {
    if (isEditMode) {
      loadCollection();
      setIsSlugManuallyEdited(true);
    } else {
      // Get next display order for new collections
      getNextDisplayOrder();
    }
  }, [id]);

  useEffect(() => {
    setIsDirty(true);
  }, [formData]);

  useEffect(() => {
    setIsDirty(false);
  }, []);

  const getNextDisplayOrder = async () => {
    try {
      const { data, error } = await supabase
        .from('collections')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      const nextOrder = (data?.length || 0) + 1;
      setFormData(prev => ({ ...prev, display_order: nextOrder }));
    } catch (error) {
      console.error('Error getting next display order:', error);
      setFormData(prev => ({ ...prev, display_order: 1 }));
    }
  };

  const loadCollection = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setFormData({
        title: data.title || '',
        slug: data.slug || '',
        description: data.description || '',
        image_url: data.image_url ? [data.image_url] : [],
        is_active: data.is_active !== false,
        display_order: data.display_order || 1,
        meta_title: data.meta_title || '',
        meta_description: data.meta_description || ''
      });

      // Load associated products
      const { data: productData, error: productError } = await supabase
        .from('collection_products')
        .select('product_id')
        .eq('collection_id', id);

      if (productError) throw productError;
      
      setSelectedProductIds(productData?.map(p => p.product_id) || []);
    } catch (error) {
      console.error('Error loading collection:', error);
      toast.error('Failed to load collection');
    } finally {
      setLoading(false);
    }
  };

  const handleTitleChange = (title: string) => {
    setFormData(prev => ({ ...prev, title }));
    // Auto-generate slug only if not manually edited
    if (!isSlugManuallyEdited) {
      setFormData(prev => ({ ...prev, slug: generateSlug(title) }));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSlugManuallyEdited(true);
    setFormData(prev => ({ ...prev, slug: generateSlug(e.target.value) }));
  };

  const handleChange = (updates: Partial<CollectionFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error('Collection title is required');
      return;
    }

    setSaving(true);
    try {
      const collectionData = {
        title: formData.title.trim(),
        slug: formData.slug.trim(),
        description: formData.description.trim(),
        image_url: formData.image_url[0] || null,
        is_active: formData.is_active,
        display_order: formData.display_order,
        meta_title: formData.meta_title.trim() || formData.title.trim(),
        meta_description: formData.meta_description.trim()
      };

      let collectionId = id;

      if (isEditMode) {
        const { error } = await supabase
          .from('collections')
          .update(collectionData)
          .eq('id', id);

        if (error) throw error;
        collectionId = id;
        toast.success('Collection updated successfully');
      } else {
        const { data: newCollection, error } = await supabase
          .from('collections')
          .insert([collectionData])
          .select()
          .single();

        if (error) throw error;
        collectionId = newCollection.id;
        toast.success('Collection created successfully');
      }

      // Save product associations
      // Delete existing associations
      await supabase
        .from('collection_products')
        .delete()
        .eq('collection_id', collectionId);

      // Insert new associations
      if (selectedProductIds.length > 0) {
        const { error: associationError } = await supabase
          .from('collection_products')
          .insert(
            selectedProductIds.map(productId => ({
              collection_id: collectionId,
              product_id: productId
            }))
          );

        if (associationError) throw associationError;
      }

      navigate('/admin/collections');
    } catch (error: any) {
      console.error('Error saving collection:', error);
      toast.error(error.message || 'Failed to save collection');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this collection?')) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('collections')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Collection deleted successfully');
      navigate('/admin/collections');
    } catch (error) {
      console.error('Error deleting collection:', error);
      toast.error('Failed to delete collection');
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
    <div className="w-full min-h-screen bg-[var(--color-creme)] pb-20">
      {/* Header */}
      <PageHeader
        title={formData.title || 'Untitled Collection'}
        description={isEditMode ? 'Edit collection' : 'Create new collection'}
        backUrl="/admin/collections"
      >
        <Button 
          variant="outline" 
          onClick={() => navigate('/admin/collections')}
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
              {isEditMode ? 'Update' : 'Create'} Collection
            </>
          )}
        </Button>
      </PageHeader>

      <div className="max-w-[1600px] mx-auto px-6 grid grid-cols-[1fr_350px] gap-6 mt-6">
        
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Basic Information */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Collection Identity</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              
              {/* Title */}
              <div className="space-y-2">
                <Label className="text-[var(--color-dark)] font-medium">
                  Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g. Premium Selection"
                  className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)] text-lg py-6"
                />
              </div>

              {/* Slug */}
              <div className="grid grid-cols-[auto_1fr] gap-2 items-center text-sm text-[var(--color-dark)]/60 bg-[var(--color-creme)]/50 p-3 rounded-md border border-[var(--color-coyote)]/30">
                <span className="font-medium">store.cigarro.in/collections/</span>
                <input
                  value={formData.slug}
                  onChange={handleSlugChange}
                  className="bg-transparent border-none focus:outline-none text-[var(--color-dark)] font-medium w-full"
                  placeholder="collection-slug"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label className="text-[var(--color-dark)] font-medium">Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => handleChange({ description: e.target.value })}
                  placeholder="Describe the collection..."
                  rows={4}
                  className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
                />
              </div>

              {/* Image */}
              <div className="space-y-2">
                <Label className="text-[var(--color-dark)] font-medium">Collection Image</Label>
                <SingleImagePicker
                  value={formData.image_url[0] || null}
                  onChange={(url) => handleChange({ image_url: url ? [url] : [] })}
                />
              </div>

              {/* Display Order */}
              <div className="space-y-2">
                <Label className="text-[var(--color-dark)] font-medium">Display Order</Label>
                <Input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => handleChange({ display_order: parseInt(e.target.value) || 1 })}
                  placeholder="1"
                  className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
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

          {/* Status & SEO */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>SEO Settings</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <div className="space-y-2">
                <Label htmlFor="meta_title">Meta Title</Label>
                <Input
                  id="meta_title"
                  value={formData.meta_title}
                  onChange={(e) => handleChange({ meta_title: e.target.value })}
                  placeholder="SEO title (defaults to collection title)"
                  className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meta_description">Meta Description</Label>
                <Textarea
                  id="meta_description"
                  value={formData.meta_description}
                  onChange={(e) => handleChange({ meta_description: e.target.value })}
                  placeholder="SEO description"
                  rows={3}
                  className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
                />
              </div>
            </AdminCardContent>
          </AdminCard>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* Status */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Status</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Active</Label>
                  <p className="text-sm text-gray-500">Collection is visible to customers</p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => handleChange({ is_active: checked })}
                />
              </div>
            </AdminCardContent>
          </AdminCard>

          {/* Preview */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Preview</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
                    {formData.image_url[0] ? (
                      <img
                        src={formData.image_url[0]}
                        alt="Collection"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <LayoutGrid className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {formData.title || 'Collection Title'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formData.description || 'Collection description'}
                    </div>
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
