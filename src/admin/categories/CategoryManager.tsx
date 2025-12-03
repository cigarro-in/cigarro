import { useState, useEffect } from 'react';
import { Plus, Search, ArrowLeft, Trash2, FolderTree, Save } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { ImageUpload } from '../../components/ui/ImageUpload';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';

// Database-aligned Category interface
interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  image_alt_text: string | null;
  meta_title: string | null;
  meta_description: string | null;
  created_at: string;
  updated_at: string;
  product_count?: number;
}

interface CategoryManagerProps {
  onStatsUpdate: () => void;
}

export default function CategoryManager({ onStatsUpdate }: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '',
    description: '',
    image: '',
    image_alt_text: '',
    meta_title: '',
    meta_description: ''
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  };

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      image: '',
      image_alt_text: '',
      meta_title: '',
      meta_description: ''
    });
  };

  const openCreate = () => {
    resetForm();
    setSelectedCategory(null);
    setIsCreating(true);
  };

  const openEdit = (category: Category) => {
    setForm({
      name: category.name || '',
      description: category.description || '',
      image: category.image || '',
      image_alt_text: category.image_alt_text || '',
      meta_title: category.meta_title || '',
      meta_description: category.meta_description || ''
    });
    setSelectedCategory(category);
    setIsCreating(false);
  };

  const closeEditor = () => {
    setSelectedCategory(null);
    setIsCreating(false);
    resetForm();
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        slug: generateSlug(form.name),
        description: form.description.trim() || null,
        image: form.image || null,
        image_alt_text: form.image_alt_text.trim() || null,
        meta_title: form.meta_title.trim() || null,
        meta_description: form.meta_description.trim() || null
      };

      if (selectedCategory) {
        const { error } = await supabase
          .from('categories')
          .update(data)
          .eq('id', selectedCategory.id);
        if (error) throw error;
        toast.success('Category updated');
      } else {
        const { error } = await supabase
          .from('categories')
          .insert(data);
        if (error) throw error;
        toast.success('Category created');
      }

      closeEditor();
      loadCategories();
      onStatsUpdate();
    } catch (error: any) {
      console.error('Error saving category:', error);
      if (error?.code === '23505') {
        toast.error('A category with this name already exists');
      } else {
        toast.error(error?.message || 'Failed to save category');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;
    if (!confirm(`Delete "${selectedCategory.name}"? This cannot be undone.`)) return;

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', selectedCategory.id);
      if (error) throw error;
      toast.success('Category deleted');
      closeEditor();
      loadCategories();
      onStatsUpdate();
    } catch (error: any) {
      console.error('Error deleting category:', error);
      toast.error(error?.message || 'Failed to delete category');
    }
  };

  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Show editor view
  if (selectedCategory || isCreating) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={closeEditor}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">
              {isCreating ? 'New Category' : `Edit: ${selectedCategory?.name}`}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {selectedCategory && (
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Category'}
            </Button>
          </div>
        </div>

        {/* Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h2 className="font-semibold text-lg">Basic Information</h2>
              
              <div>
                <Label htmlFor="name">Category Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Enter category name"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of the category"
                  rows={3}
                />
              </div>
            </div>

            {/* SEO */}
            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h2 className="font-semibold text-lg">SEO Settings</h2>
              
              <div>
                <Label htmlFor="meta_title">Meta Title</Label>
                <Input
                  id="meta_title"
                  value={form.meta_title}
                  onChange={e => setForm(f => ({ ...f, meta_title: e.target.value }))}
                  placeholder="SEO title for search engines"
                />
              </div>

              <div>
                <Label htmlFor="meta_desc">Meta Description</Label>
                <Textarea
                  id="meta_desc"
                  value={form.meta_description}
                  onChange={e => setForm(f => ({ ...f, meta_description: e.target.value }))}
                  placeholder="SEO description for search engines"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Image */}
            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h2 className="font-semibold text-lg">Category Image</h2>
              <ImageUpload
                imageUrl={form.image || null}
                onImageUrlChange={(url) => setForm(f => ({ ...f, image: url || '' }))}
                showSelector={true}
              />
              <div>
                <Label htmlFor="alt">Image Alt Text</Label>
                <Input
                  id="alt"
                  value={form.image_alt_text}
                  onChange={e => setForm(f => ({ ...f, image_alt_text: e.target.value }))}
                  placeholder="Describe the image"
                />
              </div>
            </div>

            {/* Info */}
            {selectedCategory && (
              <div className="bg-white rounded-lg border p-6 space-y-2 text-sm text-gray-500">
                <p>Created: {new Date(selectedCategory.created_at).toLocaleDateString()}</p>
                <p>Updated: {new Date(selectedCategory.updated_at).toLocaleDateString()}</p>
                <p>Slug: {selectedCategory.slug}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-gray-500">{categories.length} categories total</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search categories..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {searchTerm ? 'No categories match your search' : 'No categories yet. Create your first category!'}
        </div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {filteredCategories.map(category => (
            <div
              key={category.id}
              onClick={() => openEdit(category)}
              className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              {/* Image */}
              <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {category.image ? (
                  <img src={category.image} alt={category.name} className="w-full h-full object-cover" />
                ) : (
                  <FolderTree className="h-6 w-6 text-gray-400" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <span className="font-medium truncate block">{category.name}</span>
                {category.description && (
                  <p className="text-sm text-gray-500 truncate">{category.description}</p>
                )}
              </div>

              {/* Product count */}
              <Badge variant="secondary">
                {category.product_count || 0} products
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
