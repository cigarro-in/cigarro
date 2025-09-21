import { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Eye, 
  EyeOff,
  Image as ImageIcon,
  Save,
  X,
  Monitor,
  Smartphone,
  Tablet,
  ExternalLink
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Switch } from '../../ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Badge } from '../../ui/badge';
import { Alert, AlertDescription } from '../../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Slider } from '../../ui/slider';
import { SingleImageUpload } from '../../ui/UnifiedImageUpload';
import { supabase } from '../../../utils/supabase/client';
import { toast } from 'sonner';

interface HeroSlide {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  image_url: string;
  mobile_image_url?: string;
  small_image_url?: string;
  button_text?: string;
  button_url?: string;
  button_style?: 'primary' | 'secondary' | 'outline';
  text_position?: 'left' | 'center' | 'right';
  text_color?: 'light' | 'dark';
  overlay_opacity?: number;
  product_name?: string;
  product_price?: string;
  product_image_url?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface HeroSectionManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function EnhancedHeroSectionManager({ open, onOpenChange, onUpdate }: HeroSectionManagerProps) {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSlideModal, setShowSlideModal] = useState(false);
  const [editingSlide, setEditingSlide] = useState<HeroSlide | null>(null);
  const [formData, setFormData] = useState<Partial<HeroSlide>>({
    title: '',
    subtitle: '',
    description: '',
    image_url: '',
    mobile_image_url: '',
    small_image_url: '',
    button_text: '',
    button_url: '',
    button_style: 'primary',
    text_position: 'left',
    text_color: 'light',
    overlay_opacity: 40,
    product_name: '',
    product_price: '',
    product_image_url: '',
    is_active: true,
    sort_order: 0
  });

  useEffect(() => {
    if (open) {
      loadSlides();
    }
  }, [open]);

