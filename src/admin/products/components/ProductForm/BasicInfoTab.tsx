// ============================================================================
// BASIC INFO TAB - Product name, brand, description
// ============================================================================

import { useState, useEffect } from 'react';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { Switch } from '../../../../components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Alert, AlertDescription } from '../../../../components/ui/alert';
import { supabase } from '../../../../utils/supabase/client';
import { ProductFormData, generateSlug } from '../../../../types/product';

interface BasicInfoTabProps {
  formData: ProductFormData;
  onChange: (updates: Partial<ProductFormData>) => void;
}

export function BasicInfoTab({ formData, onChange }: BasicInfoTabProps) {
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([]);
  const [autoSlug, setAutoSlug] = useState(true);

  useEffect(() => {
    loadBrands();
  }, []);

  useEffect(() => {
    // Auto-generate slug from name if enabled
    if (autoSlug && formData.name) {
      onChange({ slug: generateSlug(formData.name) });
    }
  }, [formData.name, autoSlug]);

  async function loadBrands() {
    try {
      const { data, error } = await supabase
        .from('brands')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setBrands(data || []);
    } catch (error) {
      console.error('Error loading brands:', error);
      setBrands([]);
    }
  }

  const handleBrandChange = (value: string) => {
    onChange({ brand: value });
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Product Status - Compact Toggle Bubbles */}
      <Card className="bg-[var(--color-creme-light)] border-2 border-[var(--color-coyote)]">
        <CardHeader className="text-center pb-3">
          <CardTitle className="text-lg font-sans font-semibold text-[var(--color-dark)] uppercase tracking-wide">Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-8">
            <div className="flex flex-col items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked: boolean) => onChange({ is_active: checked })}
                className="data-[state=checked]:bg-[var(--color-canyon)]"
              />
              <Label className="text-sm font-medium text-[var(--color-dark)]">Active</Label>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Switch
                checked={formData.is_featured}
                onCheckedChange={(checked: boolean) => onChange({ is_featured: checked })}
                className="data-[state=checked]:bg-[var(--color-canyon)]"
              />
              <Label className="text-sm font-medium text-[var(--color-dark)]">Featured</Label>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Switch
                checked={formData.is_showcase}
                onCheckedChange={(checked: boolean) => onChange({ is_showcase: checked })}
                className="data-[state=checked]:bg-[var(--color-canyon)]"
              />
              <Label className="text-sm font-medium text-[var(--color-dark)]">Showcase</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Basic Information */}
      <Card className="bg-[var(--color-creme-light)] border-2 border-[var(--color-coyote)]">
        <CardHeader className="text-center pb-3">
          <CardTitle className="text-lg font-sans font-semibold text-[var(--color-dark)] uppercase tracking-wide">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Row 1: Name + Brand */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium text-[var(--color-dark)]">
                Product Name <span className="text-[var(--color-canyon)]">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder="Marlboro Red Premium"
                className="bg-[var(--color-creme)] border-2 border-[var(--color-coyote)] focus:ring-2 focus:ring-[var(--color-canyon)] h-10"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="brand" className="text-sm font-medium text-[var(--color-dark)]">
                Brand <span className="text-[var(--color-canyon)]">*</span>
              </Label>
              <Select value={formData.brand} onValueChange={handleBrandChange}>
                <SelectTrigger className="bg-[var(--color-creme)] border-2 border-[var(--color-coyote)] h-10">
                  <SelectValue placeholder="Select brand" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-creme-light)] border-2 border-[var(--color-coyote)]">
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.name}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {brands.length === 0 && (
                <p className="text-xs text-[var(--color-canyon)] mt-1">
                  No brands available. Please add brands in Brand Management first.
                </p>
              )}
            </div>
          </div>

          {/* Row 2: Slug + Auto-toggle */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="slug" className="text-sm font-medium text-[var(--color-dark)]">
                URL Slug
              </Label>
              <div className="flex items-center gap-2">
                <Switch
                  checked={autoSlug}
                  onCheckedChange={setAutoSlug}
                  className="data-[state=checked]:bg-[var(--color-canyon)] scale-75"
                />
                <span className="text-xs text-[var(--color-dark)]/70">Auto</span>
              </div>
            </div>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) => onChange({ slug: e.target.value })}
              placeholder="marlboro-red-premium"
              disabled={autoSlug}
              className="bg-[var(--color-creme)] border-2 border-[var(--color-coyote)] focus:ring-2 focus:ring-[var(--color-canyon)] h-10 disabled:opacity-50"
            />
          </div>

          {/* Row 3: Short Description */}
          <div className="space-y-1.5">
            <Label htmlFor="short_description" className="text-sm font-medium text-[var(--color-dark)]">
              Short Description
            </Label>
            <Textarea
              id="short_description"
              value={formData.short_description || ''}
              onChange={(e) => onChange({ short_description: e.target.value })}
              placeholder="Brief listing description"
              rows={2}
              className="bg-[var(--color-creme)] border-2 border-[var(--color-coyote)] focus:ring-2 focus:ring-[var(--color-canyon)] resize-none"
            />
          </div>

          {/* Row 4: Full Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-sm font-medium text-[var(--color-dark)]">
              Full Description
            </Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Detailed product information"
              rows={4}
              className="bg-[var(--color-creme)] border-2 border-[var(--color-coyote)] focus:ring-2 focus:ring-[var(--color-canyon)] resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Product Details */}
      <Card className="bg-[var(--color-creme-light)] border-2 border-[var(--color-coyote)]">
        <CardHeader className="text-center pb-3">
          <CardTitle className="text-lg font-sans font-semibold text-[var(--color-dark)] uppercase tracking-wide">Product Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Row 1: Origin + Pack Size */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="origin" className="text-sm font-medium text-[var(--color-dark)]">
                Origin
              </Label>
              <Input
                id="origin"
                value={formData.origin || ''}
                onChange={(e) => onChange({ origin: e.target.value })}
                placeholder="USA, India"
                className="bg-[var(--color-creme)] border-2 border-[var(--color-coyote)] focus:ring-2 focus:ring-[var(--color-canyon)] h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pack_size" className="text-sm font-medium text-[var(--color-dark)]">
                Pack Size
              </Label>
              <Input
                id="pack_size"
                value={formData.pack_size || ''}
                onChange={(e) => onChange({ pack_size: e.target.value })}
                placeholder="20 sticks, 10 packs"
                className="bg-[var(--color-creme)] border-2 border-[var(--color-coyote)] focus:ring-2 focus:ring-[var(--color-canyon)] h-10"
              />
            </div>
          </div>

          {/* Row 2: Specifications */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-[var(--color-dark)]">Specifications</Label>
            <div className="space-y-2">
              {formData.specifications.map((spec, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Input
                    value={spec.key}
                    onChange={(e) => {
                      const newSpecs = [...formData.specifications];
                      newSpecs[index].key = e.target.value;
                      onChange({ specifications: newSpecs });
                    }}
                    placeholder="Key"
                    className="bg-[var(--color-creme)] border-2 border-[var(--color-coyote)] focus:ring-2 focus:ring-[var(--color-canyon)] h-9"
                  />
                  <Input
                    value={spec.value}
                    onChange={(e) => {
                      const newSpecs = [...formData.specifications];
                      newSpecs[index].value = e.target.value;
                      onChange({ specifications: newSpecs });
                    }}
                    placeholder="Value"
                    className="bg-[var(--color-creme)] border-2 border-[var(--color-coyote)] focus:ring-2 focus:ring-[var(--color-canyon)] h-9"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newSpecs = formData.specifications.filter((_, i) => i !== index);
                      onChange({ specifications: newSpecs.length > 0 ? newSpecs : [{ key: '', value: '' }] });
                    }}
                    className="px-3 text-[var(--color-canyon)] hover:bg-[var(--color-coyote)] rounded transition-all text-lg"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  onChange({
                    specifications: [...formData.specifications, { key: '', value: '' }]
                  });
                }}
                className="text-sm text-[var(--color-canyon)] hover:underline"
              >
                + Add
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
