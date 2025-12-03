import { useState, useEffect } from 'react';
import { Plus, Search, ArrowLeft, Trash2, Layers, Save } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Switch } from '../../../components/ui/switch';
import { ImageUpload } from '../../../components/ui/ImageUpload';
import { supabase } from '../../../lib/supabase/client';
import { toast } from 'sonner';

interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  is_active: boolean;
  sort_order: number;
  meta_title: string | null;
  meta_description: string | null;
  created_at: string;
  updated_at: string;
}

export function CollectionsManager() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    image: '',
    is_active: true,
    meta_title: '',
    meta_description: ''
  });

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setCollections(data || []);
    } catch (error) {
      console.error('Error loading collections:', error);
      toast.error('Failed to load collections');
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
      is_active: true,
      meta_title: '',
      meta_description: ''
    });
  };

  const openCreate = () => {
    resetForm();
    setSelectedCollection(null);
    setIsCreating(true);
  };

  const openEdit = (collection: Collection) => {
    setForm({
      name: collection.name || '',
      description: collection.description || '',
      image: collection.image || '',
      is_active: collection.is_active ?? true,
      meta_title: collection.meta_title || '',
      meta_description: collection.meta_description || ''
    });
    setSelectedCollection(collection);
    setIsCreating(false);
  };

  const closeEditor = () => {
    setSelectedCollection(null);
    setIsCreating(false);
    resetForm();
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Collection name is required');
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        slug: generateSlug(form.name),
        description: form.description.trim() || null,
        image: form.image || null,
        is_active: form.is_active,
        meta_title: form.meta_title.trim() || null,
        meta_description: form.meta_description.trim() || null,
        sort_order: selectedCollection?.sort_order ?? collections.length
      };

      if (selectedCollection) {
        const { error } = await supabase
          .from('collections')
          .update(data)
          .eq('id', selectedCollection.id);
        if (error) throw error;
        toast.success('Collection updated');
      } else {
        const { error } = await supabase
          .from('collections')
          .insert(data);
        if (error) throw error;
        toast.success('Collection created');
      }

      closeEditor();
      loadCollections();
    } catch (error: any) {
      console.error('Error saving collection:', error);
      toast.error(error?.message || 'Failed to save collection');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCollection) return;
    if (!confirm(`Delete "${selectedCollection.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('collections')
        .delete()
        .eq('id', selectedCollection.id);
      if (error) throw error;
      toast.success('Collection deleted');
      closeEditor();
      loadCollections();
    } catch (error: any) {
      console.error('Error deleting collection:', error);
      toast.error(error?.message || 'Failed to delete collection');
    }
  };

  const filteredCollections = collections.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (selectedCollection || isCreating) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={closeEditor}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">
              {isCreating ? 'New Collection' : `Edit: ${selectedCollection?.name}`}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {selectedCollection && (
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h2 className="font-semibold text-lg">Basic Information</h2>
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Collection name"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>

            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h2 className="font-semibold text-lg">SEO</h2>
              <div>
                <Label htmlFor="meta_title">Meta Title</Label>
                <Input
                  id="meta_title"
                  value={form.meta_title}
                  onChange={e => setForm(f => ({ ...f, meta_title: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="meta_desc">Meta Description</Label>
                <Textarea
                  id="meta_desc"
                  value={form.meta_description}
                  onChange={e => setForm(f => ({ ...f, meta_description: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h2 className="font-semibold text-lg">Image</h2>
              <ImageUpload
                imageUrl={form.image || null}
                onImageUrlChange={(url) => setForm(f => ({ ...f, image: url || '' }))}
                showSelector={true}
              />
            </div>

            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h2 className="font-semibold text-lg">Status</h2>
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={checked => setForm(f => ({ ...f, is_active: checked }))}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Collections</h1>
          <p className="text-gray-500">{collections.length} collections</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Collection
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      ) : filteredCollections.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {searchTerm ? 'No collections found' : 'No collections yet'}
        </div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {filteredCollections.map(collection => (
            <div
              key={collection.id}
              onClick={() => openEdit(collection)}
              className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer"
            >
              <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                {collection.image ? (
                  <img src={collection.image} alt={collection.name} className="w-full h-full object-cover" />
                ) : (
                  <Layers className="h-6 w-6 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <span className="font-medium">{collection.name}</span>
                {collection.description && (
                  <p className="text-sm text-gray-500 truncate">{collection.description}</p>
                )}
              </div>
              <Badge variant={collection.is_active ? 'default' : 'secondary'}>
                {collection.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
