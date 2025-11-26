import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Switch } from '../../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { supabase } from '../../../lib/supabase/client';
import { Collection, generateSlug } from '../../../types/product';
import { toast } from 'sonner';
import { ImageUpload } from '../../../components/ui/ImageUpload';

interface CollectionEditorProps {
  initialData?: Collection;
  onSave: () => void;
  onCancel: () => void;
}

export function CollectionEditor({ initialData, onSave, onCancel }: CollectionEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    slug: initialData?.slug || '',
    description: initialData?.description || '',
    image_url: initialData?.image_url || '',
    type: initialData?.type || 'manual',
    sort_order: initialData?.sort_order || 0,
    is_active: initialData?.is_active ?? true,
    seo_title: initialData?.seo_title || '',
    seo_description: initialData?.seo_description || ''
  });

  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(!!initialData?.slug);

  useEffect(() => {
    if (!isSlugManuallyEdited && formData.title) {
      setFormData(prev => ({ ...prev, slug: generateSlug(prev.title) }));
    }
  }, [formData.title, isSlugManuallyEdited]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) {
      toast.error('Title is required');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        updated_at: new Date().toISOString()
      };

      if (initialData?.id) {
        const { error } = await supabase
          .from('collections')
          .update(payload)
          .eq('id', initialData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('collections')
          .insert([{ ...payload, created_at: new Date().toISOString() }]);
        if (error) throw error;
      }

      toast.success(`Collection ${initialData ? 'updated' : 'created'} successfully`);
      onSave();
    } catch (error) {
      console.error('Error saving collection:', error);
      toast.error('Failed to save collection');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">
              {initialData ? 'Edit Collection' : 'Create Collection'}
            </h2>
            <p className="text-muted-foreground">
              {initialData ? 'Update existing collection details' : 'Add a new collection to your store'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Collection'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        {/* Main Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Title <span className="text-red-500">*</span></Label>
                <Input 
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Summer Essentials"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea 
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe this collection..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Search Engine Optimization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Page Title</Label>
                <Input 
                  value={formData.seo_title}
                  onChange={(e) => setFormData({ ...formData, seo_title: e.target.value })}
                  placeholder="SEO Title"
                />
              </div>
              <div className="space-y-2">
                <Label>Meta Description</Label>
                <Textarea 
                  value={formData.seo_description}
                  onChange={(e) => setFormData({ ...formData, seo_description: e.target.value })}
                  placeholder="SEO Description"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>URL Handle</Label>
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 p-2 rounded border">
                  <span>/collections/</span>
                  <input 
                    className="bg-transparent border-none focus:outline-none flex-1 font-medium text-foreground"
                    value={formData.slug}
                    onChange={(e) => {
                      setIsSlugManuallyEdited(true);
                      setFormData({ ...formData, slug: generateSlug(e.target.value) });
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Organization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Status</Label>
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={formData.is_active}
                    onCheckedChange={(checked: boolean) => setFormData({ ...formData, is_active: checked })}
                  />
                  <span className="text-sm text-muted-foreground">
                    {formData.is_active ? 'Active' : 'Draft'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Collection Type</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(value: 'manual' | 'smart') => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="smart">Smart (Automated)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {formData.type === 'manual' 
                    ? 'Add products manually to this collection.'
                    : 'Products will be automatically added based on conditions.'}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input 
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Collection Image</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageUpload 
                imageUrl={formData.image_url}
                onImageUrlChange={(url) => setFormData({ ...formData, image_url: url || '' })}
                showSelector={true}
                title="Cover Image"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
