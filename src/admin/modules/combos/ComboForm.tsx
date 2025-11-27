import { useState, useEffect } from 'react';
import { Save, X, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Switch } from '../../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabase/client';
import { formatINR } from '../../../utils/currency';

// Updated to use new combos + combo_items schema (variant-based)
interface Combo {
  id: string;
  name: string;
  slug: string;
  description?: string;
  combo_price: number;
  original_price?: number;
  discount_percentage?: number;
  image?: string;
  gallery_images?: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  combo_items?: Array<{
    id: string;
    variant_id: string;
    quantity: number;
    variant?: {
      id: string;
      variant_name: string;
      price: number;
      product?: {
        name: string;
        brand?: { name: string };
      };
    };
  }>;
}

interface ComboFormProps {
  combo?: Combo | null;
  onSave: () => void;
  onCancel: () => void;
}

interface ComboFormData {
  name: string;
  slug: string;
  description: string;
  combo_price: number;
  is_active: boolean;
  items: Array<{
    variant_id: string;
    quantity: number;
  }>;
}

// Helper to generate slug from name
const generateSlug = (name: string) => {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
};

export function ComboForm({ combo, onSave, onCancel }: ComboFormProps) {
  const [formData, setFormData] = useState<ComboFormData>({
    name: '',
    slug: '',
    description: '',
    combo_price: 0,
    is_active: true,
    items: [{ variant_id: '', quantity: 1 }]
  });
  const [variants, setVariants] = useState<any[]>([]); // All product variants
  const [loading, setLoading] = useState(false);
  const [originalPrice, setOriginalPrice] = useState(0);
  const [discountPercentage, setDiscountPercentage] = useState(0);

  useEffect(() => {
    fetchVariants();
    if (combo) {
      setFormData({
        name: combo.name,
        slug: combo.slug,
        description: combo.description || '',
        combo_price: combo.combo_price,
        is_active: combo.is_active,
        items: combo.combo_items?.map(item => ({
          variant_id: item.variant_id,
          quantity: item.quantity
        })) || [{ variant_id: '', quantity: 1 }]
      });
    }
  }, [combo]);

  useEffect(() => {
    calculatePricing();
  }, [formData.items, variants, formData.combo_price]);

  const fetchVariants = async () => {
    try {
      const { data, error } = await supabase
        .from('product_variants')
        .select('id, variant_name, price, is_active, products(id, name, brand:brands(name))')
        .eq('is_active', true)
        .order('variant_name');

      if (error) throw error;
      setVariants(data || []);
    } catch (error) {
      console.error('Error fetching variants:', error);
    }
  };

  const calculatePricing = () => {
    const total = formData.items.reduce((sum, item) => {
      const variant = variants.find(v => v.id === item.variant_id);
      return sum + (variant ? variant.price * item.quantity : 0);
    }, 0);
    
    setOriginalPrice(total);
    
    if (total > 0 && formData.combo_price > 0) {
      const discount = ((total - formData.combo_price) / total) * 100;
      setDiscountPercentage(Math.max(0, discount));
    } else {
      setDiscountPercentage(0);
    }
  };

  const handleItemChange = (index: number, field: 'variant_id' | 'quantity', value: string | number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { variant_id: '', quantity: 1 }]
    }));
  };

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const slug = formData.slug || generateSlug(formData.name);
      const comboData = {
        name: formData.name,
        slug,
        description: formData.description || null,
        combo_price: formData.combo_price,
        original_price: originalPrice,
        discount_percentage: discountPercentage,
        is_active: formData.is_active
      };

      let comboId;
      if (combo) {
        const { error } = await supabase
          .from('combos')
          .update(comboData)
          .eq('id', combo.id);

        if (error) throw error;
        comboId = combo.id;
      } else {
        const { data, error } = await supabase
          .from('combos')
          .insert([comboData])
          .select()
          .single();

        if (error) throw error;
        comboId = data.id;
      }

      // Update combo items
      if (combo) {
        // Delete existing items
        await supabase
          .from('combo_items')
          .delete()
          .eq('combo_id', combo.id);
      }

      // Insert new items (variant-based)
      const itemsData = formData.items
        .filter(item => item.variant_id && item.quantity > 0)
        .map((item, index) => ({
          combo_id: comboId,
          variant_id: item.variant_id,
          quantity: item.quantity,
          sort_order: index
        }));

      if (itemsData.length > 0) {
        const { error: itemsError } = await supabase
          .from('combo_items')
          .insert(itemsData);

        if (itemsError) throw itemsError;
      }

      toast.success(combo ? 'Combo updated successfully' : 'Combo created successfully');
      onSave();
    } catch (error) {
      console.error('Error saving combo:', error);
      toast.error('Failed to save combo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Combo Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Combo Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter combo name"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter combo description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="slug">Slug (URL)</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                placeholder="auto-generated-from-name"
              />
            </div>
            <div className="flex items-end">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked: boolean) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="is_active">Combo is active</Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Combo Variants</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4 mr-2" />
              Add Variant
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {formData.items.map((item, index) => {
            const selectedVariant = variants.find(v => v.id === item.variant_id);
            return (
              <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <Select
                    value={item.variant_id}
                    onValueChange={(value) => handleItemChange(index, 'variant_id', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a variant" />
                    </SelectTrigger>
                    <SelectContent>
                      {variants.map(variant => (
                        <SelectItem key={variant.id} value={variant.id}>
                          {variant.products?.name} - {variant.variant_name} ({formatINR(variant.price)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24">
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                    placeholder="Qty"
                  />
                </div>
                <div className="w-24 text-right text-sm font-medium">
                  {selectedVariant ? formatINR(selectedVariant.price * item.quantity) : '-'}
                </div>
                {formData.items.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
          {formData.items.length === 0 && (
            <div className="text-center py-4 text-gray-500">
              No variants added. Click "Add Variant" to start building your combo.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Original Price</Label>
              <div className="text-lg font-medium text-gray-600">
                {formatINR(originalPrice)}
              </div>
            </div>
            <div>
              <Label htmlFor="combo_price">Combo Price *</Label>
              <Input
                id="combo_price"
                type="number"
                step="0.01"
                value={formData.combo_price || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, combo_price: parseFloat(e.target.value) || 0 }))}
                placeholder="Enter combo price"
                className="bg-creme border-coyote text-dark placeholder:text-dark/50"
                required
              />
            </div>
            <div>
              <Label>Discount</Label>
              <div className="text-lg font-medium text-green-600">
                {discountPercentage.toFixed(1)}% OFF
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end space-x-3 pt-6 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          <Save className="mr-2 h-4 w-4" />
          {loading ? 'Saving...' : combo ? 'Update Combo' : 'Create Combo'}
        </Button>
      </div>
    </form>
  );
}
