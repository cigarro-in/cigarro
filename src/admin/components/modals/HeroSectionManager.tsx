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
  AlertCircle,
  CheckCircle,
  ExternalLink
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Switch } from '../../../components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Badge } from '../../../components/ui/badge';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../../components/ui/dropdown-menu';
import { ImageUpload } from '../../../components/ui/ImageUpload';
import { supabase } from '../../../lib/supabase/client';
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

export function HeroSectionManager({ open, onOpenChange, onUpdate }: HeroSectionManagerProps) {
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
    product_name: '',
    product_price: '',
    product_image_url: '',
    is_active: true,
    sort_order: 0
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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
      console.error('Error loading hero slides:', error);
      toast.error('Failed to load hero slides');
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.title?.trim()) {
      errors.title = 'Title is required';
    }
    if (!formData.image_url?.trim()) {
      errors.image_url = 'Main image is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      if (editingSlide) {
        // Update existing slide
        const { error } = await supabase
          .from('hero_slides')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingSlide.id);

        if (error) throw error;
        toast.success('Hero slide updated successfully');
      } else {
        // Create new slide
        const maxOrder = Math.max(...slides.map(s => s.sort_order), 0);
        const { error } = await supabase
          .from('hero_slides')
          .insert({
            ...formData,
            sort_order: maxOrder + 1
          });

        if (error) throw error;
        toast.success('Hero slide created successfully');
      }

      setShowSlideModal(false);
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
        product_name: '',
        product_price: '',
        product_image_url: '',
        is_active: true,
        sort_order: 0
      });
      setFormErrors({});
      loadSlides();
      onUpdate();
    } catch (error) {
      console.error('Error saving hero slide:', error);
      toast.error('Failed to save hero slide');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (slide: HeroSlide) => {
    setEditingSlide(slide);
    setFormData(slide);
    setShowSlideModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this hero slide?')) return;

    try {
      const { error } = await supabase
        .from('hero_slides')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Hero slide deleted successfully');
      loadSlides();
      onUpdate();
    } catch (error) {
      console.error('Error deleting hero slide:', error);
      toast.error('Failed to delete hero slide');
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('hero_slides')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Hero slide ${isActive ? 'activated' : 'deactivated'}`);
      loadSlides();
      onUpdate();
    } catch (error) {
      console.error('Error toggling hero slide:', error);
      toast.error('Failed to update hero slide');
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;

    const newSlides = [...slides];
    [newSlides[index - 1], newSlides[index]] = [newSlides[index], newSlides[index - 1]];

    // Update sort orders
    const updates = newSlides.map((slide, idx) => ({
      id: slide.id,
      sort_order: idx + 1
    }));

    try {
      for (const update of updates) {
        await supabase
          .from('hero_slides')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
      }

      setSlides(newSlides);
      toast.success('Slide order updated');
      onUpdate();
    } catch (error) {
      console.error('Error updating slide order:', error);
      toast.error('Failed to update slide order');
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === slides.length - 1) return;

    const newSlides = [...slides];
    [newSlides[index], newSlides[index + 1]] = [newSlides[index + 1], newSlides[index]];

    // Update sort orders
    const updates = newSlides.map((slide, idx) => ({
      id: slide.id,
      sort_order: idx + 1
    }));

    try {
      for (const update of updates) {
        await supabase
          .from('hero_slides')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
      }

      setSlides(newSlides);
      toast.success('Slide order updated');
      onUpdate();
    } catch (error) {
      console.error('Error updating slide order:', error);
      toast.error('Failed to update slide order');
    }
  };

  const handleNewSlide = () => {
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
      product_name: '',
      product_price: '',
      product_image_url: '',
      is_active: true,
      sort_order: 0
    });
    setFormErrors({});
    setShowSlideModal(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Hero Slides</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Header Actions */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Manage the hero carousel slides that appear at the top of your homepage.
                </p>
              </div>
              <Button onClick={handleNewSlide}>
                <Plus className="h-4 w-4 mr-2" />
                Add New Slide
              </Button>
            </div>

            {/* Slides List */}
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : slides.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Hero Slides</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first hero slide to get started.
                  </p>
                  <Button onClick={handleNewSlide}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Slide
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {slides.map((slide, index) => (
                  <Card key={slide.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex flex-col space-y-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMoveUp(index)}
                              disabled={index === 0}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMoveDown(index)}
                              disabled={index === slides.length - 1}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          <div className="w-16 h-12 rounded-lg overflow-hidden bg-muted">
                            {slide.image_url ? (
                              <img 
                                src={slide.image_url} 
                                alt={slide.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="font-medium">{slide.title}</h3>
                              <Badge variant={slide.is_active ? "default" : "secondary"}>
                                {slide.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            {slide.subtitle && (
                              <p className="text-sm text-muted-foreground">{slide.subtitle}</p>
                            )}
                            {slide.button_text && (
                              <div className="flex items-center space-x-2 mt-1">
                                <span className="text-xs text-muted-foreground">Button:</span>
                                <span className="text-xs font-medium">{slide.button_text}</span>
                                {slide.button_url && (
                                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={slide.is_active}
                            onCheckedChange={(checked: boolean) => handleToggleActive(slide.id, checked)}
                          />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onClick={() => handleEdit(slide)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDelete(slide.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {/* Slide Form Modal */}
      <Dialog open={showSlideModal} onOpenChange={setShowSlideModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSlide ? 'Edit Hero Slide' : 'Create New Hero Slide'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Basic Information</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title || ''}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter slide title"
                  />
                  {formErrors.title && (
                    <p className="text-sm text-destructive">{formErrors.title}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subtitle">Subtitle</Label>
                  <Input
                    id="subtitle"
                    value={formData.subtitle || ''}
                    onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                    placeholder="Enter subtitle (optional)"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter description (optional)"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="button_text">Button Text</Label>
                  <Input
                    id="button_text"
                    value={formData.button_text || ''}
                    onChange={(e) => setFormData({ ...formData, button_text: e.target.value })}
                    placeholder="Enter button text (optional)"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="button_url">Button URL</Label>
                  <Input
                    id="button_url"
                    value={formData.button_url || ''}
                    onChange={(e) => setFormData({ ...formData, button_url: e.target.value })}
                    placeholder="Enter button URL (optional)"
                  />
                </div>
              </div>

              {/* Images */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Images</h3>
                
                <div className="space-y-2">
                  <Label>Main Image *</Label>
                  <ImageUpload
                    imageUrl={formData.image_url || null}
                    onImageUrlChange={(url: string | null) => setFormData({ ...formData, image_url: url || '' })}
                  />
                  {formErrors.image_url && (
                    <p className="text-sm text-destructive">{formErrors.image_url}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Mobile Image</Label>
                  <ImageUpload
                    imageUrl={formData.mobile_image_url || null}
                    onImageUrlChange={(url: string | null) => setFormData({ ...formData, mobile_image_url: url || '' })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Small Image</Label>
                  <ImageUpload
                    imageUrl={formData.small_image_url || null}
                    onImageUrlChange={(url: string | null) => setFormData({ ...formData, small_image_url: url || '' })}
                  />
                </div>
              </div>
            </div>

            {/* Product Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Product Information (Optional)</h3>
              <p className="text-sm text-muted-foreground">
                Add product details to show a product card on this slide.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="product_name">Product Name</Label>
                  <Input
                    id="product_name"
                    value={formData.product_name || ''}
                    onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                    placeholder="Enter product name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product_price">Product Price</Label>
                  <Input
                    id="product_price"
                    value={formData.product_price || ''}
                    onChange={(e) => setFormData({ ...formData, product_price: e.target.value })}
                    placeholder="Enter product price"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Product Image</Label>
                  <ImageUpload
                    imageUrl={formData.product_image_url || null}
                    onImageUrlChange={(url: string | null) => setFormData({ ...formData, product_image_url: url || '' })}
                  />
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active || false}
                onCheckedChange={(checked: boolean) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowSlideModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {editingSlide ? 'Update' : 'Create'} Slide
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
