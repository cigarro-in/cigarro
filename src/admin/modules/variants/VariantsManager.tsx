import { useState, useEffect } from 'react';
import { Plus, Search, ArrowLeft, Trash2, Package, Save } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Label } from '../../../components/ui/label';
import { Switch } from '../../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { supabase } from '../../../lib/supabase/client';
import { toast } from 'sonner';
import { formatINR } from '../../../utils/currency';

interface ProductVariant {
  id: string;
  product_id: string;
  variant_name: string;
  variant_type: string;
  price: number;
  stock: number;
  attributes: Record<string, string> | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  product?: { name: string; brand_id: string };
}

interface Product {
  id: string;
  name: string;
}

export function VariantsManager() {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    product_id: '',
    variant_name: '',
    variant_type: 'packaging',
    price: 0,
    stock: 0,
    is_active: true,
    is_default: false,
    attributes: {} as Record<string, string>
  });

  const [attrKey, setAttrKey] = useState('');
  const [attrValue, setAttrValue] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [variantsRes, productsRes] = await Promise.all([
        supabase
          .from('product_variants')
          .select('*, product:products(name, brand_id)')
          .order('created_at', { ascending: false }),
        supabase
          .from('products')
          .select('id, name')
          .eq('is_active', true)
          .order('name')
      ]);

      if (variantsRes.error) throw variantsRes.error;
      if (productsRes.error) throw productsRes.error;

      setVariants(variantsRes.data || []);
      setProducts(productsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      product_id: '',
      variant_name: '',
      variant_type: 'packaging',
      price: 0,
      stock: 0,
      is_active: true,
      is_default: false,
      attributes: {}
    });
    setAttrKey('');
    setAttrValue('');
  };

  const openCreate = () => {
    resetForm();
    setSelectedVariant(null);
    setIsCreating(true);
  };

  const openEdit = (variant: ProductVariant) => {
    setForm({
      product_id: variant.product_id,
      variant_name: variant.variant_name || '',
      variant_type: variant.variant_type || 'packaging',
      price: variant.price || 0,
      stock: variant.stock || 0,
      is_active: variant.is_active ?? true,
      is_default: variant.is_default ?? false,
      attributes: variant.attributes || {}
    });
    setSelectedVariant(variant);
    setIsCreating(false);
  };

  const closeEditor = () => {
    setSelectedVariant(null);
    setIsCreating(false);
    resetForm();
  };

  const addAttribute = () => {
    if (attrKey.trim() && attrValue.trim()) {
      setForm(f => ({
        ...f,
        attributes: { ...f.attributes, [attrKey.trim()]: attrValue.trim() }
      }));
      setAttrKey('');
      setAttrValue('');
    }
  };

  const removeAttribute = (key: string) => {
    setForm(f => {
      const attrs = { ...f.attributes };
      delete attrs[key];
      return { ...f, attributes: attrs };
    });
  };

  const handleSave = async () => {
    if (!form.product_id) {
      toast.error('Please select a product');
      return;
    }
    if (!form.variant_name.trim()) {
      toast.error('Variant name is required');
      return;
    }
    if (form.price <= 0) {
      toast.error('Price must be greater than 0');
      return;
    }

    setSaving(true);
    try {
      const data = {
        product_id: form.product_id,
        variant_name: form.variant_name.trim(),
        variant_type: form.variant_type,
        price: form.price,
        stock: form.stock,
        is_active: form.is_active,
        is_default: form.is_default,
        attributes: Object.keys(form.attributes).length > 0 ? form.attributes : null
      };

      if (selectedVariant) {
        const { error } = await supabase
          .from('product_variants')
          .update(data)
          .eq('id', selectedVariant.id);
        if (error) throw error;
        toast.success('Variant updated');
      } else {
        const { error } = await supabase
          .from('product_variants')
          .insert(data);
        if (error) throw error;
        toast.success('Variant created');
      }

      closeEditor();
      loadData();
    } catch (error: any) {
      console.error('Error saving variant:', error);
      toast.error(error?.message || 'Failed to save variant');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedVariant) return;
    if (!confirm(`Delete "${selectedVariant.variant_name}"?`)) return;

    try {
      const { error } = await supabase
        .from('product_variants')
        .delete()
        .eq('id', selectedVariant.id);
      if (error) throw error;
      toast.success('Variant deleted');
      closeEditor();
      loadData();
    } catch (error: any) {
      console.error('Error deleting variant:', error);
      toast.error(error?.message || 'Failed to delete variant');
    }
  };

  const getStockBadge = (stock: number) => {
    if (stock <= 0) return 'destructive';
    if (stock <= 10) return 'secondary';
    return 'default';
  };

  const filteredVariants = variants.filter(v =>
    v.variant_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.product?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (selectedVariant || isCreating) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={closeEditor}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">
              {isCreating ? 'New Variant' : `Edit: ${selectedVariant?.variant_name}`}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {selectedVariant && (
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
              <h2 className="font-semibold text-lg">Variant Details</h2>
              
              <div>
                <Label>Product *</Label>
                <Select value={form.product_id} onValueChange={v => setForm(f => ({ ...f, product_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Variant Name *</Label>
                  <Input
                    value={form.variant_name}
                    onChange={e => setForm(f => ({ ...f, variant_name: e.target.value }))}
                    placeholder="e.g., Pack of 20"
                  />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.variant_type} onValueChange={v => setForm(f => ({ ...f, variant_type: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="packaging">Packaging</SelectItem>
                      <SelectItem value="size">Size</SelectItem>
                      <SelectItem value="flavor">Flavor</SelectItem>
                      <SelectItem value="color">Color</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Price (₹) *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <Label>Stock</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.stock}
                    onChange={e => setForm(f => ({ ...f, stock: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h2 className="font-semibold text-lg">Attributes</h2>
              
              <div className="flex gap-2">
                <Input
                  placeholder="Key"
                  value={attrKey}
                  onChange={e => setAttrKey(e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Value"
                  value={attrValue}
                  onChange={e => setAttrValue(e.target.value)}
                  className="flex-1"
                />
                <Button variant="outline" onClick={addAttribute}>Add</Button>
              </div>

              {Object.keys(form.attributes).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(form.attributes).map(([key, value]) => (
                    <Badge key={key} variant="secondary" className="gap-1">
                      {key}: {value}
                      <button onClick={() => removeAttribute(key)} className="ml-1 hover:text-red-500">×</button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h2 className="font-semibold text-lg">Status</h2>
              
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={checked => setForm(f => ({ ...f, is_active: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Default Variant</Label>
                <Switch
                  checked={form.is_default}
                  onCheckedChange={checked => setForm(f => ({ ...f, is_default: checked }))}
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
          <h1 className="text-2xl font-bold">Variants</h1>
          <p className="text-gray-500">{variants.length} variants</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Variant
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search variants..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      ) : filteredVariants.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {searchTerm ? 'No variants found' : 'No variants yet'}
        </div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {filteredVariants.map(variant => (
            <div
              key={variant.id}
              onClick={() => openEdit(variant)}
              className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-gray-400" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{variant.variant_name}</span>
                  {variant.is_default && (
                    <Badge variant="outline" className="text-xs">Default</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-500">{variant.product?.name}</p>
              </div>

              <div className="text-right">
                <p className="font-semibold">{formatINR(variant.price)}</p>
                <Badge variant={getStockBadge(variant.stock) as any} className="text-xs">
                  {variant.stock} in stock
                </Badge>
              </div>

              <Badge variant={variant.is_active ? 'default' : 'secondary'}>
                {variant.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
