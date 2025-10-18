// ============================================================================
// QUICK SETUP TAB - Essential product information for fast creation
// ============================================================================

import { useState, useEffect } from 'react';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { Button } from '../../../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { Switch } from '../../../../components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { supabase } from '../../../../utils/supabase/client';
import { ProductFormData, generateSlug } from '../../../../types/product';
import { MultipleImageUpload } from '../../../../components/ui/MultipleImageUpload';

interface QuickSetupTabProps {
  formData: ProductFormData;
  onChange: (updates: Partial<ProductFormData>) => void;
  validationErrors: {
    name?: boolean;
    brand?: boolean;
    price?: boolean;
    images?: boolean;
  };
}

export function QuickSetupTab({ formData, onChange, validationErrors }: QuickSetupTabProps) {
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([]);
  const [autoSlug, setAutoSlug] = useState(true);
  const [customBrand, setCustomBrand] = useState(false);

  useEffect(() => {
    loadBrands();
  }, []);

  useEffect(() => {
    // Check if current brand is in the list
    if (formData.brand && brands.length > 0) {
      const brandExists = brands.some(b => b.name === formData.brand);
      if (!brandExists) {
        setCustomBrand(true);
      }
    }
  }, [formData.brand, brands]);

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
    if (value === 'custom') {
      setCustomBrand(true);
      onChange({ brand: '' });
    } else {
      setCustomBrand(false);
      onChange({ brand: value });
    }
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Product Status */}
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

      {/* Essential Information */}
      <Card className="bg-[var(--color-creme-light)] border-2 border-[var(--color-coyote)]">
        <CardHeader className="text-center pb-3">
          <CardTitle className="text-lg font-sans font-semibold text-[var(--color-dark)] uppercase tracking-wide">Essential Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Row 1: Name + Brand */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="quick-name" className="text-sm font-medium text-[var(--color-dark)]">
                Product Name <span className="text-[var(--color-canyon)]">*</span>
              </Label>
              <Input
                id="quick-name"
                value={formData.name}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder="Marlboro Red Premium"
                className={`bg-[var(--color-creme)] border-2 ${
                  validationErrors.name
                    ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                    : 'border-[var(--color-coyote)] focus:ring-2 focus:ring-[var(--color-canyon)]'
                } h-10`}
              />
              {validationErrors.name && (
                <p className="text-xs text-red-600 font-medium">Product name is required</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quick-brand" className="text-sm font-medium text-[var(--color-dark)]">
                Brand <span className="text-[var(--color-canyon)]">*</span>
              </Label>
              {!customBrand ? (
                <Select value={formData.brand} onValueChange={handleBrandChange}>
                  <SelectTrigger className={`bg-[var(--color-creme)] border-2 ${
                    validationErrors.brand
                      ? 'border-red-500'
                      : 'border-[var(--color-coyote)]'
                  } h-10`}>
                    <SelectValue placeholder="Select brand" />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--color-creme-light)] border-2 border-[var(--color-coyote)]">
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.name}>
                        {brand.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">
                      <span className="text-[var(--color-canyon)]">+ Add Custom Brand</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={formData.brand}
                    onChange={(e) => onChange({ brand: e.target.value })}
                    placeholder="Enter custom brand name"
                    className={`bg-[var(--color-creme)] border-2 ${
                      validationErrors.brand
                        ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                        : 'border-[var(--color-coyote)] focus:ring-2 focus:ring-[var(--color-canyon)]'
                    } h-10`}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCustomBrand(false);
                      onChange({ brand: '' });
                    }}
                    className="border-2 border-[var(--color-coyote)] h-10 px-3"
                  >
                    Cancel
                  </Button>
                </div>
              )}
              {validationErrors.brand && (
                <p className="text-xs text-red-600 font-medium">Brand is required</p>
              )}
            </div>
          </div>

          {/* Row 2: Price + Stock */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="quick-price" className="text-sm font-medium text-[var(--color-dark)]">
                Price (₹) <span className="text-[var(--color-canyon)]">*</span>
              </Label>
              <Input
                id="quick-price"
                type="number"
                min={0}
                step="0.01"
                value={formData.price === 0 ? '' : formData.price}
                onChange={(e) => onChange({ price: e.target.value === '' ? 0 : Number(e.target.value) })}
                placeholder="0.00"
                className={`bg-[var(--color-creme)] border-2 ${
                  validationErrors.price
                    ? 'border-red-500 focus:ring-2 focus:ring-red-500'
                    : 'border-[var(--color-coyote)] focus:ring-2 focus:ring-[var(--color-canyon)]'
                } h-10`}
              />
              {validationErrors.price && (
                <p className="text-xs text-red-600 font-medium">Price must be greater than 0</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quick-stock" className="text-sm font-medium text-[var(--color-dark)]">
                Stock Quantity
              </Label>
              <Input
                id="quick-stock"
                type="number"
                min={0}
                value={formData.stock === 0 ? '' : formData.stock}
                onChange={(e) => onChange({ stock: e.target.value === '' ? 0 : Number(e.target.value) })}
                placeholder="0"
                className="bg-[var(--color-creme)] border-2 border-[var(--color-coyote)] focus:ring-2 focus:ring-[var(--color-canyon)] h-10"
              />
            </div>
          </div>

          {/* Row 3: Slug + Auto-toggle */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="quick-slug" className="text-sm font-medium text-[var(--color-dark)]">
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
              id="quick-slug"
              value={formData.slug || ''}
              onChange={(e) => onChange({ slug: e.target.value })}
              placeholder="marlboro-red-premium"
              disabled={autoSlug}
              className="bg-[var(--color-creme)] border-2 border-[var(--color-coyote)] focus:ring-2 focus:ring-[var(--color-canyon)] h-10 disabled:opacity-50"
            />
          </div>

          {/* Row 4: Short Description */}
          <div className="space-y-1.5">
            <Label htmlFor="quick-short-desc" className="text-sm font-medium text-[var(--color-dark)]">
              Short Description
            </Label>
            <Textarea
              id="quick-short-desc"
              value={formData.short_description || ''}
              onChange={(e) => onChange({ short_description: e.target.value })}
              placeholder="Brief listing description (shown in product cards)"
              rows={2}
              className="bg-[var(--color-creme)] border-2 border-[var(--color-coyote)] focus:ring-2 focus:ring-[var(--color-canyon)] resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Product Images */}
      <Card className={`bg-[var(--color-creme-light)] border-2 ${
        validationErrors.images ? 'border-red-500' : 'border-[var(--color-coyote)]'
      }`}>
        <CardHeader className="text-center pb-3">
          <CardTitle className="text-lg font-sans font-semibold text-[var(--color-dark)] uppercase tracking-wide">
            Product Images <span className="text-[var(--color-canyon)]">*</span>
          </CardTitle>
          {validationErrors.images && (
            <p className="text-xs text-red-600 font-medium mt-1">At least one image is required</p>
          )}
        </CardHeader>
        <CardContent>
          <MultipleImageUpload
            imageUrls={formData.gallery_images}
            onImageUrlsChange={(urls: string[]) => onChange({ gallery_images: urls })}
            showSelector={true}
            title="Product Images"
            description="Upload or select product images"
          />
          <p className="text-xs text-[var(--color-dark)]/70 mt-3 text-center">
            Upload product images. First image will be the primary display image.
          </p>
        </CardContent>
      </Card>

      {/* Quick Product Details */}
      <Card className="bg-[var(--color-creme-light)] border-2 border-[var(--color-coyote)]">
        <CardHeader className="text-center pb-3">
          <CardTitle className="text-lg font-sans font-semibold text-[var(--color-dark)] uppercase tracking-wide">Quick Details (Optional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="quick-origin" className="text-sm font-medium text-[var(--color-dark)]">
                Origin
              </Label>
              <Input
                id="quick-origin"
                value={formData.origin || ''}
                onChange={(e) => onChange({ origin: e.target.value })}
                placeholder="USA, India"
                className="bg-[var(--color-creme)] border-2 border-[var(--color-coyote)] focus:ring-2 focus:ring-[var(--color-canyon)] h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quick-pack-size" className="text-sm font-medium text-[var(--color-dark)]">
                Pack Size
              </Label>
              <Input
                id="quick-pack-size"
                value={formData.pack_size || ''}
                onChange={(e) => onChange({ pack_size: e.target.value })}
                placeholder="20 sticks, 10 packs"
                className="bg-[var(--color-creme)] border-2 border-[var(--color-coyote)] focus:ring-2 focus:ring-[var(--color-canyon)] h-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Helper Text */}
      <div className="bg-[var(--color-canyon)]/10 border-2 border-[var(--color-canyon)]/30 rounded-lg p-4">
        <p className="text-sm text-[var(--color-dark)] font-medium mb-2">💡 Quick Setup Guide:</p>
        <ul className="text-xs text-[var(--color-dark)]/80 space-y-1 ml-4 list-disc">
          <li>Fill in the essential fields marked with <span className="text-[var(--color-canyon)]">*</span> to save your product</li>
          <li>Use other tabs (Basic Info, Pricing, Variants, SEO) for advanced configuration</li>
          <li>You can save now and add more details later</li>
        </ul>
      </div>
    </div>
  );
}
