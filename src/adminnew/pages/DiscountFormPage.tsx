import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Percent, Tag, Calendar, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { AdminCard, AdminCardContent, AdminCardHeader, AdminCardTitle } from '../components/shared/AdminCard';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';
import { formatINR } from '../../utils/currency';
import { PageHeader } from '../components/shared/PageHeader';

interface Discount {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  type: 'percentage' | 'fixed_amount' | 'cart_value';
  value: number;
  min_cart_value: number | null;
  max_discount_amount: number | null;
  applicable_to: 'all' | 'products' | 'combos' | 'variants';
  product_ids: string[] | null;
  combo_ids: string[] | null;
  variant_ids: string[] | null;
  start_date: string | null;
  end_date: string | null;
  usage_limit: number | null;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DiscountFormData {
  name: string;
  code: string;
  description: string;
  type: 'percentage' | 'fixed_amount' | 'cart_value';
  value: number;
  min_cart_value: number;
  max_discount_amount: number;
  applicable_to: 'all' | 'products' | 'combos' | 'variants';
  start_date: string;
  end_date: string;
  usage_limit: number;
  is_active: boolean;
}

export function DiscountFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [formData, setFormData] = useState<DiscountFormData>({
    name: '',
    code: '',
    description: '',
    type: 'percentage',
    value: 0,
    min_cart_value: 0,
    max_discount_amount: 0,
    applicable_to: 'all',
    start_date: '',
    end_date: '',
    usage_limit: 0,
    is_active: true
  });

  useEffect(() => {
    if (isEditMode) {
      loadDiscount();
    }
  }, [id]);

  useEffect(() => {
    setIsDirty(true);
  }, [formData]);

  useEffect(() => {
    setIsDirty(false);
  }, []);

