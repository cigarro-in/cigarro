import { useState, useEffect } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Switch } from '../../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { toast } from 'sonner';
import { supabase } from '../../../utils/supabase/client';

interface Discount {
  id: string;
  code: string;
  name: string;
  description: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  minimum_cart_value: number;
  maximum_discount_amount: number;
  usage_limit: number;
  used_count: number;
  is_active: boolean;
  valid_from: string;
  valid_until: string;
}

interface DiscountFormProps {
  discount?: Discount | null;
  onSave: () => void;
  onCancel: () => void;
}

interface DiscountFormData {
  code: string;
  name: string;
  description: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  minimum_cart_value: number;
  maximum_discount_amount: number;
  usage_limit: number;
  is_active: boolean;
  valid_from: string;
  valid_until: string;
}

export function DiscountForm({ discount, onSave, onCancel }: DiscountFormProps) {
  const [formData, setFormData] = useState<DiscountFormData>({
    code: '',
    name: '',
    description: '',
    discount_type: 'percentage',
    discount_value: 0,
    minimum_cart_value: 0,
    maximum_discount_amount: 0,
    usage_limit: 0,
    is_active: true,
    valid_from: '',
    valid_until: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (discount) {
      setFormData({
        code: discount.code,
        name: discount.name,
        description: discount.description,
        discount_type: discount.discount_type,
        discount_value: discount.discount_value,
        minimum_cart_value: discount.minimum_cart_value,
        maximum_discount_amount: discount.maximum_discount_amount,
        usage_limit: discount.usage_limit,
        is_active: discount.is_active,
        valid_from: discount.valid_from.split('T')[0],
        valid_until: discount.valid_until.split('T')[0]
      });
    }
  }, [discount]);

  const generateDiscountCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, code: result }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate discount value based on type
      if (formData.discount_type === 'percentage' && (formData.discount_value < 0 || formData.discount_value > 100)) {
        toast.error('Percentage discount must be between 0 and 100');
        return;
      }

      if (formData.discount_type === 'fixed' && formData.discount_value < 0) {
        toast.error('Fixed discount amount must be positive');
        return;
      }

      const discountData = {
        code: formData.code.toUpperCase(),
        name: formData.name,
        description: formData.description,
        discount_type: formData.discount_type,
        discount_value: formData.discount_value,
        minimum_cart_value: formData.minimum_cart_value,
        maximum_discount_amount: formData.maximum_discount_amount,
        usage_limit: formData.usage_limit,
        is_active: formData.is_active,
        valid_from: new Date(formData.valid_from).toISOString(),
        valid_until: new Date(formData.valid_until).toISOString()
      };

      let error;
      if (discount) {
        ({ error } = await supabase
          .from('discounts')
          .update(discountData)
          .eq('id', discount.id));
      } else {
        ({ error } = await supabase
          .from('discounts')
          .insert([{ ...discountData, used_count: 0 }]));
      }

      if (error) throw error;

      toast.success(discount ? 'Discount updated successfully' : 'Discount created successfully');
      onSave();
    } catch (error: any) {
      console.error('Error saving discount:', error);
      if (error.code === '23505') {
        toast.error('Discount code already exists. Please use a different code.');
      } else {
        toast.error('Failed to save discount');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Discount Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="code">Discount Code *</Label>
              <div className="flex gap-2">
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="DISCOUNT10"
                  className="font-mono"
                  required
                />
                <Button type="button" variant="outline" onClick={generateDiscountCode}>
                  Generate
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="name">Display Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="10% Off Discount"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter discount description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="valid_from">Valid From *</Label>
              <Input
                id="valid_from"
                type="date"
                value={formData.valid_from}
                onChange={(e) => setFormData(prev => ({ ...prev, valid_from: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="valid_until">Valid Until *</Label>
              <Input
                id="valid_until"
                type="date"
                value={formData.valid_until}
                onChange={(e) => setFormData(prev => ({ ...prev, valid_until: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked: boolean) => setFormData(prev => ({ ...prev, is_active: checked }))}
            />
            <Label htmlFor="is_active">Discount is active</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Discount Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="discount_type">Discount Type *</Label>
              <Select
                value={formData.discount_type}
                onValueChange={(value: 'percentage' | 'fixed') => setFormData(prev => ({ ...prev, discount_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="discount_value">
                Discount Value * {formData.discount_type === 'percentage' ? '(%)' : '(₹)'}
              </Label>
              <Input
                id="discount_value"
                type="number"
                step={formData.discount_type === 'percentage' ? '0.1' : '0.01'}
                min="0"
                max={formData.discount_type === 'percentage' ? '100' : undefined}
                value={formData.discount_value}
                onChange={(e) => setFormData(prev => ({ ...prev, discount_value: parseFloat(e.target.value) || 0 }))}
                placeholder="0"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="minimum_cart_value">Minimum Cart Value (₹)</Label>
              <Input
                id="minimum_cart_value"
                type="number"
                step="0.01"
                min="0"
                value={formData.minimum_cart_value}
                onChange={(e) => setFormData(prev => ({ ...prev, minimum_cart_value: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00 (no minimum)"
              />
            </div>
            <div>
              <Label htmlFor="maximum_discount_amount">Maximum Discount Amount (₹)</Label>
              <Input
                id="maximum_discount_amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.maximum_discount_amount}
                onChange={(e) => setFormData(prev => ({ ...prev, maximum_discount_amount: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00 (no maximum)"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="usage_limit">Usage Limit</Label>
            <Input
              id="usage_limit"
              type="number"
              min="0"
              value={formData.usage_limit}
              onChange={(e) => setFormData(prev => ({ ...prev, usage_limit: parseInt(e.target.value) || 0 }))}
              placeholder="0 (unlimited)"
            />
            <p className="text-xs text-gray-500 mt-1">
              Set to 0 for unlimited usage
            </p>
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
          {loading ? 'Saving...' : discount ? 'Update Discount' : 'Create Discount'}
        </Button>
      </div>
    </form>
  );
}
