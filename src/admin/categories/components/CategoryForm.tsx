import { useState, useEffect } from 'react';
import { Save, X, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Switch } from '../../../components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabase/client';
import { ImageUpload } from '../../../components/ui/ImageUpload';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  image_alt_text: string;
  is_active: boolean;
}

interface CategoryFormProps {
  category?: Category | null;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: (category: any) => void;
}

interface CategoryFormData {
  name: string;
  slug: string;
  description: string;
  image: string;
  image_alt_text: string;
  is_active: boolean;
}

export function CategoryForm({ category, onSave, onCancel, onDelete }: CategoryFormProps) {
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    slug: '',
    description: '',
    image: '',
    image_alt_text: '',
    is_active: true
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        slug: category.slug,
        description: category.description,
        image: category.image,
        image_alt_text: category.image_alt_text,
        is_active: category.is_active
      });
    }
  }, [category]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: generateSlug(name)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const categoryData = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        image: formData.image,
        image_alt_text: formData.image_alt_text,
        is_active: formData.is_active
      };

      let error;
      if (category) {
        // Update existing category
        ({ error } = await supabase
          .from('categories')
          .update(categoryData)
          .eq('id', category.id));
      } else {
        // Create new category
        ({ error } = await supabase
          .from('categories')
          .insert([categoryData]));
      }

      if (error) throw error;

      toast.success(category ? 'Category updated successfully' : 'Category created successfully');
      onSave();
    } catch (error) {
      console.error('Error saving category:', error);
      toast.error('Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 admin-form">
      <Card className="bg-creme-light border-coyote">
        <CardHeader>
          <CardTitle className="text-dark">Category Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Category Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Enter category name"
                required
              />
            </div>
            <div>
              <Label htmlFor="slug">URL Slug</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                placeholder="category-url-slug"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter category description"
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked: boolean) => setFormData(prev => ({ ...prev, is_active: checked }))}
            />
            <Label htmlFor="is_active">Category is active</Label>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-creme-light border-coyote">
        <CardHeader>
          <CardTitle className="text-dark">Category Image</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ImageUpload
            imageUrl={formData.image || null}
            onImageUrlChange={(url: string | null) => setFormData(prev => ({ ...prev, image: url || '' }))}
            showSelector={true}
          />

          <div>
            <Label htmlFor="image_alt_text">Image Alt Text</Label>
            <Input
              id="image_alt_text"
              value={formData.image_alt_text}
              onChange={(e) => setFormData(prev => ({ ...prev, image_alt_text: e.target.value }))}
              placeholder="Alt text for category image"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between pt-6 border-t border-coyote">
        {category && onDelete && (
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => onDelete(category)}
            className="border-red-300 text-red-600 hover:bg-red-50"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Category
          </Button>
        )}
        <div className="flex space-x-3 ml-auto">
          <Button type="button" variant="outline" onClick={onCancel} className="border-coyote text-dark hover:bg-coyote/20">
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="bg-canyon hover:bg-canyon/90 text-creme">
            <Save className="mr-2 h-4 w-4" />
            {loading ? 'Saving...' : category ? 'Update Category' : 'Create Category'}
          </Button>
        </div>
      </div>
    </form>
  );
}
