import { useState, useEffect } from 'react';
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
import { PageHeader } from '../components/shared/PageHeader';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';

interface HeroSlideFormData {
  title: string;
  subtitle: string;
  description: string;
  image_url: string;
  mobile_image_url: string;
  button_text: string;
  button_url: string;
  button_style: string;
  text_position: 'left' | 'center' | 'right';
  text_color: 'light' | 'dark';
  overlay_opacity: number;
  is_active: boolean;
  sort_order: number;
}

const initialFormData: HeroSlideFormData = {
  title: '',
  subtitle: '',
  description: '',
  image_url: '',
  mobile_image_url: '',
  button_text: '',
  button_url: '',
  button_style: 'primary',
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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEditMode && id) {
      loadSlide(id);
    } else {
      // Get next sort order for new slides
      getNextSortOrder();
    }
  }, [id, isEditMode]);

  const loadSlide = async (slideId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hero_slides')
        .select('*')
        .eq('id', slideId)
        .single();

      if (error) throw error;
      if (data) {
        setForm({
          title: data.title || '',
          subtitle: data.subtitle || '',
          description: data.description || '',
          image_url: data.image_url || '',
          mobile_image_url: data.mobile_image_url || '',
          button_text: data.button_text || '',
          button_url: data.button_url || '',
          button_style: data.button_style || 'primary',
          text_position: data.text_position || 'left',
          text_color: data.text_color || 'light',
          overlay_opacity: data.overlay_opacity ?? 40,
          is_active: data.is_active ?? true,
          sort_order: data.sort_order ?? 0
        });
      }
    } catch (error) {
      console.error('Error loading slide:', error);
      toast.error('Failed to load slide');
      navigate('/admin/homepage');
    } finally {
      setLoading(false);
    }
  };

  const getNextSortOrder = async () => {
    try {
      const { data } = await supabase
        .from('hero_slides')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setForm(prev => ({ ...prev, sort_order: (data[0].sort_order || 0) + 1 }));
      }
    } catch (error) {
      console.error('Error getting sort order:', error);
    }
  };

  const handleSave = async () => {
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
      const slideData = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        description: form.description.trim() || null,
        image_url: form.image_url,
        mobile_image_url: form.mobile_image_url || null,
        button_text: form.button_text.trim() || null,
        button_url: form.button_url.trim() || null,
        button_style: form.button_style,
        text_position: form.text_position,
        text_color: form.text_color,
        overlay_opacity: form.overlay_opacity,
        is_active: form.is_active,
        sort_order: form.sort_order
      };

      if (isEditMode && id) {
        const { error } = await supabase
          .from('hero_slides')
          .update(slideData)
          .eq('id', id);

        if (error) throw error;
        toast.success('Slide updated');
      } else {
        const { error } = await supabase
          .from('hero_slides')
          .insert(slideData);

        if (error) throw error;
        toast.success('Slide created');
      }

      navigate('/admin/homepage');
    } catch (error) {
      console.error('Error saving slide:', error);
      toast.error('Failed to save slide');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditMode || !id) return;
    if (!confirm('Delete this slide?')) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('hero_slides')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Slide deleted');
      navigate('/admin/homepage');
    } catch (error) {
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

      <div className="max-w-[1400px] mx-auto px-6 grid grid-cols-[1fr_300px] gap-4 mt-4">
        {/* Left Column - Main Content */}
        <div className="space-y-4">
          {/* Basic Info */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Slide Content</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter slide title"
                />
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
                  placeholder="Enter description (optional)"
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
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Desktop Image *</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <SingleImagePicker
                value={form.image_url || null}
                onChange={(url) => setForm(prev => ({ ...prev, image_url: url || '' }))}
              />
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
