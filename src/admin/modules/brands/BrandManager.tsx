import { useState, useEffect } from 'react';
import { Plus, Search, ArrowLeft, Trash2, ExternalLink, Star, Building, Save } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Switch } from '../../../components/ui/switch';
import { ImageUpload } from '../../../components/ui/ImageUpload';
import { supabase } from '../../../lib/supabase/client';
import { toast } from 'sonner';

// Database-aligned Brand interface
interface Brand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  sort_order: number;
  is_active: boolean;
  is_featured: boolean;
  heritage: {
    founded_year?: string;
    origin_country?: string;
    founder?: string;
    story?: string;
  } | null;
  meta_title: string | null;
  meta_description: string | null;
  created_at: string;
  updated_at: string;
}

interface BrandManagerProps {
  onStatsUpdate: () => void;
}

export default function BrandManager({ onStatsUpdate }: BrandManagerProps) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '',
    description: '',
    logo_url: '',
    website_url: '',
    is_active: true,
    is_featured: false,
    heritage: {
      founded_year: '',
      origin_country: '',
      founder: '',
      story: ''
    },
    meta_title: '',
    meta_description: ''
  });

  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setBrands(data || []);
    } catch (error) {
      console.error('Error loading brands:', error);
      toast.error('Failed to load brands');
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  };

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      logo_url: '',
      website_url: '',
      is_active: true,
      is_featured: false,
      heritage: { founded_year: '', origin_country: '', founder: '', story: '' },
      meta_title: '',
      meta_description: ''
    });
  };

  const openCreate = () => {
    resetForm();
    setSelectedBrand(null);
    setIsCreating(true);
  };

  const openEdit = (brand: Brand) => {
    setForm({
      name: brand.name || '',
      description: brand.description || '',
      logo_url: brand.logo_url || '',
      website_url: brand.website_url || '',
      is_active: brand.is_active ?? true,
      is_featured: brand.is_featured ?? false,
      heritage: {
        founded_year: brand.heritage?.founded_year || '',
        origin_country: brand.heritage?.origin_country || '',
        founder: brand.heritage?.founder || '',
        story: brand.heritage?.story || ''
      },
      meta_title: brand.meta_title || '',
      meta_description: brand.meta_description || ''
    });
    setSelectedBrand(brand);
    setIsCreating(false);
  };

  const closeEditor = () => {
    setSelectedBrand(null);
    setIsCreating(false);
    resetForm();
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Brand name is required');
      return;
    }

    setSaving(true);
    try {
      // Clean heritage - remove empty values
      const heritage: Record<string, string> = {};
      if (form.heritage.founded_year?.trim()) heritage.founded_year = form.heritage.founded_year.trim();
      if (form.heritage.origin_country?.trim()) heritage.origin_country = form.heritage.origin_country.trim();
      if (form.heritage.founder?.trim()) heritage.founder = form.heritage.founder.trim();
      if (form.heritage.story?.trim()) heritage.story = form.heritage.story.trim();

      const data = {
        name: form.name.trim(),
        slug: generateSlug(form.name),
        description: form.description.trim() || null,
        logo_url: form.logo_url || null,
        website_url: form.website_url || null,
        is_active: form.is_active,
        is_featured: form.is_featured,
        heritage: Object.keys(heritage).length > 0 ? heritage : null,
        meta_title: form.meta_title.trim() || null,
        meta_description: form.meta_description.trim() || null,
        sort_order: selectedBrand?.sort_order ?? brands.length
      };

      if (selectedBrand) {
        const { error } = await supabase
          .from('brands')
          .update(data)
          .eq('id', selectedBrand.id);
        if (error) throw error;
        toast.success('Brand updated');
      } else {
        const { error } = await supabase
          .from('brands')
          .insert(data);
        if (error) throw error;
        toast.success('Brand created');
      }

      closeEditor();
      loadBrands();
      onStatsUpdate();
    } catch (error: any) {
      console.error('Error saving brand:', error);
      if (error?.code === '23505') {
        toast.error('A brand with this name already exists');
      } else {
        toast.error(error?.message || 'Failed to save brand');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedBrand) return;
    if (!confirm(`Delete "${selectedBrand.name}"? This cannot be undone.`)) return;

    try {
      const { error } = await supabase
        .from('brands')
        .delete()
        .eq('id', selectedBrand.id);
      if (error) throw error;
      toast.success('Brand deleted');
      closeEditor();
      loadBrands();
      onStatsUpdate();
    } catch (error: any) {
      console.error('Error deleting brand:', error);
      toast.error(error?.message || 'Failed to delete brand');
    }
  };

  const filteredBrands = brands.filter(b =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Show editor view
  if (selectedBrand || isCreating) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={closeEditor}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">
              {isCreating ? 'New Brand' : `Edit: ${selectedBrand?.name}`}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {selectedBrand && (
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Brand'}
            </Button>
          </div>
        </div>

        {/* Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h2 className="font-semibold text-lg">Basic Information</h2>
              
              <div>
                <Label htmlFor="name">Brand Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Enter brand name"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of the brand"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="website">Website URL</Label>
                <Input
                  id="website"
                  type="url"
                  value={form.website_url}
                  onChange={e => setForm(f => ({ ...f, website_url: e.target.value }))}
                  placeholder="https://example.com"
                />
              </div>
            </div>

            {/* Heritage */}
            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h2 className="font-semibold text-lg">Brand Heritage</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="founded">Founded Year</Label>
                  <Input
                    id="founded"
                    value={form.heritage.founded_year}
                    onChange={e => setForm(f => ({ 
                      ...f, 
                      heritage: { ...f.heritage, founded_year: e.target.value }
                    }))}
                    placeholder="e.g., 1924"
                  />
                </div>
                <div>
                  <Label htmlFor="country">Origin Country</Label>
                  <Input
                    id="country"
                    value={form.heritage.origin_country}
                    onChange={e => setForm(f => ({ 
                      ...f, 
                      heritage: { ...f.heritage, origin_country: e.target.value }
                    }))}
                    placeholder="e.g., USA"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="founder">Founder</Label>
                <Input
                  id="founder"
                  value={form.heritage.founder}
                  onChange={e => setForm(f => ({ 
                    ...f, 
                    heritage: { ...f.heritage, founder: e.target.value }
                  }))}
                  placeholder="Founder name"
                />
              </div>

              <div>
                <Label htmlFor="story">Brand Story</Label>
                <Textarea
                  id="story"
                  value={form.heritage.story}
                  onChange={e => setForm(f => ({ 
                    ...f, 
                    heritage: { ...f.heritage, story: e.target.value }
                  }))}
                  placeholder="The story behind the brand..."
                  rows={4}
                />
              </div>
            </div>

            {/* SEO */}
            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h2 className="font-semibold text-lg">SEO Settings</h2>
              
              <div>
                <Label htmlFor="meta_title">Meta Title</Label>
                <Input
                  id="meta_title"
                  value={form.meta_title}
                  onChange={e => setForm(f => ({ ...f, meta_title: e.target.value }))}
                  placeholder="SEO title for search engines"
                />
              </div>

              <div>
                <Label htmlFor="meta_desc">Meta Description</Label>
                <Textarea
                  id="meta_desc"
                  value={form.meta_description}
                  onChange={e => setForm(f => ({ ...f, meta_description: e.target.value }))}
                  placeholder="SEO description for search engines"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Logo */}
            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h2 className="font-semibold text-lg">Brand Logo</h2>
              <ImageUpload
                imageUrl={form.logo_url || null}
                onImageUrlChange={(url) => setForm(f => ({ ...f, logo_url: url || '' }))}
                showSelector={true}
              />
            </div>

            {/* Status */}
            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h2 className="font-semibold text-lg">Status</h2>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Active</Label>
                  <p className="text-sm text-gray-500">Brand is visible on the site</p>
                </div>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={checked => setForm(f => ({ ...f, is_active: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Featured</Label>
                  <p className="text-sm text-gray-500">Show in featured sections</p>
                </div>
                <Switch
                  checked={form.is_featured}
                  onCheckedChange={checked => setForm(f => ({ ...f, is_featured: checked }))}
                />
              </div>
            </div>

            {/* Info */}
            {selectedBrand && (
              <div className="bg-white rounded-lg border p-6 space-y-2 text-sm text-gray-500">
                <p>Created: {new Date(selectedBrand.created_at).toLocaleDateString()}</p>
                <p>Updated: {new Date(selectedBrand.updated_at).toLocaleDateString()}</p>
                <p>Slug: {selectedBrand.slug}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Brands</h1>
          <p className="text-gray-500">{brands.length} brands total</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Brand
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search brands..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      ) : filteredBrands.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {searchTerm ? 'No brands match your search' : 'No brands yet. Create your first brand!'}
        </div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {filteredBrands.map(brand => (
            <div
              key={brand.id}
              onClick={() => openEdit(brand)}
              className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              {/* Logo */}
              <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {brand.logo_url ? (
                  <img src={brand.logo_url} alt={brand.name} className="w-full h-full object-cover" />
                ) : (
                  <Building className="h-6 w-6 text-gray-400" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{brand.name}</span>
                  {brand.is_featured && (
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  )}
                </div>
                {brand.description && (
                  <p className="text-sm text-gray-500 truncate">{brand.description}</p>
                )}
              </div>

              {/* Status */}
              <Badge variant={brand.is_active ? 'default' : 'secondary'}>
                {brand.is_active ? 'Active' : 'Inactive'}
              </Badge>

              {/* Website */}
              {brand.website_url && (
                <a
                  href={brand.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
