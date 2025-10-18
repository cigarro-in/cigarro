// ============================================================================
// QUICK ADD STEP - 30-Second Product Creation
// Core essentials with AI enhancement option
// ============================================================================

import { useState, useEffect } from 'react';
import { Sparkles, Upload, Zap } from 'lucide-react';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Button } from '../../../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { Switch } from '../../../../components/ui/switch';
import { Card, CardContent } from '../../../../components/ui/card';
import { Alert, AlertDescription } from '../../../../components/ui/alert';
import { ProductFormData, generateSlug } from '../../../../types/product';
import { supabase } from '../../../../utils/supabase/client';
import { toast } from 'sonner';
import { MultipleImageUpload } from '../../../../components/ui/MultipleImageUpload';

interface QuickAddStepProps {
  formData: ProductFormData;
  setFormData: (data: ProductFormData) => void;
  skipOptionalSteps: boolean;
  setSkipOptionalSteps: (skip: boolean) => void;
  errors?: { name?: boolean; brand?: boolean; price?: boolean; images?: boolean };
}

export function QuickAddStep({ formData, setFormData, skipOptionalSteps, setSkipOptionalSteps, errors }: QuickAddStepProps) {
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [customBrand, setCustomBrand] = useState(false);
  const [aiEnhancing, setAiEnhancing] = useState(false);

  useEffect(() => {
    loadBrands();
  }, []);

  useEffect(() => {
    // Auto-generate slug when name changes
    if (formData.name && !formData.slug) {
      setFormData({ ...formData, slug: generateSlug(formData.name) });
    }
  }, [formData.name]);

  const loadBrands = async () => {
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
    } finally {
      setLoadingBrands(false);
    }
  };

  const handleBrandChange = (value: string) => {
    if (value === 'custom') {
      setCustomBrand(true);
      setFormData({ ...formData, brand: '' });
    } else {
      setCustomBrand(false);
      setFormData({ ...formData, brand: value });
    }
  };

  const handleAIEnhance = async () => {
    setAiEnhancing(true);
    try {
      // Simulate AI enhancement - in production, call your AI service
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate description
      const description = `Premium ${formData.brand} ${formData.name}. High-quality tobacco product with exceptional flavor and smooth finish. Perfect for discerning smokers who appreciate quality craftsmanship.`;
      
      // Generate SEO
      const meta_title = `${formData.name} - ${formData.brand} | Premium Cigarettes`;
      const meta_description = `Buy ${formData.name} by ${formData.brand}. Premium quality cigarettes at the best price. Fast delivery across India.`;
      
      setFormData({
        ...formData,
        description,
        short_description: description.substring(0, 150),
        meta_title,
        meta_description,
        meta_keywords: `${formData.brand}, ${formData.name}, cigarettes, tobacco, premium`,
        og_title: meta_title,
        og_description: meta_description
      });

      toast.success('AI enhancement complete!');
    } catch (error) {
      console.error('AI enhancement error:', error);
      toast.error('AI enhancement failed');
    } finally {
      setAiEnhancing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Alert className="bg-[var(--color-creme)] border-[var(--color-canyon)]">
        <Sparkles className="w-4 h-4 text-[var(--color-canyon)]" />
        <AlertDescription className="text-[var(--color-dark)]">
          <strong>Quick Add:</strong> Fill in the essentials below to create your product in 30 seconds. 
          You can add more details in the next steps or skip them entirely.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Product Name */}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="name" className="text-[var(--color-dark)] font-semibold">
            Product Name *
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Premium Red Pack of 20"
            className={`bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)] ${errors?.name ? 'border-red-500 focus:ring-red-500' : ''}`}
          />
          {errors?.name && (
            <p className="text-xs text-red-600">Name is required</p>
          )}
          {formData.name && (
            <p className="text-xs text-[var(--color-dark)]/60">
              Slug: <span className="font-mono">{generateSlug(formData.name)}</span>
            </p>
          )}
        </div>

        {/* Brand */}
        <div className="space-y-2">
          <Label htmlFor="brand" className="text-[var(--color-dark)] font-semibold">
            Brand *
          </Label>
          {!customBrand ? (
            <Select value={formData.brand} onValueChange={handleBrandChange}>
              <SelectTrigger className={`bg-[var(--color-creme)] border-[var(--color-coyote)] ${errors?.brand ? 'border-red-500' : ''}`}>
                <SelectValue placeholder="Select brand" />
              </SelectTrigger>
              <SelectContent className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
                {brands.map(brand => (
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
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                placeholder="Enter custom brand name"
                className={`bg-[var(--color-creme)] border-[var(--color-coyote)] ${errors?.brand ? 'border-red-500' : ''}`}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCustomBrand(false);
                  setFormData({ ...formData, brand: '' });
                }}
                className="border-[var(--color-coyote)]"
              >
                Cancel
              </Button>
            </div>
          )}
          {errors?.brand && (
            <p className="text-xs text-red-600">Brand is required</p>
          )}
        </div>

        {/* Price */}
        <div className="space-y-2">
          <Label htmlFor="price" className="text-[var(--color-dark)] font-semibold">
            Selling Price (₹) *
          </Label>
          <Input
            id="price"
            type="number"
            value={formData.price === 0 ? '' : formData.price}
            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
            placeholder="500"
            min="0"
            step="0.01"
            className={`bg-[var(--color-creme)] border-[var(--color-coyote)] ${errors?.price ? 'border-red-500 focus:ring-red-500' : ''}`}
          />
          {errors?.price && (
            <p className="text-xs text-red-600">Price must be greater than 0</p>
          )}
        </div>

        {/* Stock */}
        <div className="space-y-2">
          <Label htmlFor="stock" className="text-[var(--color-dark)] font-semibold">
            Stock Quantity *
          </Label>
          <Input
            id="stock"
            type="number"
            value={formData.stock === 0 ? '' : formData.stock}
            onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
            placeholder="100"
            min="0"
            className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
          />
        </div>

        {/* Compare At Price (Optional) */}
        <div className="space-y-2">
          <Label htmlFor="compare_at_price" className="text-[var(--color-dark)] font-semibold">
            Compare At Price (₹)
            <span className="text-xs font-normal text-[var(--color-dark)]/60 ml-2">Optional - for discounts</span>
          </Label>
          <Input
            id="compare_at_price"
            type="number"
            value={formData.compare_at_price || ''}
            onChange={(e) => setFormData({ ...formData, compare_at_price: parseFloat(e.target.value) || undefined })}
            placeholder="600"
            min="0"
            step="0.01"
            className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
          />
          {formData.compare_at_price && formData.compare_at_price > formData.price && (
            <p className="text-xs text-green-600 font-semibold">
              {Math.round(((formData.compare_at_price - formData.price) / formData.compare_at_price) * 100)}% OFF
            </p>
          )}
        </div>
      </div>

      {/* Product Image */}
      <div className="space-y-2">
        <Label className="text-[var(--color-dark)] font-semibold">
          Product Images *
        </Label>
        <MultipleImageUpload
          imageUrls={formData.gallery_images}
          onImageUrlsChange={(urls) => setFormData({ ...formData, gallery_images: urls })}
        />
        <p className={`text-xs ${errors?.images ? 'text-red-600' : 'text-[var(--color-dark)]/60'}`}>
          {errors?.images ? 'At least one image is required' : 'Upload at least one image. You can add more in the Media & SEO step.'}
        </p>
      </div>

      {/* AI Enhancement */}
      <Card className="bg-gradient-to-r from-[var(--color-canyon)]/10 to-[var(--color-coyote)]/10 border-[var(--color-canyon)]">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-[var(--color-canyon)]" />
                <h3 className="font-semibold text-[var(--color-dark)]">AI Enhancement</h3>
              </div>
              <p className="text-sm text-[var(--color-dark)]/80">
                Let AI automatically generate product description, SEO metadata, and optimize your listing.
              </p>
            </div>
            <Button
              type="button"
              onClick={handleAIEnhance}
              disabled={!formData.name || !formData.brand || aiEnhancing}
              className="bg-[var(--color-canyon)] text-white hover:bg-[var(--color-dark)] whitespace-nowrap"
            >
              {aiEnhancing ? (
                <>
                  <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                  Enhancing...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Enhance with AI
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Publish Option */}
      <Card className="bg-[var(--color-creme)] border-[var(--color-coyote)]">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="skip-steps" className="text-[var(--color-dark)] font-semibold cursor-pointer">
                Quick Publish
              </Label>
              <p className="text-sm text-[var(--color-dark)]/70">
                Skip optional steps and publish immediately with these details
              </p>
            </div>
            <Switch
              id="skip-steps"
              checked={skipOptionalSteps}
              onCheckedChange={setSkipOptionalSteps}
            />
          </div>
        </CardContent>
      </Card>

      {/* Active Status */}
      <div className="flex items-center justify-between p-4 bg-[var(--color-creme)] rounded-lg border border-[var(--color-coyote)]">
        <div>
          <Label htmlFor="is-active" className="text-[var(--color-dark)] font-semibold cursor-pointer">
            Product Status
          </Label>
          <p className="text-sm text-[var(--color-dark)]/70">
            {formData.is_active ? 'Active - Visible to customers' : 'Inactive - Hidden from store'}
          </p>
        </div>
        <Switch
          id="is-active"
          checked={formData.is_active}
          onCheckedChange={(checked: boolean) => setFormData({ ...formData, is_active: checked })}
        />
      </div>
    </div>
  );
}
