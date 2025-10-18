// ============================================================================
// VARIANTS & PRICING STEP - Smart Variant Management
// Bulk creation with matrix builder and smart pricing
// ============================================================================

import { useState } from 'react';
import { Plus, Trash2, Copy, Grid3x3, ChevronDown, ChevronUp, Image as ImageIcon } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { Switch } from '../../../../components/ui/switch';
import { Alert, AlertDescription } from '../../../../components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../../../components/ui/collapsible';
import { ProductFormData, VariantFormData, generateSlug } from '../../../../types/product';
import { formatINR } from '../../../../utils/currency';

interface VariantsPricingStepProps {
  formData: ProductFormData;
  setFormData: (data: ProductFormData) => void;
}

export function VariantsPricingStep({ formData, setFormData }: VariantsPricingStepProps) {
  const [expandedVariants, setExpandedVariants] = useState<Set<number>>(new Set([0]));
  const [bulkPriceAdjustment, setBulkPriceAdjustment] = useState<'none' | 'increase' | 'decrease'>('none');
  const [bulkPriceValue, setBulkPriceValue] = useState<number>(10);

  const toggleVariant = (index: number) => {
    const newExpanded = new Set(expandedVariants);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedVariants(newExpanded);
  };

  const addVariant = () => {
    const newVariant: VariantFormData = {
      variant_name: '',
      variant_slug: '',
      variant_type: 'packaging',
      price: formData.price,
      compare_at_price: formData.compare_at_price,
      cost_price: formData.cost_price,
      stock: 0,
      track_inventory: true,
      attributes: [],
      is_active: true,
      sort_order: formData.variants.length,
      assigned_images: [],
      meta_title: '',
      meta_description: '',
      meta_keywords: '',
      og_title: '',
      og_description: '',
      structured_data: {}
    };

    setFormData({
      ...formData,
      variants: [...formData.variants, newVariant]
    });
    setExpandedVariants(new Set([...expandedVariants, formData.variants.length]));
  };

  const removeVariant = (index: number) => {
    setFormData({
      ...formData,
      variants: formData.variants.filter((_, i) => i !== index)
    });
  };

  const duplicateVariant = (index: number) => {
    const variant = formData.variants[index];
    const newVariant = {
      ...variant,
      id: undefined,
      variant_name: `${variant.variant_name} (Copy)`,
      variant_slug: generateSlug(`${variant.variant_name}-copy`),
      sort_order: formData.variants.length
    };
    setFormData({
      ...formData,
      variants: [...formData.variants, newVariant]
    });
  };

  const updateVariant = (index: number, updates: Partial<VariantFormData>) => {
    const updated = [...formData.variants];
    updated[index] = { ...updated[index], ...updates };
    setFormData({ ...formData, variants: updated });
  };

  const addAttribute = (variantIndex: number) => {
    const variant = formData.variants[variantIndex];
    updateVariant(variantIndex, {
      attributes: [...variant.attributes, { key: '', value: '' }]
    });
  };

  const removeAttribute = (variantIndex: number, attrIndex: number) => {
    const variant = formData.variants[variantIndex];
    updateVariant(variantIndex, {
      attributes: variant.attributes.filter((_, i) => i !== attrIndex)
    });
  };

  const updateAttribute = (variantIndex: number, attrIndex: number, field: 'key' | 'value', value: string) => {
    const variant = formData.variants[variantIndex];
    const updated = [...variant.attributes];
    updated[attrIndex] = { ...updated[attrIndex], [field]: value };
    updateVariant(variantIndex, { attributes: updated });
  };

  const applyBulkPriceAdjustment = () => {
    if (bulkPriceAdjustment === 'none') return;

    const updated = formData.variants.map(variant => {
      const adjustment = bulkPriceAdjustment === 'increase' ? 1 + (bulkPriceValue / 100) : 1 - (bulkPriceValue / 100);
      return {
        ...variant,
        price: Math.round(variant.price * adjustment * 100) / 100,
        compare_at_price: variant.compare_at_price 
          ? Math.round(variant.compare_at_price * adjustment * 100) / 100 
          : undefined
      };
    });

    setFormData({ ...formData, variants: updated });
    setBulkPriceAdjustment('none');
  };

  const assignImageToVariant = (variantIndex: number, imageUrl: string) => {
    const variant = formData.variants[variantIndex];
    const images = variant.assigned_images.includes(imageUrl)
      ? variant.assigned_images.filter(img => img !== imageUrl)
      : [...variant.assigned_images, imageUrl];
    
    updateVariant(variantIndex, { assigned_images: images });
  };

  return (
    <div className="space-y-6">
      <Alert className="bg-[var(--color-creme)] border-[var(--color-canyon)]">
        <Grid3x3 className="w-4 h-4 text-[var(--color-canyon)]" />
        <AlertDescription className="text-[var(--color-dark)]">
          <strong>Variants:</strong> Create different versions of your product (sizes, colors, packaging). 
          Each variant can have its own price, stock, and images.
        </AlertDescription>
      </Alert>

      {/* Bulk Actions */}
      {formData.variants.length > 0 && (
        <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
          <CardHeader>
            <CardTitle className="text-lg text-[var(--color-dark)]">Bulk Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2 flex-1 min-w-[200px]">
                <Label className="text-[var(--color-dark)] font-semibold">Price Adjustment</Label>
                <Select value={bulkPriceAdjustment} onValueChange={(value: any) => setBulkPriceAdjustment(value)}>
                  <SelectTrigger className="bg-[var(--color-creme)] border-[var(--color-coyote)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
                    <SelectItem value="none">No adjustment</SelectItem>
                    <SelectItem value="increase">Increase prices</SelectItem>
                    <SelectItem value="decrease">Decrease prices</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {bulkPriceAdjustment !== 'none' && (
                <>
                  <div className="space-y-2 w-32">
                    <Label className="text-[var(--color-dark)] font-semibold">By %</Label>
                    <Input
                      type="number"
                      value={bulkPriceValue}
                      onChange={(e) => setBulkPriceValue(parseFloat(e.target.value) || 0)}
                      min="0"
                      max="100"
                      className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={applyBulkPriceAdjustment}
                    className="bg-[var(--color-canyon)] text-white hover:bg-[var(--color-dark)]"
                  >
                    Apply to All
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Variants List */}
      <div className="space-y-3">
        {formData.variants.length === 0 ? (
          <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
            <CardContent className="py-12 text-center">
              <p className="text-[var(--color-dark)]/60 mb-4">
                No variants added yet. Add variants if your product comes in different sizes, colors, or packaging.
              </p>
              <Button
                type="button"
                onClick={addVariant}
                className="bg-[var(--color-dark)] text-[var(--color-creme-light)] hover:bg-[var(--color-canyon)]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add First Variant
              </Button>
            </CardContent>
          </Card>
        ) : (
          formData.variants.map((variant, index) => (
            <Collapsible
              key={index}
              open={expandedVariants.has(index)}
              onOpenChange={() => toggleVariant(index)}
            >
              <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <CollapsibleTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="p-1 h-auto"
                        >
                          {expandedVariants.has(index) ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <div className="flex-1">
                        <h3 className="font-semibold text-[var(--color-dark)]">
                          {variant.variant_name || `Variant ${index + 1}`}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {variant.variant_type}
                          </Badge>
                          <span className="text-sm text-[var(--color-dark)]/70">
                            {formatINR(variant.price)}
                          </span>
                          <span className="text-sm text-[var(--color-dark)]/70">
                            Stock: {variant.stock}
                          </span>
                          {variant.assigned_images.length > 0 && (
                            <Badge className="bg-[var(--color-canyon)] text-xs">
                              <ImageIcon className="w-3 h-3 mr-1" />
                              {variant.assigned_images.length}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={variant.is_active}
                        onCheckedChange={(checked: boolean) => updateVariant(index, { is_active: checked })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => duplicateVariant(index)}
                        className="text-[var(--color-dark)]"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeVariant(index)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CollapsibleContent>
                  <CardContent className="space-y-4 pt-4 border-t border-[var(--color-coyote)]">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[var(--color-dark)] font-semibold">Variant Name *</Label>
                        <Input
                          value={variant.variant_name}
                          onChange={(e) => updateVariant(index, { 
                            variant_name: e.target.value,
                            variant_slug: generateSlug(e.target.value)
                          })}
                          placeholder="e.g., Box of 20, Red, Large"
                          className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[var(--color-dark)] font-semibold">Variant Type</Label>
                        <Select
                          value={variant.variant_type}
                          onValueChange={(value: any) => updateVariant(index, { variant_type: value })}
                        >
                          <SelectTrigger className="bg-[var(--color-creme)] border-[var(--color-coyote)]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
                            <SelectItem value="packaging">Packaging</SelectItem>
                            <SelectItem value="size">Size</SelectItem>
                            <SelectItem value="color">Color</SelectItem>
                            <SelectItem value="flavor">Flavor</SelectItem>
                            <SelectItem value="material">Material</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[var(--color-dark)] font-semibold">Price (₹) *</Label>
                        <Input
                          type="number"
                          value={variant.price}
                          onChange={(e) => updateVariant(index, { price: parseFloat(e.target.value) || 0 })}
                          min="0"
                          step="0.01"
                          className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[var(--color-dark)] font-semibold">Compare At (₹)</Label>
                        <Input
                          type="number"
                          value={variant.compare_at_price || ''}
                          onChange={(e) => updateVariant(index, { compare_at_price: parseFloat(e.target.value) || undefined })}
                          min="0"
                          step="0.01"
                          className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[var(--color-dark)] font-semibold">Stock *</Label>
                        <Input
                          type="number"
                          value={variant.stock}
                          onChange={(e) => updateVariant(index, { stock: parseInt(e.target.value) || 0 })}
                          min="0"
                          className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
                        />
                      </div>
                    </div>

                    {/* Image Assignment */}
                    {formData.gallery_images.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-[var(--color-dark)] font-semibold">Assigned Images</Label>
                        <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                          {formData.gallery_images.map((img, imgIndex) => (
                            <button
                              key={imgIndex}
                              type="button"
                              onClick={() => assignImageToVariant(index, img)}
                              className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                                variant.assigned_images.includes(img)
                                  ? 'border-[var(--color-canyon)] ring-2 ring-[var(--color-canyon)]/30'
                                  : 'border-[var(--color-coyote)] hover:border-[var(--color-canyon)]'
                              }`}
                            >
                              <img src={img} alt="" className="w-full h-full object-cover" />
                              {variant.assigned_images.includes(img) && (
                                <div className="absolute inset-0 bg-[var(--color-canyon)]/20 flex items-center justify-center">
                                  <div className="w-6 h-6 rounded-full bg-[var(--color-canyon)] text-white flex items-center justify-center">
                                    ✓
                                  </div>
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Attributes */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[var(--color-dark)] font-semibold">Attributes</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addAttribute(index)}
                          className="border-[var(--color-coyote)]"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add
                        </Button>
                      </div>
                      {variant.attributes.map((attr, attrIndex) => (
                        <div key={attrIndex} className="flex gap-2">
                          <Input
                            value={attr.key}
                            onChange={(e) => updateAttribute(index, attrIndex, 'key', e.target.value)}
                            placeholder="Attribute name"
                            className="bg-[var(--color-creme)] border-[var(--color-coyote)] flex-1"
                          />
                          <Input
                            value={attr.value}
                            onChange={(e) => updateAttribute(index, attrIndex, 'value', e.target.value)}
                            placeholder="Value"
                            className="bg-[var(--color-creme)] border-[var(--color-coyote)] flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeAttribute(index, attrIndex)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))
        )}
      </div>

      {/* Add Variant Button */}
      {formData.variants.length > 0 && (
        <Button
          type="button"
          onClick={addVariant}
          variant="outline"
          className="w-full border-[var(--color-coyote)] hover:bg-[var(--color-coyote)]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Another Variant
        </Button>
      )}
    </div>
  );
}
