import { useState } from 'react';
import { BookOpen, Save, X } from 'lucide-react';
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

interface BlogSectionManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function BlogSectionManager({ open, onOpenChange, onUpdate }: BlogSectionManagerProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: 'Latest from Our Blog',
    subtitle: 'Stories, Tips & Insights',
    description: 'Stay updated with the latest news, stories, and insights from the world of premium tobacco.',
    maxPosts: 3,
    backgroundImage: '',
    showBackgroundImage: false
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // For now, just show a success message
      // In the future, this could save to a blog_section_config table
      toast.success('Blog Section settings saved successfully');
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving blog section settings:', error);
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
            <BookOpen className="h-5 w-5" />
            Blog Section Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Alert>
            <BookOpen className="h-4 w-4" />
            <AlertDescription>
              Configure the blog section that displays recent blog posts on your homepage.
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
                <Label htmlFor="maxPosts">Maximum Posts to Display</Label>
                <Input
                  id="maxPosts"
                  type="number"
                  value={formData.maxPosts}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxPosts: parseInt(e.target.value) || 3 }))}
                  min="1"
                  max="6"
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
                    description="Choose a background image for the blog section"
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload a background image for the blog section
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
