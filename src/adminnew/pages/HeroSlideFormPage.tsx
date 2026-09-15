import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Loader2, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Slider } from '../../components/ui/slider';
import { AdminCard, AdminCardContent, AdminCardHeader, AdminCardTitle } from '../components/shared/AdminCard';
import { SingleImagePicker } from '../components/shared/ImagePicker';
import { Req, ReqError, isBlank } from '../components/shared/requiredFields';
import { PageHeader } from '../components/shared/PageHeader';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { invalidateStorefront } from '../../lib/cache/invalidateStorefront';
import { toast } from 'sonner';

interface HeroSlideFormData {
  title: string;
  subtitle: string;
  suptitle: string;
  description: string;
  image_url: string;
  mobile_image_url: string;
  button_text: string;
  button_url: string;
  button_style: string;
  product_name: string;
  product_price: string;
  product_image_url: string;
  text_position: 'left' | 'center' | 'right';
  text_color: 'light' | 'dark';
  overlay_opacity: number;
  is_active: boolean;
  sort_order: number;
}

const initialFormData: HeroSlideFormData = {
  title: '',
  subtitle: '',
  suptitle: '',
  description: '',
  image_url: '',
  mobile_image_url: '',
  button_text: '',
  button_url: '',
  button_style: 'primary',
  product_name: '',
  product_price: '',
  product_image_url: '',
  text_position: 'left',
  text_color: 'light',
  overlay_opacity: 40,
  is_active: true,
  sort_order: 0
};

