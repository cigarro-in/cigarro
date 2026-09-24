import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Building2, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { AdminCard, AdminCardContent, AdminCardHeader, AdminCardTitle } from '../components/shared/AdminCard';
import { Switch } from '../../components/ui/switch';
import { SingleImagePicker } from '../components/shared/ImagePicker';
import { Req, ReqError, isBlank } from '../components/shared/requiredFields';
import { PageHeader } from '../components/shared/PageHeader';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
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

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const populatedRef = useRef(false);

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

  const brandRows = useQuery(api.adminCatalog.listBrandsForAdmin, {});
  const createBrand = useMutation(api.adminCatalog.createBrand);
  const updateBrand = useMutation(api.adminCatalog.updateBrand);
  const removeBrand = useMutation(api.adminCatalog.deleteBrand);

  useEffect(() => {
    if (isEditMode) setIsSlugManuallyEdited(true);
  }, [id]);

  // Populate once from the Convex list (ids are supabaseIds end to end).
  useEffect(() => {
    if (!isEditMode || !brandRows || populatedRef.current) return;
    populatedRef.current = true;
    const data: any = brandRows.find((b: any) => b.supabaseId === id);
    if (!data) {
      toast.error('Brand not found');
      navigate('/admin/brands');
      return;
    }
    setFormData({
      name: data.name || '',
      slug: data.slug || '',
      description: data.description || '',
      logo_url: data.logoUrl ? [data.logoUrl] : [],
      website_url: data.websiteUrl || '',
      country_of_origin: data.countryOfOrigin || '',
      is_active: data.isActive !== false,
      meta_title: data.metaTitle || '',
      meta_description: data.metaDescription || ''
    });
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandRows]);

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

  const handleChange = (updates: Partial<BrandFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleSubmit = async () => {
    setSaveAttempted(true);
    if (!formData.name.trim()) {
      toast.error('Brand name is required');
      return;
    }

    setSaving(true);
    try {
      const args = {
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        description: formData.description.trim() || undefined,
        logoUrl: formData.logo_url[0] || undefined,
        websiteUrl: formData.website_url.trim() || undefined,
        countryOfOrigin: formData.country_of_origin.trim() || undefined,
        isActive: formData.is_active,
        metaTitle: formData.meta_title.trim() || formData.name.trim(),
        metaDescription: formData.meta_description.trim() || undefined,
      };

      if (isEditMode) {
        await updateBrand({ supabaseId: id!, patch: args });
        toast.success('Brand updated successfully');
      } else {
        await createBrand(args);
        toast.success('Brand created successfully');
      }

      navigate('/admin/brands');
    } catch (error: any) {
      console.error('Error saving brand:', error);
      const code = error?.data?.code;
      toast.error(
        code === 'SLUG_TAKEN'
          ? 'Slug is taken by another brand'
          : code === 'NOT_CATALOG_ADMIN'
            ? 'Admin access required'
            : error.message || 'Failed to save brand'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this brand?')) return;
    setSaving(true);
    try {
      await removeBrand({ supabaseId: id! });
      toast.success('Brand deleted successfully');
      navigate('/admin/brands');
    } catch (error: any) {
      console.error('Error deleting brand:', error);
      toast.error(
        error?.data?.code === 'BRAND_IN_USE'
          ? 'This brand has products and cannot be deleted'
          : 'Failed to delete brand'
      );
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

      <div className="max-w-[1600px] mx-auto px-6 grid grid-cols-[1fr_350px] gap-6 mt-6">
        
        {/* LEFT COLUMN */}
        <div className="space-y-4">
          {/* Basic Information */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Brand Identity</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <div className="space-y-1">
                <Label>Name <Req /></Label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Marlboro"
                  aria-invalid={saveAttempted && isBlank(formData.name)}
                />
                <ReqError show={saveAttempted && isBlank(formData.name)} />
              </div>

              <div className={`flex items-center gap-1 text-sm text-[var(--color-dark)]/60 bg-[var(--color-creme)] px-3 py-2 rounded border border-[var(--color-coyote)]/30${saveAttempted && isBlank(formData.slug) ? ' border-red-500' : ''}`}>
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
                  searchHint={formData.name ? `${formData.name} brand logo` : undefined}
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
