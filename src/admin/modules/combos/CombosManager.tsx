import { useState, useEffect } from 'react';
import { Plus, Search, ArrowLeft, Trash2, Package, Save } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Switch } from '../../../components/ui/switch';
import { ImageUpload } from '../../../components/ui/ImageUpload';
import { supabase } from '../../../lib/supabase/client';
import { toast } from 'sonner';
import { formatINR } from '../../../utils/currency';

// Database-aligned Combo interface
interface Combo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  combo_price: number;
  original_price: number | null;
  discount_percentage: number | null;
  image: string | null;
  gallery_images: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  combo_items?: ComboItem[];
}

interface ComboItem {
  id: string;
  variant_id: string;
  quantity: number;
  variant?: {
    id: string;
    variant_name: string;
    price: number;
    product?: { name: string };
  };
}

export function CombosManager() {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCombo, setSelectedCombo] = useState<Combo | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '',
    description: '',
    combo_price: 0,
    original_price: 0,
    image: '',
    is_active: true
  });

  useEffect(() => {
    loadCombos();
  }, []);

  const loadCombos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('combos')
        .select(`
          *,
          combo_items(
            id,
            variant_id,
            quantity,
            product_variants(id, variant_name, price, products(name))
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform nested data
      const transformed = (data || []).map(combo => ({
        ...combo,
        combo_items: combo.combo_items?.map((item: any) => ({
          ...item,
          variant: item.product_variants
        }))
      }));
      
      setCombos(transformed);
    } catch (error) {
      console.error('Error loading combos:', error);
      toast.error('Failed to load combos');
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
      combo_price: 0,
      original_price: 0,
      image: '',
      is_active: true
    });
  };

  const openCreate = () => {
    resetForm();
    setSelectedCombo(null);
    setIsCreating(true);
  };

  const openEdit = (combo: Combo) => {
    setForm({
      name: combo.name || '',
      description: combo.description || '',
      combo_price: combo.combo_price || 0,
      original_price: combo.original_price || 0,
      image: combo.image || '',
      is_active: combo.is_active ?? true
    });
    setSelectedCombo(combo);
    setIsCreating(false);
  };

  const closeEditor = () => {
    setSelectedCombo(null);
    setIsCreating(false);
    resetForm();
  };

  const calculateDiscount = () => {
    if (form.original_price > 0 && form.combo_price > 0) {
      return ((form.original_price - form.combo_price) / form.original_price * 100).toFixed(1);
    }
    return '0';
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Combo name is required');
      return;
    }
    if (form.combo_price <= 0) {
      toast.error('Combo price must be greater than 0');
      return;
    }

    setSaving(true);
    try {
      const discountPct = form.original_price > 0 
        ? ((form.original_price - form.combo_price) / form.original_price * 100)
        : null;

      const data = {
        name: form.name.trim(),
        slug: generateSlug(form.name),
        description: form.description.trim() || null,
        combo_price: form.combo_price,
        original_price: form.original_price || null,
        discount_percentage: discountPct,
        image: form.image || null,
        is_active: form.is_active
      };

      if (selectedCombo) {
        const { error } = await supabase
          .from('combos')
          .update(data)
          .eq('id', selectedCombo.id);
        if (error) throw error;
        toast.success('Combo updated');
      } else {
        const { error } = await supabase
          .from('combos')
          .insert(data);
        if (error) throw error;
        toast.success('Combo created');
      }

      closeEditor();
      loadCombos();
    } catch (error: any) {
      console.error('Error saving combo:', error);
      toast.error(error?.message || 'Failed to save combo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCombo) return;
    if (!confirm(`Delete "${selectedCombo.name}"? This cannot be undone.`)) return;

    try {
      const { error } = await supabase
        .from('combos')
        .delete()
        .eq('id', selectedCombo.id);
      if (error) throw error;
      toast.success('Combo deleted');
      closeEditor();
      loadCombos();
    } catch (error: any) {
      console.error('Error deleting combo:', error);
      toast.error(error?.message || 'Failed to delete combo');
    }
  };

  const filteredCombos = combos.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Show editor view
  if (selectedCombo || isCreating) {
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
              {isCreating ? 'New Combo' : `Edit: ${selectedCombo?.name}`}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {selectedCombo && (
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Combo'}
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
                <Label htmlFor="name">Combo Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., Weekend Bundle"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe what's included in this combo"
                  rows={3}
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h2 className="font-semibold text-lg">Pricing</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="combo_price">Combo Price (₹) *</Label>
                  <Input
                    id="combo_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.combo_price}
                    onChange={e => setForm(f => ({ ...f, combo_price: parseFloat(e.target.value) || 0 }))}
                  />
                </div>

                <div>
                  <Label htmlFor="original_price">Original Price (₹)</Label>
                  <Input
                    id="original_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.original_price}
                    onChange={e => setForm(f => ({ ...f, original_price: parseFloat(e.target.value) || 0 }))}
                    placeholder="For showing savings"
                  />
                </div>
              </div>

              {form.original_price > 0 && form.combo_price > 0 && (
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-green-700 font-medium">
                    Customer saves {calculateDiscount()}% ({formatINR(form.original_price - form.combo_price)})
                  </p>
                </div>
              )}
            </div>

            {/* Items */}
            {selectedCombo && selectedCombo.combo_items && selectedCombo.combo_items.length > 0 && (
              <div className="bg-white rounded-lg border p-6 space-y-4">
                <h2 className="font-semibold text-lg">Included Items</h2>
                <div className="divide-y">
                  {selectedCombo.combo_items.map(item => (
                    <div key={item.id} className="py-2 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{item.variant?.product?.name}</p>
                        <p className="text-sm text-gray-500">{item.variant?.variant_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">×{item.quantity}</p>
                        <p className="text-sm text-gray-500">{formatINR(item.variant?.price || 0)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Image */}
            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h2 className="font-semibold text-lg">Combo Image</h2>
              <ImageUpload
                imageUrl={form.image || null}
                onImageUrlChange={(url) => setForm(f => ({ ...f, image: url || '' }))}
                showSelector={true}
              />
            </div>

            {/* Status */}
            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h2 className="font-semibold text-lg">Status</h2>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Active</Label>
                  <p className="text-sm text-gray-500">Combo is available for purchase</p>
                </div>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={checked => setForm(f => ({ ...f, is_active: checked }))}
                />
              </div>
            </div>

            {/* Info */}
            {selectedCombo && (
              <div className="bg-white rounded-lg border p-6 space-y-2 text-sm text-gray-500">
                <p>Created: {new Date(selectedCombo.created_at).toLocaleDateString()}</p>
                <p>Updated: {new Date(selectedCombo.updated_at).toLocaleDateString()}</p>
                <p>Slug: {selectedCombo.slug}</p>
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
          <h1 className="text-2xl font-bold">Combos</h1>
          <p className="text-gray-500">{combos.length} combos total</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Combo
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search combos..."
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
      ) : filteredCombos.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {searchTerm ? 'No combos match your search' : 'No combos yet. Create your first combo!'}
        </div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {filteredCombos.map(combo => (
            <div
              key={combo.id}
              onClick={() => openEdit(combo)}
              className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              {/* Image */}
              <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {combo.image ? (
                  <img src={combo.image} alt={combo.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="h-6 w-6 text-gray-400" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <span className="font-medium truncate block">{combo.name}</span>
                <p className="text-sm text-gray-500">
                  {combo.combo_items?.length || 0} items
                </p>
              </div>

              {/* Price */}
              <div className="text-right">
                <p className="font-semibold text-green-600">{formatINR(combo.combo_price)}</p>
                {combo.original_price && (
                  <p className="text-sm text-gray-400 line-through">{formatINR(combo.original_price)}</p>
                )}
              </div>

              {/* Discount */}
              {combo.discount_percentage && combo.discount_percentage > 0 && (
                <Badge variant="secondary" className="text-green-600">
                  {combo.discount_percentage.toFixed(0)}% OFF
                </Badge>
              )}

              {/* Status */}
              <Badge variant={combo.is_active ? 'default' : 'secondary'}>
                {combo.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
