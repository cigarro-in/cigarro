import { useState, useEffect } from 'react';
import { Plus, Search, ArrowLeft, Trash2, Percent, Tag, Calendar, Save } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Switch } from '../../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { supabase } from '../../../lib/supabase/client';
import { toast } from 'sonner';
import { formatINR } from '../../../utils/currency';

// Database-aligned Discount interface
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

export function DiscountsManager() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDiscount, setSelectedDiscount] = useState<Discount | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    type: 'percentage' as 'percentage' | 'fixed_amount' | 'cart_value',
    value: 0,
    min_cart_value: 0,
    max_discount_amount: 0,
    applicable_to: 'all' as 'all' | 'products' | 'combos' | 'variants',
    start_date: '',
    end_date: '',
    usage_limit: 0,
    is_active: true
  });

  useEffect(() => {
    loadDiscounts();
  }, []);

  const loadDiscounts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('discounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDiscounts(data || []);
    } catch (error) {
      console.error('Error loading discounts:', error);
      toast.error('Failed to load discounts');
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
    setForm(f => ({ ...f, code }));
  };

  const resetForm = () => {
    setForm({
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
  };

  const openCreate = () => {
    resetForm();
    setSelectedDiscount(null);
    setIsCreating(true);
  };

  const openEdit = (discount: Discount) => {
    setForm({
      name: discount.name || '',
      code: discount.code || '',
      description: discount.description || '',
      type: discount.type || 'percentage',
      value: discount.value || 0,
      min_cart_value: discount.min_cart_value || 0,
      max_discount_amount: discount.max_discount_amount || 0,
      applicable_to: discount.applicable_to || 'all',
      start_date: discount.start_date?.split('T')[0] || '',
      end_date: discount.end_date?.split('T')[0] || '',
      usage_limit: discount.usage_limit || 0,
      is_active: discount.is_active ?? true
    });
    setSelectedDiscount(discount);
    setIsCreating(false);
  };

  const closeEditor = () => {
    setSelectedDiscount(null);
    setIsCreating(false);
    resetForm();
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Discount name is required');
      return;
    }
    if (form.value <= 0) {
      toast.error('Discount value must be greater than 0');
      return;
    }
    if (form.type === 'percentage' && form.value > 100) {
      toast.error('Percentage cannot exceed 100%');
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase() || null,
        description: form.description.trim() || null,
        type: form.type,
        value: form.value,
        min_cart_value: form.min_cart_value || null,
        max_discount_amount: form.max_discount_amount || null,
        applicable_to: form.applicable_to,
        start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
        end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
        usage_limit: form.usage_limit || null,
        is_active: form.is_active
      };

      if (selectedDiscount) {
        const { error } = await supabase
          .from('discounts')
          .update(data)
          .eq('id', selectedDiscount.id);
        if (error) throw error;
        toast.success('Discount updated');
      } else {
        const { error } = await supabase
          .from('discounts')
          .insert({ ...data, usage_count: 0 });
        if (error) throw error;
        toast.success('Discount created');
      }

      closeEditor();
      loadDiscounts();
    } catch (error: any) {
      console.error('Error saving discount:', error);
      if (error?.code === '23505') {
        toast.error('A discount with this code already exists');
      } else {
        toast.error(error?.message || 'Failed to save discount');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDiscount) return;
    if (!confirm(`Delete "${selectedDiscount.name}"? This cannot be undone.`)) return;

    try {
      const { error } = await supabase
        .from('discounts')
        .delete()
        .eq('id', selectedDiscount.id);
      if (error) throw error;
      toast.success('Discount deleted');
      closeEditor();
      loadDiscounts();
    } catch (error: any) {
      console.error('Error deleting discount:', error);
      toast.error(error?.message || 'Failed to delete discount');
    }
  };

  const getDiscountStatus = (discount: Discount) => {
    if (!discount.is_active) return { label: 'Inactive', variant: 'secondary' as const };
    
    const now = new Date();
    if (discount.start_date && new Date(discount.start_date) > now) {
      return { label: 'Scheduled', variant: 'outline' as const };
    }
    if (discount.end_date && new Date(discount.end_date) < now) {
      return { label: 'Expired', variant: 'destructive' as const };
    }
    if (discount.usage_limit && discount.usage_count >= discount.usage_limit) {
      return { label: 'Limit Reached', variant: 'destructive' as const };
    }
    return { label: 'Active', variant: 'default' as const };
  };

  const formatDiscountValue = (discount: Discount) => {
    if (discount.type === 'percentage') {
      return `${discount.value}%`;
    }
    return formatINR(discount.value);
  };

  const filteredDiscounts = discounts.filter(d =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Show editor view
  if (selectedDiscount || isCreating) {
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
              {isCreating ? 'New Discount' : `Edit: ${selectedDiscount?.name}`}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {selectedDiscount && (
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Discount'}
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
                <Label htmlFor="name">Discount Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., Summer Sale 20% Off"
                />
              </div>

              <div>
                <Label htmlFor="code">Coupon Code</Label>
                <div className="flex gap-2">
                  <Input
                    id="code"
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="e.g., SUMMER20"
                    className="font-mono"
                  />
                  <Button type="button" variant="outline" onClick={generateCode}>
                    Generate
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Internal notes about this discount"
                  rows={2}
                />
              </div>
            </div>

            {/* Discount Settings */}
            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h2 className="font-semibold text-lg">Discount Settings</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">Discount Type *</Label>
                  <Select
                    value={form.type}
                    onValueChange={(value: 'percentage' | 'fixed_amount' | 'cart_value') => 
                      setForm(f => ({ ...f, type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed_amount">Fixed Amount (₹)</SelectItem>
                      <SelectItem value="cart_value">Cart Value</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="value">
                    Value * {form.type === 'percentage' ? '(%)' : '(₹)'}
                  </Label>
                  <Input
                    id="value"
                    type="number"
                    min="0"
                    max={form.type === 'percentage' ? 100 : undefined}
                    step={form.type === 'percentage' ? 1 : 0.01}
                    value={form.value}
                    onChange={e => setForm(f => ({ ...f, value: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="min_cart">Minimum Cart Value (₹)</Label>
                  <Input
                    id="min_cart"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.min_cart_value}
                    onChange={e => setForm(f => ({ ...f, min_cart_value: parseFloat(e.target.value) || 0 }))}
                    placeholder="0 = no minimum"
                  />
                </div>

                <div>
                  <Label htmlFor="max_discount">Maximum Discount (₹)</Label>
                  <Input
                    id="max_discount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.max_discount_amount}
                    onChange={e => setForm(f => ({ ...f, max_discount_amount: parseFloat(e.target.value) || 0 }))}
                    placeholder="0 = no cap"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="applicable">Applies To</Label>
                <Select
                  value={form.applicable_to}
                  onValueChange={(value: 'all' | 'products' | 'combos' | 'variants') => 
                    setForm(f => ({ ...f, applicable_to: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Items</SelectItem>
                    <SelectItem value="products">Specific Products</SelectItem>
                    <SelectItem value="combos">Combos Only</SelectItem>
                    <SelectItem value="variants">Specific Variants</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Validity */}
            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h2 className="font-semibold text-lg">Validity Period</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start">Start Date</Label>
                  <Input
                    id="start"
                    type="date"
                    value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="end">End Date</Label>
                  <Input
                    id="end"
                    type="date"
                    value={form.end_date}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="limit">Usage Limit</Label>
                <Input
                  id="limit"
                  type="number"
                  min="0"
                  value={form.usage_limit}
                  onChange={e => setForm(f => ({ ...f, usage_limit: parseInt(e.target.value) || 0 }))}
                  placeholder="0 = unlimited"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Set to 0 for unlimited usage
                </p>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status */}
            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h2 className="font-semibold text-lg">Status</h2>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Active</Label>
                  <p className="text-sm text-gray-500">Discount can be used</p>
                </div>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={checked => setForm(f => ({ ...f, is_active: checked }))}
                />
              </div>
            </div>

            {/* Usage Stats */}
            {selectedDiscount && (
              <div className="bg-white rounded-lg border p-6 space-y-4">
                <h2 className="font-semibold text-lg">Usage Statistics</h2>
                <div className="text-center py-4">
                  <p className="text-4xl font-bold">{selectedDiscount.usage_count}</p>
                  <p className="text-gray-500">
                    {selectedDiscount.usage_limit 
                      ? `of ${selectedDiscount.usage_limit} uses`
                      : 'times used'
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Info */}
            {selectedDiscount && (
              <div className="bg-white rounded-lg border p-6 space-y-2 text-sm text-gray-500">
                <p>Created: {new Date(selectedDiscount.created_at).toLocaleDateString()}</p>
                <p>Updated: {new Date(selectedDiscount.updated_at).toLocaleDateString()}</p>
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
          <h1 className="text-2xl font-bold">Discounts</h1>
          <p className="text-gray-500">{discounts.length} discounts total</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Discount
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search discounts..."
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
      ) : filteredDiscounts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {searchTerm ? 'No discounts match your search' : 'No discounts yet. Create your first discount!'}
        </div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {filteredDiscounts.map(discount => {
            const status = getDiscountStatus(discount);
            return (
              <div
                key={discount.id}
                onClick={() => openEdit(discount)}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                {/* Icon */}
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  {discount.type === 'percentage' ? (
                    <Percent className="h-6 w-6 text-gray-600" />
                  ) : (
                    <Tag className="h-6 w-6 text-gray-600" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{discount.name}</span>
                    {discount.code && (
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">
                        {discount.code}
                      </code>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="font-semibold text-gray-900">
                      {formatDiscountValue(discount)}
                    </span>
                    {discount.min_cart_value && discount.min_cart_value > 0 && (
                      <span>Min: {formatINR(discount.min_cart_value)}</span>
                    )}
                    <span>
                      {discount.usage_count}{discount.usage_limit ? `/${discount.usage_limit}` : ''} used
                    </span>
                  </div>
                </div>

                {/* Dates */}
                {(discount.start_date || discount.end_date) && (
                  <div className="text-sm text-gray-500 flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {discount.end_date 
                      ? new Date(discount.end_date).toLocaleDateString()
                      : 'No expiry'
                    }
                  </div>
                )}

                {/* Status */}
                <Badge variant={status.variant}>
                  {status.label}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
