import { useState, useEffect } from 'react';
import { Save, X, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Switch } from '../../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabase/client';

interface ProductVariant {
  id: string;
  product_id: string;
  variant_name: string;
  variant_type: 'packaging' | 'color' | 'size' | 'material' | 'flavor' | 'other';
  price: number;
  stock: number;
  attributes: Record<string, string>;
  is_active: boolean;
}

interface VariantFormProps {
  variant?: ProductVariant | null;
  onSave: () => void;
  onCancel: () => void;
}

interface VariantFormData {
  product_id: string;
  variant_name: string;
  variant_type: 'packaging' | 'color' | 'size' | 'material' | 'flavor' | 'other';
  price: number;
  stock: number;
  attributes: { key: string; value: string }[];
  is_active: boolean;
}

export function VariantForm({ variant, onSave, onCancel }: VariantFormProps) {
  const [formData, setFormData] = useState<VariantFormData>({
    product_id: '',
    variant_name: '',
    variant_type: 'packaging',
    price: 0,
    stock: 0,
    attributes: [{ key: '', value: '' }],
    is_active: true
  });
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
    if (variant) {
      setFormData({
        product_id: variant.product_id,
        variant_name: variant.variant_name,
        variant_type: variant.variant_type,
        price: variant.price,
        stock: variant.stock,
        attributes: variant.attributes 
          ? Object.entries(variant.attributes).map(([key, value]) => ({ key, value }))
          : [{ key: '', value: '' }],
        is_active: variant.is_active
      });
    }
  }, [variant]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, brand')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleAttributeChange = (index: number, field: 'key' | 'value', value: string) => {
    setFormData(prev => ({
      ...prev,
      attributes: prev.attributes.map((attr, i) =>
        i === index ? { ...attr, [field]: value } : attr
      )
    }));
  };

  const addAttribute = () => {
    setFormData(prev => ({
      ...prev,
      attributes: [...prev.attributes, { key: '', value: '' }]
    }));
  };

  const removeAttribute = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attributes: prev.attributes.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const attributes = formData.attributes
        .filter(attr => attr.key && attr.value)
        .reduce((acc, attr) => ({ ...acc, [attr.key]: attr.value }), {});

      const variantData = {
        product_id: formData.product_id,
        variant_name: formData.variant_name,
        variant_type: formData.variant_type,
        price: formData.price,
        stock: formData.stock,
        attributes,
        is_active: formData.is_active
      };

      let error;
      if (variant) {
        ({ error } = await supabase
          .from('product_variants')
          .update(variantData)
          .eq('id', variant.id));
      } else {
        ({ error } = await supabase
          .from('product_variants')
          .insert([variantData]));
      }

      if (error) throw error;

      toast.success(variant ? 'Variant updated successfully' : 'Variant created successfully');
      onSave();
    } catch (error) {
      console.error('Error saving variant:', error);
      toast.error('Failed to save variant');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Variant Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="product_id">Product *</Label>
            <Select
              value={formData.product_id}
              onValueChange={(value: string) => setFormData(prev => ({ ...prev, product_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {products.map(product => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name} - {product.brand}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="variant_name">Variant Name *</Label>
              <Input
                id="variant_name"
                value={formData.variant_name}
                onChange={(e) => setFormData(prev => ({ ...prev, variant_name: e.target.value }))}
                placeholder="e.g., Packet, Carton, Half Carton"
                required
              />
            </div>
            <div>
              <Label htmlFor="variant_type">Variant Type</Label>
              <Select
                value={formData.variant_type}
                onValueChange={(value: any) => setFormData(prev => ({ ...prev, variant_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="packaging">Packaging</SelectItem>
                  <SelectItem value="color">Color</SelectItem>
                  <SelectItem value="size">Size</SelectItem>
                  <SelectItem value="material">Material</SelectItem>
                  <SelectItem value="flavor">Flavor</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="price">Price (₹) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <Label htmlFor="stock">Stock Quantity</Label>
              <Input
                id="stock"
                type="number"
                value={formData.stock}
                onChange={(e) => setFormData(prev => ({ ...prev, stock: parseInt(e.target.value) || 0 }))}
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked: boolean) => setFormData(prev => ({ ...prev, is_active: checked }))}
            />
            <Label htmlFor="is_active">Variant is active</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Variant Attributes</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addAttribute}>
              <Plus className="h-4 w-4 mr-2" />
              Add Attribute
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {formData.attributes.map((attr, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="Attribute name (e.g., Size, Color)"
                  value={attr.key}
                  onChange={(e) => handleAttributeChange(index, 'key', e.target.value)}
                />
                <Input
                  placeholder="Attribute value (e.g., Large, Red)"
                  value={attr.value}
                  onChange={(e) => handleAttributeChange(index, 'value', e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeAttribute(index)}
                  disabled={formData.attributes.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
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
          {loading ? 'Saving...' : variant ? 'Update Variant' : 'Create Variant'}
        </Button>
      </div>
    </form>
  );
}
