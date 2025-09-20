import { useState, useEffect } from 'react';
import { Settings, Save, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Alert, AlertDescription } from '../../ui/alert';
import { ImageUpload } from '../../ui/ImageUpload';
import { supabase } from '../../../utils/supabase/client';
import { toast } from 'sonner';

interface BrandHeritageManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function BrandHeritageManager({ open, onOpenChange, onUpdate }: BrandHeritageManagerProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: 'Our Heritage',
    subtitle: 'Crafting Excellence Since 1952',
    description: 'For over seven decades, we have been dedicated to the art of tobacco cultivation and the creation of premium products that embody tradition, quality, and innovation.',
    imageUrl: 'https://your-project.supabase.co/storage/v1/object/public/brand-heritage/DSC07229_FULL_1.webp',
    buttonText: 'Learn More',
    buttonUrl: '/about'
  });

  useEffect(() => {
    if (open) {
      loadBrandHeritageData();
    }
  }, [open]);

  const loadBrandHeritageData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('section_configurations')
        .select('*')
        .eq('section_name', 'brand_heritage')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (data) {
        setFormData({
          title: data.title || 'Our Heritage',
          subtitle: data.subtitle || 'Crafting Excellence Since 1952',
          description: data.description || 'For over seven decades, we have been dedicated to the art of tobacco cultivation and the creation of premium products that embody tradition, quality, and innovation.',
          imageUrl: data.background_image || '',
          buttonText: data.button_text || 'Learn More',
          buttonUrl: data.button_url || '/about'
        });
      } else {
        // Use default values if no data exists
        setFormData({
          title: 'Our Heritage',
          subtitle: 'Crafting Excellence Since 1952',
          description: 'For over seven decades, we have been dedicated to the art of tobacco cultivation and the creation of premium products that embody tradition, quality, and innovation.',
          imageUrl: '',
          buttonText: 'Learn More',
          buttonUrl: '/about'
        });
      }
    } catch (error) {
      console.error('Error loading brand heritage data:', error);
      toast.error('Failed to load brand heritage data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('section_configurations')
        .upsert({
          section_name: 'brand_heritage',
          title: formData.title,
          subtitle: formData.subtitle,
          description: formData.description,
          background_image: formData.imageUrl,
          button_text: formData.buttonText,
          button_url: formData.buttonUrl,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'section_name'
        });

      if (error) throw error;

      toast.success('Brand Heritage settings saved successfully');
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving brand heritage settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Brand Heritage Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Alert>
            <Settings className="h-4 w-4" />
            <AlertDescription>
              Configure the brand heritage section that appears on your homepage. This section showcases your company's story and values.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Content Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Section Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter section title"
                  />
                </div>

                <div>
                  <Label htmlFor="subtitle">Subtitle</Label>
                  <Input
                    id="subtitle"
                    value={formData.subtitle}
                    onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
                    placeholder="Enter subtitle"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter description"
                  rows={4}
                />
              </div>

              <div>
                <Label>Background Image</Label>
                <div className="space-y-2">
                  <ImageUpload
                    imageUrl={formData.imageUrl}
                    onImageUrlChange={(url) => setFormData(prev => ({ ...prev, imageUrl: url }))}
                    showSelector={true}
                    title="Select Background Image"
                    description="Choose a background image for the brand heritage section"
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload an image for the brand heritage section background
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="buttonText">Button Text</Label>
                  <Input
                    id="buttonText"
                    value={formData.buttonText}
                    onChange={(e) => setFormData(prev => ({ ...prev, buttonText: e.target.value }))}
                    placeholder="Enter button text"
                  />
                </div>

                <div>
                  <Label htmlFor="buttonUrl">Button URL</Label>
                  <Input
                    id="buttonUrl"
                    value={formData.buttonUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, buttonUrl: e.target.value }))}
                    placeholder="Enter button URL"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
