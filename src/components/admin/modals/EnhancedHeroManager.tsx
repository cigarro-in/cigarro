import { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Eye, 
  EyeOff,
  Save,
  X,
  Monitor,
  Smartphone,
  Tablet,
  Palette,
  Type,
  MousePointer
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Switch } from '../../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Slider } from '../../ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Badge } from '../../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { EnhancedImageUpload } from '../../ui/EnhancedImageUpload';
import { supabase } from '../../../utils/supabase/client';
import { toast } from 'sonner';

interface HeroSlide {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  image_url: string;
  mobile_image_url?: string;
  button_text?: string;
  button_url?: string;
  button_style?: 'primary' | 'secondary' | 'outline';
  text_position?: 'left' | 'center' | 'right';
  text_color?: 'light' | 'dark';
  overlay_opacity?: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface EnhancedHeroManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function EnhancedHeroManager({ open, onOpenChange, onUpdate }: EnhancedHeroManagerProps) {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingSlide, setEditingSlide] = useState<Partial<HeroSlide> | null>(null);
  const [showSlideModal, setShowSlideModal] = useState(false);

  useEffect(() => {
    if (open) {
      fetchSlides();
    }
  }, [open]);

  const fetchSlides = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('hero_slides')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setSlides(data || []);
    } catch (error) {
      console.error('Error fetching slides:', error);
      toast.error('Failed to fetch hero slides');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSlide = async () => {
    if (!editingSlide?.title || !editingSlide?.image_url) {
      toast.error('Title and image are required');
      return;
    }

    try {
      setLoading(true);
      
      const slideData = {
        title: editingSlide.title,
        subtitle: editingSlide.subtitle || null,
        description: editingSlide.description || null,
        image_url: editingSlide.image_url,
        mobile_image_url: editingSlide.mobile_image_url || null,
        button_text: editingSlide.button_text || null,
        button_url: editingSlide.button_url || null,
        button_style: editingSlide.button_style || 'primary',
        text_position: editingSlide.text_position || 'left',
        text_color: editingSlide.text_color || 'light',
        overlay_opacity: editingSlide.overlay_opacity || 40,
        is_active: editingSlide.is_active ?? true,
        sort_order: editingSlide.sort_order || slides.length + 1
      };

      if (editingSlide.id) {
        const { error } = await supabase
          .from('hero_slides')
          .update(slideData)
          .eq('id', editingSlide.id);
        if (error) throw error;
        toast.success('Slide updated successfully');
      } else {
        const { error } = await supabase
          .from('hero_slides')
          .insert([slideData]);
        if (error) throw error;
        toast.success('Slide created successfully');
      }

      setShowSlideModal(false);
      setEditingSlide(null);
      fetchSlides();
      onUpdate();
    } catch (error) {
      console.error('Error saving slide:', error);
      toast.error('Failed to save slide');
    } finally {
      setLoading(false);
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
      fetchSlides();
      onUpdate();
    } catch (error) {
      console.error('Error deleting slide:', error);
      toast.error('Failed to delete slide');
    }
  };

  const handleToggleActive = async (slideId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('hero_slides')
        .update({ is_active: !isActive })
        .eq('id', slideId);

      if (error) throw error;
      fetchSlides();
      onUpdate();
    } catch (error) {
      console.error('Error toggling slide status:', error);
      toast.error('Failed to update slide status');
    }
  };

  const openEditModal = (slide?: HeroSlide) => {
    setEditingSlide(slide || {
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
      is_active: true
    });
    setShowSlideModal(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-creme border-coyote">
          <DialogHeader className="border-b border-coyote pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-semibold text-dark">Hero Section Manager</DialogTitle>
              <Button
                onClick={() => openEditModal()}
                className="bg-canyon hover:bg-canyon/90 text-creme"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Slide
              </Button>
            </div>
          </DialogHeader>

          <div className="py-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-canyon mx-auto"></div>
                <p className="text-dark/60 mt-4">Loading slides...</p>
              </div>
            ) : slides.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto w-16 h-16 bg-coyote/20 rounded-full flex items-center justify-center mb-4">
                  <Monitor className="h-8 w-8 text-coyote" />
                </div>
                <h3 className="text-lg font-medium text-dark mb-2">No Hero Slides</h3>
                <p className="text-dark/60 mb-4">Create your first hero slide to get started</p>
                <Button
                  onClick={() => openEditModal()}
                  className="bg-canyon hover:bg-canyon/90 text-creme"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Slide
                </Button>
              </div>
            ) : (
              <div className="grid gap-6">
                {slides.map((slide, index) => (
                  <Card key={slide.id} className="bg-creme-light border-coyote">
                    <CardContent className="p-6">
                      <div className="flex items-start space-x-6">
                        {/* Slide Preview */}
                        <div className="flex-shrink-0 w-48 h-28 rounded-lg overflow-hidden bg-coyote/10 relative">
                          <img
                            src={slide.image_url}
                            alt={slide.title}
                            className="w-full h-full object-cover"
                          />
                          <div 
                            className="absolute inset-0 bg-black"
                            style={{ opacity: (slide.overlay_opacity || 40) / 100 }}
                          />
                          <div className={`absolute inset-0 p-3 flex flex-col justify-center text-${slide.text_color === 'light' ? 'white' : 'black'} text-xs`}>
                            <h4 className="font-bold truncate">{slide.title}</h4>
                            {slide.subtitle && <p className="truncate opacity-80">{slide.subtitle}</p>}
                          </div>
                        </div>

                        {/* Slide Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold text-dark truncate">{slide.title}</h3>
                            <div className="flex items-center space-x-2">
                              <Badge variant={slide.is_active ? 'default' : 'secondary'}>
                                {slide.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                              <Badge variant="outline">#{index + 1}</Badge>
                            </div>
                          </div>
                          
                          {slide.subtitle && (
                            <p className="text-dark/70 mb-2">{slide.subtitle}</p>
                          )}
                          
                          {slide.description && (
                            <p className="text-sm text-dark/60 mb-3 line-clamp-2">{slide.description}</p>
                          )}

                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4 text-sm text-dark/60">
                              <span>Position: {slide.text_position}</span>
                              <span>Style: {slide.button_style}</span>
                              {slide.button_text && <span>CTA: "{slide.button_text}"</span>}
                            </div>

                            <div className="flex items-center space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleActive(slide.id, slide.is_active)}
                                className="text-dark hover:bg-coyote/20"
                              >
                                {slide.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditModal(slide)}
                                className="text-canyon hover:bg-canyon/10"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteSlide(slide.id)}
                                className="text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Slide Edit Modal */}
      <Dialog open={showSlideModal} onOpenChange={setShowSlideModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-creme border-coyote">
          <DialogHeader className="border-b border-coyote pb-4">
            <DialogTitle className="text-dark">
              {editingSlide?.id ? 'Edit Hero Slide' : 'Create Hero Slide'}
            </DialogTitle>
          </DialogHeader>

          <div className="py-6">
            <Tabs defaultValue="content" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-coyote/20">
                <TabsTrigger value="content" className="data-[state=active]:bg-canyon data-[state=active]:text-creme">
                  <Type className="h-4 w-4 mr-2" />
                  Content
                </TabsTrigger>
                <TabsTrigger value="design" className="data-[state=active]:bg-canyon data-[state=active]:text-creme">
                  <Palette className="h-4 w-4 mr-2" />
                  Design
                </TabsTrigger>
                <TabsTrigger value="images" className="data-[state=active]:bg-canyon data-[state=active]:text-creme">
                  <Monitor className="h-4 w-4 mr-2" />
                  Images
                </TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-dark font-medium">Title *</Label>
                    <Input
                      value={editingSlide?.title || ''}
                      onChange={(e) => setEditingSlide(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Enter slide title"
                      className="bg-creme border-coyote text-dark mt-2"
                    />
                  </div>
                  <div>
                    <Label className="text-dark font-medium">Subtitle</Label>
                    <Input
                      value={editingSlide?.subtitle || ''}
                      onChange={(e) => setEditingSlide(prev => ({ ...prev, subtitle: e.target.value }))}
                      placeholder="Enter subtitle (optional)"
                      className="bg-creme border-coyote text-dark mt-2"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-dark font-medium">Description</Label>
                  <Textarea
                    value={editingSlide?.description || ''}
                    onChange={(e) => setEditingSlide(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter slide description"
                    rows={3}
                    className="bg-creme border-coyote text-dark mt-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-dark font-medium">Button Text</Label>
                    <Input
                      value={editingSlide?.button_text || ''}
                      onChange={(e) => setEditingSlide(prev => ({ ...prev, button_text: e.target.value }))}
                      placeholder="e.g., Shop Now"
                      className="bg-creme border-coyote text-dark mt-2"
                    />
                  </div>
                  <div>
                    <Label className="text-dark font-medium">Button URL</Label>
                    <Input
                      value={editingSlide?.button_url || ''}
                      onChange={(e) => setEditingSlide(prev => ({ ...prev, button_url: e.target.value }))}
                      placeholder="e.g., /products"
                      className="bg-creme border-coyote text-dark mt-2"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="design" className="mt-6 space-y-6">
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <Label className="text-dark font-medium">Text Position</Label>
                    <Select
                      value={editingSlide?.text_position || 'left'}
                      onValueChange={(value: 'left' | 'center' | 'right') => setEditingSlide(prev => ({ ...prev, text_position: value }))}
                    >
                      <SelectTrigger className="bg-creme border-coyote text-dark mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-creme border-coyote">
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-dark font-medium">Text Color</Label>
                    <Select
                      value={editingSlide?.text_color || 'light'}
                      onValueChange={(value: 'light' | 'dark') => setEditingSlide(prev => ({ ...prev, text_color: value }))}
                    >
                      <SelectTrigger className="bg-creme border-coyote text-dark mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-creme border-coyote">
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-dark font-medium">Button Style</Label>
                    <Select
                      value={editingSlide?.button_style || 'primary'}
                      onValueChange={(value: 'primary' | 'secondary' | 'outline') => setEditingSlide(prev => ({ ...prev, button_style: value }))}
                    >
                      <SelectTrigger className="bg-creme border-coyote text-dark mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-creme border-coyote">
                        <SelectItem value="primary">Primary</SelectItem>
                        <SelectItem value="secondary">Secondary</SelectItem>
                        <SelectItem value="outline">Outline</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-dark font-medium">Overlay Opacity: {editingSlide?.overlay_opacity || 40}%</Label>
                  <Slider
                    value={[editingSlide?.overlay_opacity || 40]}
                    onValueChange={(value: number[]) => setEditingSlide(prev => ({ ...prev, overlay_opacity: value[0] }))}
                    max={80}
                    min={0}
                    step={5}
                    className="mt-3"
                  />
                </div>
              </TabsContent>

              <TabsContent value="images" className="mt-6 space-y-6">
                <div>
                  <EnhancedImageUpload
                    imageUrl={editingSlide?.image_url || null}
                    onImageUrlChange={(url) => setEditingSlide(prev => ({ ...prev, image_url: url || '' }))}
                    title="Desktop Image *"
                    description="Main hero image for desktop and tablet devices"
                    aspectRatio="landscape"
                  />
                </div>

                <div>
                  <EnhancedImageUpload
                    imageUrl={editingSlide?.mobile_image_url || null}
                    onImageUrlChange={(url) => setEditingSlide(prev => ({ ...prev, mobile_image_url: url || '' }))}
                    title="Mobile Image (Optional)"
                    description="Optimized image for mobile devices"
                    aspectRatio="portrait"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t border-coyote">
            <Button
              variant="outline"
              onClick={() => setShowSlideModal(false)}
              className="border-coyote text-dark hover:bg-coyote/20"
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button
              onClick={handleSaveSlide}
              disabled={loading || !editingSlide?.title || !editingSlide?.image_url}
              className="bg-canyon hover:bg-canyon/90 text-creme"
            >
              <Save className="mr-2 h-4 w-4" />
              {loading ? 'Saving...' : editingSlide?.id ? 'Update Slide' : 'Create Slide'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
