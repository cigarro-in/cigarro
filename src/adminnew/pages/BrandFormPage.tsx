import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Building2, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { AdminCard, AdminCardContent, AdminCardHeader, AdminCardTitle } from '../components/shared/AdminCard';
import { Switch } from '../../components/ui/switch';
import { SingleImagePicker } from '../components/shared/ImagePicker';
import { PageHeader } from '../components/shared/PageHeader';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';
import { generateSlug } from '../../types/product';

interface Brand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  country_of_origin: string | null;
  is_active: boolean;
  created_at: string;
  meta_title?: string;
  meta_description?: string;
}

interface BrandFormData {
  name: string;
  slug: string;
  description: string;
  logo_url: string[];
  website_url: string;
  country_of_origin: string;
  is_active: boolean;
  meta_title: string;
  meta_description: string;
}

export function BrandFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);

  const [formData, setFormData] = useState<BrandFormData>({
    name: '',
    slug: '',
    description: '',
    logo_url: [],
    website_url: '',
    country_of_origin: '',
    is_active: true,
    meta_title: '',
    meta_description: ''
  });

  useEffect(() => {
    if (isEditMode) {
      loadBrand();
      setIsSlugManuallyEdited(true);
    }
  }, [id]);

  useEffect(() => {
    setIsDirty(true);
  }, [formData]);

  useEffect(() => {
    setIsDirty(false);
  }, []);

  const loadBrand = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setFormData({
        name: data.name || '',
        slug: data.slug || '',
        description: data.description || '',
        logo_url: data.logo_url ? [data.logo_url] : [],
        website_url: data.website_url || '',
        country_of_origin: data.country_of_origin || '',
        is_active: data.is_active !== false,
        meta_title: data.meta_title || '',
        meta_description: data.meta_description || ''
      });
    } catch (error) {
      console.error('Error loading brand:', error);
      toast.error('Failed to load brand');
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

  const handleChange = (updates: Partial<BrandFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Brand name is required');
      return;
    }

    setSaving(true);
    try {
      const brandData = {
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        description: formData.description.trim(),
        logo_url: formData.logo_url[0] || null,
        website_url: formData.website_url.trim() || null,
        country_of_origin: formData.country_of_origin.trim() || null,
        is_active: formData.is_active,
        meta_title: formData.meta_title.trim() || formData.name.trim(),
        meta_description: formData.meta_description.trim()
      };

      if (isEditMode) {
        const { error } = await supabase
          .from('brands')
          .update(brandData)
          .eq('id', id);

        if (error) throw error;
        toast.success('Brand updated successfully');
      } else {
        const { error } = await supabase
          .from('brands')
          .insert([brandData]);

        if (error) throw error;
        toast.success('Brand created successfully');
      }

      navigate('/admin/brands');
    } catch (error: any) {
      console.error('Error saving brand:', error);
      toast.error(error.message || 'Failed to save brand');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this brand?')) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('brands')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Brand deleted successfully');
      navigate('/admin/brands');
    } catch (error) {
      console.error('Error deleting brand:', error);
      toast.error('Failed to delete brand');
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
        title={formData.name || 'Untitled Brand'}
        description={isEditMode ? 'Edit brand' : 'Create new brand'}
        backUrl="/admin/brands"
      >
        <Button 
          variant="outline" 
          onClick={() => navigate('/admin/brands')}
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
              {isEditMode ? 'Update' : 'Create'} Brand
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
              <AdminCardTitle>Brand Identity</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <div className="space-y-1">
                <Label>Name <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Marlboro"
                />
              </div>

              <div className="flex items-center gap-1 text-sm text-[var(--color-dark)]/60 bg-[var(--color-creme)] px-3 py-2 rounded border border-[var(--color-coyote)]/30">
                <span>store.cigarro.in/brands/</span>
                <input
                  value={formData.slug}
                  onChange={handleSlugChange}
                  className="bg-transparent border-none focus:outline-none text-[var(--color-dark)] font-medium flex-1"
                  placeholder="brand-slug"
                />
              </div>

              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => handleChange({ description: e.target.value })}
                  placeholder="Describe the brand..."
                  rows={3}
                />
              </div>

              <div className="space-y-1">
                <Label>Brand Logo</Label>
                <SingleImagePicker
                  value={formData.logo_url[0] || null}
                  onChange={(url) => handleChange({ logo_url: url ? [url] : [] })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Website</Label>
                  <Input
                    value={formData.website_url}
                    onChange={(e) => handleChange({ website_url: e.target.value })}
                    placeholder="https://example.com"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Country of Origin</Label>
                  <Input
                    value={formData.country_of_origin}
                    onChange={(e) => handleChange({ country_of_origin: e.target.value })}
                    placeholder="e.g. USA"
                  />
                </div>
              </div>
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
                  placeholder="SEO title (defaults to brand name)"
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
              <div className="flex items-center justify-between">
                <div>
                  <Label>Active</Label>
                  <p className="text-xs text-[var(--color-dark)]/60">Brand is visible to customers</p>
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
              <AdminCardTitle className="text-xs uppercase tracking-wider">Preview</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md overflow-hidden bg-[var(--color-creme)] flex-shrink-0">
                  {formData.logo_url[0] ? (
                    <img
                      src={formData.logo_url[0]}
                      alt="Brand"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-[var(--color-dark)]/40" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">
                    {formData.name || 'Brand Name'}
                  </div>
                  <div className="text-xs text-[var(--color-dark)]/60 truncate">
                    {formData.description || 'Brand description'}
                  </div>
                  {formData.country_of_origin && (
                    <div className="text-xs text-[var(--color-dark)]/40">
                      Origin: {formData.country_of_origin}
                    </div>
                  )}
                </div>
              </div>
            </AdminCardContent>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
