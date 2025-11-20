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

interface ProductCombo {
  id: string;
  name: string;
  description: string;
  combo_price: number;
  original_price: number;
  discount_percentage: number;
  is_active: boolean;
  valid_from: string;
  valid_until: string;
  combo_items?: Array<{
    product_id: string;
    quantity: number;
    product: {
      name: string;
      brand: string;
      price: number;
    };
  }>;
}

interface ComboFormProps {
  combo?: ProductCombo | null;
  onSave: () => void;
  onCancel: () => void;
}

interface ComboFormData {
  name: string;
  description: string;
  combo_price: number;
  is_active: boolean;
  valid_from: string;
  valid_until: string;
  items: Array<{
    product_id: string;
    quantity: number;
  }>;
}

export function ComboForm({ combo, onSave, onCancel }: ComboFormProps) {
  const [formData, setFormData] = useState<ComboFormData>({
    name: '',
    description: '',
    combo_price: 0,
    is_active: true,
    valid_from: '',
    valid_until: '',
    items: [{ product_id: '', quantity: 1 }]
  });
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [originalPrice, setOriginalPrice] = useState(0);
  const [discountPercentage, setDiscountPercentage] = useState(0);

  useEffect(() => {
    fetchProducts();
    if (combo) {
      setFormData({
        name: combo.name,
        description: combo.description,
        combo_price: combo.combo_price,
        is_active: combo.is_active,
        valid_from: combo.valid_from.split('T')[0],
        valid_until: combo.valid_until.split('T')[0],
        items: combo.combo_items?.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity
        })) || [{ product_id: '', quantity: 1 }]
      });
    }
  }, [combo]);

  useEffect(() => {
    calculatePricing();
  }, [formData.items, products, formData.combo_price]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, brand, price')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const calculatePricing = () => {
    const total = formData.items.reduce((sum, item) => {
      const product = products.find(p => p.id === item.product_id);
      return sum + (product ? product.price * item.quantity : 0);
    }, 0);
    
    setOriginalPrice(total);
    
    if (total > 0 && formData.combo_price > 0) {
      const discount = ((total - formData.combo_price) / total) * 100;
      setDiscountPercentage(Math.max(0, discount));
    } else {
      setDiscountPercentage(0);
    }
  };

  const handleItemChange = (index: number, field: 'product_id' | 'quantity', value: string | number) => {
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
      items: [...prev.items, { product_id: '', quantity: 1 }]
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
      const comboData = {
        name: formData.name,
        description: formData.description,
        combo_price: formData.combo_price,
        original_price: originalPrice,
        discount_percentage: discountPercentage,
        is_active: formData.is_active,
        valid_from: new Date(formData.valid_from).toISOString(),
        valid_until: new Date(formData.valid_until).toISOString()
      };

      let comboId;
      if (combo) {
        const { error } = await supabase
          .from('product_combos')
          .update(comboData)
          .eq('id', combo.id);

        if (error) throw error;
        comboId = combo.id;
      } else {
        const { data, error } = await supabase
          .from('product_combos')
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

      // Insert new items
      const itemsData = formData.items
        .filter(item => item.product_id && item.quantity > 0)
        .map(item => ({
          combo_id: comboId,
          product_id: item.product_id,
          quantity: item.quantity
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

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="valid_from">Valid From *</Label>
              <Input
                id="valid_from"
                type="date"
                value={formData.valid_from}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, valid_from: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="valid_until">Valid Until *</Label>
              <Input
                id="valid_until"
                type="date"
                value={formData.valid_until}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, valid_until: e.target.value }))}
                required
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
            <CardTitle>Combo Products</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-dark/60 mb-4">Product selection will be managed here</p>
            <p className="text-sm text-dark/50">
              Select products to include in this combo offer
            </p>
          </div>
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