  const loadSlides = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('hero_slides')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setSlides(data || []);
    } catch (error) {
      console.error('Error loading slides:', error);
      toast.error('Failed to load slides');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSlide = () => {
    setEditingSlide(null);
    setFormData({
      title: '',
      subtitle: '',
      description: '',
      image_url: '',
      mobile_image_url: '',
      small_image_url: '',
      button_text: '',
      button_url: '',
      button_style: 'primary',
      text_position: 'left',
      text_color: 'light',
      overlay_opacity: 40,
      product_name: '',
      product_price: '',
      product_image_url: '',
      is_active: true,
      sort_order: slides.length + 1
    });
    setShowSlideModal(true);
  };

  const handleEditSlide = (slide: HeroSlide) => {
    setEditingSlide(slide);
    setFormData(slide);
    setShowSlideModal(true);
  };

  const handleSaveSlide = async () => {
    if (!formData.title || !formData.image_url) {
      toast.error('Title and main image are required');
      return;
    }

    setIsSaving(true);
    try {
      const slideData = {
        ...formData,
        updated_at: new Date().toISOString()
      };

      let error;
      if (editingSlide) {
        ({ error } = await supabase
          .from('hero_slides')
          .update(slideData)
          .eq('id', editingSlide.id));
      } else {
        ({ error } = await supabase
          .from('hero_slides')
          .insert([{
            ...slideData,
            created_at: new Date().toISOString()
          }]));
      }

      if (error) throw error;

      toast.success(editingSlide ? 'Slide updated successfully' : 'Slide created successfully');
      setShowSlideModal(false);
      loadSlides();
      onUpdate();
    } catch (error) {
      console.error('Error saving slide:', error);
      toast.error('Failed to save slide');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSlide = async (slideId: string) => {
    if (!confirm('Are you sure you want to delete this slide?')) return;

    try {
      const { error } = await supabase
        .from('hero_slides')
        .delete()
        .eq('id', slideId);

      if (error) throw error;

      toast.success('Slide deleted successfully');
      loadSlides();
      onUpdate();
    } catch (error) {
      console.error('Error deleting slide:', error);
      toast.error('Failed to delete slide');
    }
  };

  const handleToggleSlide = async (slideId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('hero_slides')
        .update({ is_active: isActive })
        .eq('id', slideId);

      if (error) throw error;

      setSlides(prev => prev.map(slide => 
        slide.id === slideId ? { ...slide, is_active: isActive } : slide
      ));

      toast.success(`Slide ${isActive ? 'activated' : 'deactivated'}`);
      onUpdate();
    } catch (error) {
      console.error('Error toggling slide:', error);
      toast.error('Failed to update slide');
    }
  };

  const handleReorderSlide = async (slideId: string, direction: 'up' | 'down') => {
    const currentIndex = slides.findIndex(s => s.id === slideId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= slides.length) return;

    const reorderedSlides = [...slides];
    [reorderedSlides[currentIndex], reorderedSlides[newIndex]] = 
    [reorderedSlides[newIndex], reorderedSlides[currentIndex]];

    // Update sort_order for all affected slides
    const updates = reorderedSlides.map((slide, index) => ({
      id: slide.id,
      sort_order: index + 1
    }));

    try {
      for (const update of updates) {
        const { error } = await supabase
          .from('hero_slides')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);

        if (error) throw error;
      }

      setSlides(reorderedSlides.map((slide, index) => ({ ...slide, sort_order: index + 1 })));
      toast.success('Slide order updated');
      onUpdate();
    } catch (error) {
      console.error('Error reordering slides:', error);
      toast.error('Failed to reorder slides');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Hero Section Management
          </DialogTitle>
          <DialogDescription>
            Manage your homepage hero slides. Create, edit, and configure slides with different images for desktop, tablet, and mobile devices.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Alert>
            <ImageIcon className="h-4 w-4" />
            <AlertDescription>
              Manage your homepage hero slides. Each slide can have different images for desktop, tablet, and mobile devices.
            </AlertDescription>
          </Alert>

          {/* Header Actions */}
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">Current Slides ({slides.length})</h3>
              <p className="text-sm text-muted-foreground">
                Drag to reorder, toggle visibility, or edit content
              </p>
            </div>
            <Button onClick={handleCreateSlide}>
              <Plus className="h-4 w-4 mr-2" />
              Add New Slide
            </Button>
          </div>

          {/* Slides List */}
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-2">Loading slides...</p>
              </div>
            ) : slides.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No slides created yet</p>
                <p className="text-sm">Create your first hero slide to get started</p>
              </div>
            ) : (
              slides.map((slide, index) => (
                <Card key={slide.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Slide Preview */}
                      <div className="w-24 h-16 bg-muted rounded overflow-hidden flex-shrink-0">
                        <img
                          src={slide.image_url}
                          alt={slide.title}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Slide Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">#{slide.sort_order}</Badge>
                          <h4 className="font-medium truncate">{slide.title}</h4>
                          <Badge variant={slide.is_active ? "default" : "secondary"}>
                            {slide.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        {slide.subtitle && (
                          <p className="text-sm text-muted-foreground truncate">{slide.subtitle}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Position: {slide.text_position}</span>
                          <span>Color: {slide.text_color}</span>
                          {slide.button_text && <span>Button: {slide.button_text}</span>}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReorderSlide(slide.id, 'up')}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReorderSlide(slide.id, 'down')}
                          disabled={index === slides.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleSlide(slide.id, !slide.is_active)}
                        >
                          {slide.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditSlide(slide)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSlide(slide.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Slide Editor Modal */}
        <Dialog open={showSlideModal} onOpenChange={setShowSlideModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingSlide ? 'Edit Slide' : 'Create New Slide'}
              </DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="content" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="images">Images</TabsTrigger>
                <TabsTrigger value="styling">Styling</TabsTrigger>
                <TabsTrigger value="product">Product Info</TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Text Content</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="title">Main Title *</Label>
                      <Input
                        id="title"
                        value={formData.title || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Enter slide title"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="subtitle">Subtitle</Label>
                      <Input
                        id="subtitle"
                        value={formData.subtitle || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
                        placeholder="Enter subtitle (optional)"
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Enter slide description"
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="button_text">Button Text</Label>
                        <Input
                          id="button_text"
                          value={formData.button_text || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, button_text: e.target.value }))}
                          placeholder="e.g., Shop Now"
                        />
                      </div>
                      <div>
                        <Label htmlFor="button_url">Button URL</Label>
                        <Input
                          id="button_url"
                          value={formData.button_url || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, button_url: e.target.value }))}
                          placeholder="e.g., /products"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="images" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Responsive Images</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Upload different images for different screen sizes to ensure optimal display
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Monitor className="h-4 w-4" />
                          <Label>Desktop Image *</Label>
                        </div>
                        <SingleImageUpload
                          imageUrl={formData.image_url || null}
                          onImageUrlChange={(url) => setFormData(prev => ({ ...prev, image_url: url || '' }))}
                          showSelector={true}
                          title="Select Desktop Image"
                          description="Recommended: 1920x1080px"
                          aspectRatio="landscape"
                          size="lg"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Tablet className="h-4 w-4" />
                          <Label>Tablet Image</Label>
                        </div>
                        <SingleImageUpload
                          imageUrl={formData.mobile_image_url || null}
                          onImageUrlChange={(url) => setFormData(prev => ({ ...prev, mobile_image_url: url || '' }))}
                          showSelector={true}
                          title="Select Tablet Image"
                          description="Recommended: 1024x768px"
                          aspectRatio="landscape"
                          size="lg"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Smartphone className="h-4 w-4" />
                          <Label>Mobile Image</Label>
                        </div>
                        <SingleImageUpload
                          imageUrl={formData.small_image_url || null}
                          onImageUrlChange={(url) => setFormData(prev => ({ ...prev, small_image_url: url || '' }))}
                          showSelector={true}
                          title="Select Mobile Image"
                          description="Recommended: 375x667px"
                          aspectRatio="portrait"
                          size="lg"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="styling" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Visual Styling</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Text Position</Label>
                        <Select 
                          value={formData.text_position || 'left'} 
                          onValueChange={(value: 'left' | 'center' | 'right') => 
                            setFormData(prev => ({ ...prev, text_position: value }))
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
                      <div>
                        <Label>Text Color</Label>
                        <Select 
                          value={formData.text_color || 'light'} 
                          onValueChange={(value: 'light' | 'dark') => 
                            setFormData(prev => ({ ...prev, text_color: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="light">Light</SelectItem>
                            <SelectItem value="dark">Dark</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Button Style</Label>
                      <Select 
                        value={formData.button_style || 'primary'} 
                        onValueChange={(value: 'primary' | 'secondary' | 'outline') => 
                          setFormData(prev => ({ ...prev, button_style: value }))
                        }
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
                    <div>
                      <Label>Overlay Opacity: {formData.overlay_opacity || 40}%</Label>
                      <Slider
                        value={[formData.overlay_opacity || 40]}
                        onValueChange={(value: number[]) => setFormData(prev => ({ ...prev, overlay_opacity: value[0] }))}
                        max={100}
                        min={0}
                        step={5}
                        className="mt-2"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="product" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Product Information (Optional)</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Add product details to display alongside the slide content
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="product_name">Product Name</Label>
                        <Input
                          id="product_name"
                          value={formData.product_name || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, product_name: e.target.value }))}
                          placeholder="Enter product name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="product_price">Product Price</Label>
                        <Input
                          id="product_price"
                          value={formData.product_price || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, product_price: e.target.value }))}
                          placeholder="e.g., ₹999"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Product Image</Label>
                      <SingleImageUpload
                        imageUrl={formData.product_image_url || null}
                        onImageUrlChange={(url) => setFormData(prev => ({ ...prev, product_image_url: url || '' }))}
                        showSelector={true}
                        title="Select Product Image"
                        description="Product image to display on the slide"
                        aspectRatio="square"
                        size="md"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex justify-between items-center pt-4 border-t">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked: boolean) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label>Active Slide</Label>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowSlideModal(false)}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSaveSlide} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : editingSlide ? 'Update Slide' : 'Create Slide'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