export function HeroSlideFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id && id !== 'new');

  const [form, setForm] = useState<HeroSlideFormData>(initialFormData);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const populatedRef = useRef(false);

  const slides = useQuery(api.adminCatalog.listHeroSlidesForAdmin, {});
  const saveSlide = useMutation(api.adminCatalog.saveHeroSlide);
  const removeSlide = useMutation(api.adminCatalog.deleteHeroSlide);

  // Populate once / next sort order — both derive from the one list query.
  useEffect(() => {
    if (!slides || populatedRef.current) return;
    populatedRef.current = true;
    if (isEditMode && id) {
      const data: any = slides.find((s: any) => s._id === id);
      if (!data) {
        toast.error('Slide not found');
        navigate('/admin/homepage');
        return;
      }
      setForm({
        title: data.title || '',
        subtitle: data.subtitle || '',
        suptitle: data.suptitle || '',
        description: data.description || '',
        image_url: data.imageUrl || '',
        mobile_image_url: data.mobileImageUrl || '',
        button_text: data.buttonText || '',
        button_url: data.buttonUrl || '',
        button_style: data.buttonStyle || 'primary',
        product_name: data.productName || '',
        product_price: data.productPrice != null ? String(data.productPrice) : '',
        product_image_url: data.productImageUrl || '',
        text_position: data.textPosition || 'left',
        text_color: data.textColor || 'light',
        overlay_opacity: data.overlayOpacity ?? 40,
        is_active: data.isActive ?? true,
        sort_order: data.sortOrder ?? 0
      });
      setLoading(false);
    } else {
      const max = Math.max(-1, ...slides.map((s: any) => s.sortOrder ?? 0));
      setForm((prev) => ({ ...prev, sort_order: max + 1 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides]);

  const handleSave = async () => {
    setSaveAttempted(true);
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!form.image_url) {
      toast.error('Image is required');
      return;
    }

    setSaving(true);
    try {
      await saveSlide({
        id: isEditMode && id ? (id as any) : undefined,
        slide: {
          title: form.title.trim(),
          subtitle: form.subtitle.trim() || undefined,
          suptitle: form.suptitle.trim() || undefined,
          description: form.description.trim() || undefined,
          imageUrl: form.image_url,
          mobileImageUrl: form.mobile_image_url || undefined,
          buttonText: form.button_text.trim() || undefined,
          buttonUrl: form.button_url.trim() || undefined,
          buttonStyle: form.button_style,
          productName: form.product_name.trim() || undefined,
          productPrice: form.product_price.trim() ? Number(form.product_price) : undefined,
          productImageUrl: form.product_image_url || undefined,
          textPosition: form.text_position,
          textColor: form.text_color,
          overlayOpacity: form.overlay_opacity,
          isActive: form.is_active,
          sortOrder: form.sort_order,
        },
      });
      toast.success(isEditMode ? 'Slide updated' : 'Slide created');

      await invalidateStorefront();
      navigate('/admin/homepage');
    } catch (error: any) {
      console.error('Error saving slide:', error);
      toast.error(error?.data?.code === 'NOT_CATALOG_ADMIN' ? 'Admin access required' : 'Failed to save slide');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditMode || !id) return;
    if (!confirm('Delete this slide?')) return;

    setSaving(true);
    try {
      await removeSlide({ id: id as any });
      toast.success('Slide deleted');
      await invalidateStorefront();
      navigate('/admin/homepage');
    } catch (error: any) {
      console.error('Error deleting slide:', error);
      toast.error('Failed to delete slide');
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
      <PageHeader
        title={isEditMode ? 'Edit Slide' : 'New Slide'}
        description={isEditMode ? 'Update hero slide details' : 'Create a new hero slide'}
        backUrl="/admin/homepage"
      >
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
          onClick={handleSave}
          disabled={saving}
          className="bg-[var(--color-canyon)] hover:bg-[var(--color-canyon)]/90 text-[var(--color-creme)]"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Saving...' : 'Save Slide'}
        </Button>
      </PageHeader>

      <div className="max-w-[1600px] mx-auto px-6 grid grid-cols-[1fr_350px] gap-6 mt-6">
        {/* Left Column - Main Content */}
        <div className="space-y-4">
          {/* Basic Info */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Slide Content</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="suptitle">Eyebrow (small text above title)</Label>
                <Input
                  id="suptitle"
                  value={form.suptitle}
                  onChange={(e) => setForm(prev => ({ ...prev, suptitle: e.target.value }))}
                  placeholder="e.g. NEW ARRIVAL"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="title">Title <Req /></Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter slide title"
                  aria-invalid={saveAttempted && isBlank(form.title)}
                />
                <ReqError show={saveAttempted && isBlank(form.title)} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="subtitle">Subtitle</Label>
                <Input
                  id="subtitle"
                  value={form.subtitle}
                  onChange={(e) => setForm(prev => ({ ...prev, subtitle: e.target.value }))}
                  placeholder="Enter subtitle (optional)"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Shown under the title on the storefront (optional)"
                  rows={3}
                />
              </div>
            </AdminCardContent>
          </AdminCard>

          {/* Button Settings */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Call to Action</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="button_text">Button Text</Label>
                  <Input
                    id="button_text"
                    value={form.button_text}
                    onChange={(e) => setForm(prev => ({ ...prev, button_text: e.target.value }))}
                    placeholder="e.g. Shop Now"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="button_url">Button URL</Label>
                  <Input
                    id="button_url"
                    value={form.button_url}
                    onChange={(e) => setForm(prev => ({ ...prev, button_url: e.target.value }))}
                    placeholder="/products or https://..."
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Button Style</Label>
                <Select
                  value={form.button_style}
                  onValueChange={(value) => setForm(prev => ({ ...prev, button_style: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Primary</SelectItem>
                    <SelectItem value="secondary">Secondary</SelectItem>
                    <SelectItem value="outline">Outline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </AdminCardContent>
          </AdminCard>

          {/* Product Spotlight */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Product Spotlight (optional)</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent className="space-y-4">
              <p className="text-xs text-[var(--color-dark)]/60">
                Shows the floating product card on the slide. Leave empty to hide it.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="product_name">Product Name</Label>
                  <Input
                    id="product_name"
                    value={form.product_name}
                    onChange={(e) => setForm(prev => ({ ...prev, product_name: e.target.value }))}
                    placeholder="e.g. Esse Change"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="product_price">Product Price (₹)</Label>
                  <Input
                    id="product_price"
                    type="number"
                    min={0}
                    value={form.product_price}
                    onChange={(e) => setForm(prev => ({ ...prev, product_price: e.target.value }))}
                    placeholder="e.g. 350"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Product Image</Label>
                <SingleImagePicker
                  value={form.product_image_url || null}
                  onChange={(url) => setForm(prev => ({ ...prev, product_image_url: url || '' }))}
                />
              </div>
            </AdminCardContent>
          </AdminCard>

          {/* Display Settings */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Display Settings</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Text Position</Label>
                  <Select
                    value={form.text_position}
                    onValueChange={(value: 'left' | 'center' | 'right') => 
                      setForm(prev => ({ ...prev, text_position: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Text Color</Label>
                  <Select
                    value={form.text_color}
                    onValueChange={(value: 'light' | 'dark') => 
                      setForm(prev => ({ ...prev, text_color: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light (White)</SelectItem>
                      <SelectItem value="dark">Dark (Black)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Overlay Opacity: {form.overlay_opacity}%</Label>
                <Slider
                  value={[form.overlay_opacity]}
                  onValueChange={(value) => setForm(prev => ({ ...prev, overlay_opacity: value[0] }))}
                  min={0}
                  max={100}
                  step={5}
                />
                <p className="text-xs text-[var(--color-dark)]/60">
                  Controls the darkness of the overlay on the image
                </p>
              </div>
            </AdminCardContent>
          </AdminCard>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-4">
          {/* Status */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Status</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Active</Label>
                  <p className="text-xs text-[var(--color-dark)]/60">Show on homepage</p>
                </div>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm(prev => ({ ...prev, is_active: checked }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                  placeholder="0"
                  min={0}
                />
                <p className="text-xs text-[var(--color-dark)]/60">Lower numbers appear first</p>
              </div>
            </AdminCardContent>
          </AdminCard>

          {/* Desktop Image */}
          <AdminCard className={saveAttempted && !form.image_url ? 'border-red-500' : undefined}>
            <AdminCardHeader>
              <AdminCardTitle>Desktop Image <Req /></AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <SingleImagePicker
                value={form.image_url || null}
                onChange={(url) => setForm(prev => ({ ...prev, image_url: url || '' }))}
              />
              <ReqError show={saveAttempted && !form.image_url}>
                A desktop image is required
              </ReqError>
              <p className="text-xs text-[var(--color-dark)]/60 mt-2">
                Recommended: 1920x800px
              </p>
            </AdminCardContent>
          </AdminCard>

          {/* Mobile Image */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Mobile Image</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <SingleImagePicker
                value={form.mobile_image_url || null}
                onChange={(url) => setForm(prev => ({ ...prev, mobile_image_url: url || '' }))}
              />
              <p className="text-xs text-[var(--color-dark)]/60 mt-2">
                Optional. Recommended: 768x600px
              </p>
            </AdminCardContent>
          </AdminCard>

          {/* Preview */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Preview</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <div 
                className="relative aspect-[16/9] rounded-lg overflow-hidden bg-gray-100"
                style={{
                  backgroundImage: form.image_url ? `url(${form.image_url})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                {/* Overlay */}
                <div 
                  className="absolute inset-0 bg-black"
                  style={{ opacity: form.overlay_opacity / 100 }}
                />
                
                {/* Content */}
                <div 
                  className={`absolute inset-0 flex flex-col justify-center p-4 ${
                    form.text_position === 'center' ? 'items-center text-center' :
                    form.text_position === 'right' ? 'items-end text-right' : 'items-start'
                  }`}
                >
                  <h3 className={`text-sm font-bold ${form.text_color === 'light' ? 'text-white' : 'text-black'}`}>
                    {form.title || 'Slide Title'}
                  </h3>
                  {form.subtitle && (
                    <p className={`text-xs mt-1 ${form.text_color === 'light' ? 'text-white/80' : 'text-black/80'}`}>
                      {form.subtitle}
                    </p>
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
