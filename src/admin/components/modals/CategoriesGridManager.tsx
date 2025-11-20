import { useState, useEffect } from 'react';
import { Grid3X3, Save, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { ImageUpload } from '../../../components/ui/ImageUpload';
import { supabase } from '../../../lib/supabase/client';
import { toast } from 'sonner';

interface CategoriesGridManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function CategoriesGridManager({ open, onOpenChange, onUpdate }: CategoriesGridManagerProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: 'Shop by Category',
    subtitle: 'Find Your Perfect Match',
    description: 'Browse our carefully curated categories to discover the perfect tobacco products for your taste and preferences.',
    maxCategories: 6,
    backgroundImage: '',
    showBackgroundImage: false
  });

  useEffect(() => {
    if (open) {
      loadCategoriesGridData();
    }
  }, [open]);

  const loadCategoriesGridData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('section_configurations')
        .select('*')
        .eq('section_name', 'categories_grid')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setFormData({
          title: data.title || 'Shop by Category',
          subtitle: data.subtitle || 'Find Your Perfect Match',
          description: data.description || 'Browse our carefully curated categories to discover the perfect tobacco products for your taste and preferences.',
          maxCategories: data.max_items || 6,
          backgroundImage: data.background_image || '',
          showBackgroundImage: !!data.background_image
        });
      }
    } catch (error) {
      console.error('Error loading categories grid data:', error);
      toast.error('Failed to load categories grid data');
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
          section_name: 'categories_grid',
          title: formData.title,
          subtitle: formData.subtitle,
          description: formData.description,
          background_image: formData.backgroundImage,
          max_items: formData.maxCategories,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'section_name'
        });

      if (error) throw error;

      toast.success('Categories Grid settings saved successfully');
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving categories grid settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5" />
            Categories Grid Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Alert>
            <Grid3X3 className="h-4 w-4" />
            <AlertDescription>
              Configure the categories grid section that displays product categories on your homepage.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Content Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter description"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="maxCategories">Maximum Categories to Display</Label>
                <Input
                  id="maxCategories"
                  type="number"
                  value={formData.maxCategories}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxCategories: parseInt(e.target.value) || 6 }))}
                  min="1"
                  max="12"
                />
              </div>

              <div>
                <Label>Background Image (Optional)</Label>
                <div className="space-y-2">
                  <ImageUpload
                    imageUrl={formData.backgroundImage}
                    onImageUrlChange={(url) => setFormData(prev => ({ ...prev, backgroundImage: url || '' }))}
                    showSelector={true}
                    title="Select Background Image"
                    description="Choose a background image for the categories section"
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload a background image for the categories section
                  </p>
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