  const loadDiscount = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('discounts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setFormData({
        name: data.name || '',
        code: data.code || '',
        description: data.description || '',
        type: data.type || 'percentage',
        value: data.value || 0,
        min_cart_value: data.min_cart_value || 0,
        max_discount_amount: data.max_discount_amount || 0,
        applicable_to: data.applicable_to || 'all',
        start_date: data.start_date ? new Date(data.start_date).toISOString().split('T')[0] : '',
        end_date: data.end_date ? new Date(data.end_date).toISOString().split('T')[0] : '',
        usage_limit: data.usage_limit || 0,
        is_active: data.is_active !== false
      });
    } catch (error) {
      console.error('Error loading discount:', error);
      toast.error('Failed to load discount');
    } finally {
      setLoading(false);
    }
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, code }));
  };

  const handleChange = (updates: Partial<DiscountFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Discount name is required');
      return;
    }

    if (formData.type !== 'cart_value' && formData.value <= 0) {
      toast.error('Discount value must be greater than 0');
      return;
    }

    setSaving(true);
    try {
      const discountData = {
        name: formData.name.trim(),
        code: formData.code.trim() || null,
        description: formData.description.trim() || null,
        type: formData.type,
        value: formData.value,
        min_cart_value: formData.min_cart_value || null,
        max_discount_amount: formData.max_discount_amount || null,
        applicable_to: formData.applicable_to,
        product_ids: null,
        combo_ids: null,
        variant_ids: null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        usage_limit: formData.usage_limit || null,
        is_active: formData.is_active
      };

      if (isEditMode) {
        const { error } = await supabase
          .from('discounts')
          .update(discountData)
          .eq('id', id);

        if (error) throw error;
        toast.success('Discount updated successfully');
      } else {
        const { error } = await supabase
          .from('discounts')
          .insert([discountData]);

        if (error) throw error;
        toast.success('Discount created successfully');
      }

      navigate('/admin/discounts');
    } catch (error: any) {
      console.error('Error saving discount:', error);
      toast.error(error.message || 'Failed to save discount');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this discount?')) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('discounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Discount deleted successfully');
      navigate('/admin/discounts');
    } catch (error) {
      console.error('Error deleting discount:', error);
      toast.error('Failed to delete discount');
    } finally {
      setSaving(false);
    }
  };

  const formatDiscountValue = () => {
    switch (formData.type) {
      case 'percentage':
        return `${formData.value}%`;
      case 'fixed_amount':
        return formatINR(formData.value);
      case 'cart_value':
        return `Cart value: ${formatINR(formData.value)}`;
      default:
        return formatINR(formData.value);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[var(--color-creme)] pb-20">
      {/* Header */}
      <PageHeader
        title={formData.name || 'Untitled Discount'}
        description={isEditMode ? 'Edit discount' : 'Create new discount'}
        backUrl="/admin/discounts"
      >
        <Button 
          variant="outline" 
          onClick={() => navigate('/admin/discounts')}
        >
          Cancel
        </Button>
        {isEditMode && (
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={saving}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        )}
        <Button 
          onClick={handleSubmit} 
          disabled={saving || !isDirty}
          className="bg-[var(--color-canyon)] hover:bg-[var(--color-canyon)]/90 text-[var(--color-creme)]"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {isEditMode ? 'Update' : 'Create'} Discount
            </>
          )}
        </Button>
      </PageHeader>

      <div className="max-w-[1600px] mx-auto px-6 grid grid-cols-[1fr_350px] gap-6 mt-6">
        
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Basic Information */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Discount Details</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent className="space-y-4">
              
              {/* Name */}
              <div className="space-y-2">
                <Label className="text-[var(--color-dark)] font-medium">
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleChange({ name: e.target.value })}
                  placeholder="e.g. Summer Sale"
                  className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)] text-lg py-6"
                />
              </div>

              {/* Code */}
              <div className="space-y-2">
                <Label className="text-[var(--color-dark)] font-medium">Discount Code</Label>
                <div className="flex space-x-2">
                  <Input
                    value={formData.code}
                    onChange={(e) => handleChange({ code: e.target.value.toUpperCase() })}
                    placeholder="SUMMER2024"
                    className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)] font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generateCode}
                    className="border-[var(--color-coyote)] hover:bg-[var(--color-creme)]"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label className="text-[var(--color-dark)] font-medium">Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => handleChange({ description: e.target.value })}
                  placeholder="Describe the discount..."
                  rows={3}
                  className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
                />
              </div>

              {/* Type and Value */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[var(--color-dark)] font-medium">Discount Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: 'percentage' | 'fixed_amount' | 'cart_value') => 
                      handleChange({ type: value, value: 0 })
                    }
                  >
                    <SelectTrigger className="bg-[var(--color-creme)] border-[var(--color-coyote)]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
                      <SelectItem value="cart_value">Cart Value</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[var(--color-dark)] font-medium">
                    {formData.type === 'percentage' ? 'Percentage (%)' : 
                     formData.type === 'fixed_amount' ? 'Amount (₹)' : 
                     'Cart Value (₹)'}
                  </Label>
                  <Input
                    type="number"
                    value={formData.value}
                    onChange={(e) => handleChange({ value: parseFloat(e.target.value) || 0 })}
                    placeholder={formData.type === 'percentage' ? '10' : '100'}
                    className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
                  />
                </div>
              </div>

              {/* Applicability */}
              <div className="space-y-2">
                <Label className="text-[var(--color-dark)] font-medium">Applies To</Label>
                <Select
                  value={formData.applicable_to}
                  onValueChange={(value: 'all' | 'products' | 'combos' | 'variants') => 
                    handleChange({ applicable_to: value })
                  }
                >
                  <SelectTrigger className="bg-[var(--color-creme)] border-[var(--color-coyote)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Products</SelectItem>
                    <SelectItem value="products">Specific Products</SelectItem>
                    <SelectItem value="combos">Combos</SelectItem>
                    <SelectItem value="variants">Specific Variants</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Conditions */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[var(--color-dark)] font-medium">Minimum Cart Value</Label>
                  <Input
                    type="number"
                    value={formData.min_cart_value}
                    onChange={(e) => handleChange({ min_cart_value: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
                  />
                </div>
                {formData.type === 'percentage' && (
                  <div className="space-y-2">
                    <Label className="text-[var(--color-dark)] font-medium">Maximum Discount Amount</Label>
                    <Input
                      type="number"
                      value={formData.max_discount_amount}
                      onChange={(e) => handleChange({ max_discount_amount: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                      className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
                    />
                  </div>
                )}
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[var(--color-dark)] font-medium">Start Date</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => handleChange({ start_date: e.target.value })}
                    className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[var(--color-dark)] font-medium">End Date</Label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => handleChange({ end_date: e.target.value })}
                    className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
                  />
                </div>
              </div>

              {/* Usage Limit */}
              <div className="space-y-2">
                <Label className="text-[var(--color-dark)] font-medium">Usage Limit</Label>
                <Input
                  type="number"
                  value={formData.usage_limit}
                  onChange={(e) => handleChange({ usage_limit: parseInt(e.target.value) || 0 })}
                  placeholder="0 (unlimited)"
                  className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
                />
              </div>
            </AdminCardContent>
          </AdminCard>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* Status */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Status</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Active</Label>
                  <p className="text-sm text-gray-500">Discount is available to customers</p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => handleChange({ is_active: checked })}
                />
              </div>
            </AdminCardContent>
          </AdminCard>

          {/* Preview */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Preview</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <div className="space-y-3">
                <div className="p-4 border border-[var(--color-coyote)]/30 rounded-lg">
                  <div className="font-medium text-gray-900 mb-2">
                    {formData.name || 'Discount Name'}
                  </div>
                  {formData.code && (
                    <div className="text-sm font-mono text-gray-600 mb-2">
                      Code: {formData.code}
                    </div>
                  )}
                  <div className="text-lg font-bold text-[var(--color-canyon)]">
                    {formatDiscountValue()}
                  </div>
                  {formData.description && (
                    <div className="text-sm text-gray-600 mt-2">
                      {formData.description}
                    </div>
                  )}
                </div>
              </div>
            </AdminCardContent>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
