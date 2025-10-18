// ============================================================================
// VARIANTS TAB - Shopify-style variant management
// ============================================================================

import { useState } from 'react';
import { Plus, Trash2, GripVertical, Image as ImageIcon, DollarSign, Package, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { Switch } from '../../../../components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Alert, AlertDescription } from '../../../../components/ui/alert';
import { Badge } from '../../../../components/ui/badge';
import { Separator } from '../../../../components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../../../components/ui/collapsible';
import { ProductFormData, VariantFormData, calculateDiscount } from '../../../../types/product';
import { formatINR } from '../../../../utils/currency';

interface VariantsTabProps {
  formData: ProductFormData;
  onChange: (updates: Partial<ProductFormData>) => void;
  productImages: string[];
}

export function VariantsTab({ formData, onChange, productImages }: VariantsTabProps) {
  const [expandedVariants, setExpandedVariants] = useState<Set<number>>(new Set([0]));

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
      attributes: [{ key: '', value: '' }],
      is_active: true,
      sort_order: formData.variants.length,
      assigned_images: []
    };
    onChange({ variants: [...formData.variants, newVariant] });
    setExpandedVariants(new Set([...expandedVariants, formData.variants.length]));
  };

  const updateVariant = (index: number, updates: Partial<VariantFormData>) => {
    const newVariants = [...formData.variants];
    newVariants[index] = { ...newVariants[index], ...updates };
    onChange({ variants: newVariants });
  };

  const removeVariant = (index: number) => {
    if (confirm('Are you sure you want to remove this variant?')) {
      const newVariants = formData.variants.filter((_, i) => i !== index);
      onChange({ variants: newVariants });
      const newExpanded = new Set(expandedVariants);
      newExpanded.delete(index);
      setExpandedVariants(newExpanded);
    }
  };

  const toggleImageAssignment = (variantIndex: number, imageUrl: string) => {
    const variant = formData.variants[variantIndex];
    const assigned = variant.assigned_images || [];
    const newAssigned = assigned.includes(imageUrl)
      ? assigned.filter(url => url !== imageUrl)
      : [...assigned, imageUrl];
    updateVariant(variantIndex, { assigned_images: newAssigned });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-sans font-medium text-[var(--color-dark)]">Product Variants</h3>
          <p className="text-sm text-[var(--color-dark)]/70">
            Create variants like different sizes, colors, or packaging options
          </p>
        </div>
        <Button
          type="button"
          onClick={addVariant}
          className="bg-[var(--color-dark)] text-[var(--color-creme-light)] hover:bg-[var(--color-canyon)]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Variant
        </Button>
      </div>

      {/* Variants List */}
      {formData.variants.length === 0 ? (
        <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)] border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="w-12 h-12 text-[var(--color-coyote)] mb-4" />
            <h4 className="text-lg font-medium text-[var(--color-dark)] mb-2">No Variants Yet</h4>
            <p className="text-sm text-[var(--color-dark)]/70 mb-4 text-center max-w-md">
              Variants let you offer different versions of this product, like different sizes or packaging options.
            </p>
            <Button
              type="button"
              onClick={addVariant}
              className="bg-[var(--color-dark)] text-[var(--color-creme-light)] hover:bg-[var(--color-canyon)]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Variant
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {formData.variants.map((variant, index) => {
            const discountInfo = calculateDiscount(variant.price, variant.compare_at_price);
            const isExpanded = expandedVariants.has(index);

            return (
              <Card key={index} className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
                <Collapsible open={isExpanded} onOpenChange={() => toggleVariant(index)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-[var(--color-creme)] transition-colors">
                      <div className="flex items-center gap-3">
                        <GripVertical className="w-5 h-5 text-[var(--color-coyote)] cursor-grab" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base font-sans text-[var(--color-dark)]">
                              {variant.variant_name || `Variant ${index + 1}`}
                            </CardTitle>
                            {!variant.is_active && (
                              <Badge variant="secondary" className="text-xs">Inactive</Badge>
                            )}
                            {discountInfo.discount_percentage && (
                              <Badge className="bg-[var(--color-canyon)] text-[var(--color-creme-light)] text-xs">
                                {discountInfo.discount_percentage}% OFF
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="text-[var(--color-dark)]/70 text-sm mt-1">
                            {formatINR(variant.price)} • {variant.stock} in stock • {variant.variant_type}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-[var(--color-dark)]" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-[var(--color-dark)]" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="space-y-6 pt-0">
                      <Separator className="bg-[var(--color-coyote)]" />

                      {/* Basic Info */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[var(--color-dark)] font-medium">
                            Variant Name <span className="text-[var(--color-canyon)]">*</span>
                          </Label>
                          <Input
                            value={variant.variant_name}
                            onChange={(e) => updateVariant(index, { variant_name: e.target.value })}
                            placeholder="e.g., 20 Pack, Large, Red"
                            className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[var(--color-dark)] font-medium">Variant Type</Label>
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
                              <SelectItem value="material">Material</SelectItem>
                              <SelectItem value="flavor">Flavor</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Pricing */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-[var(--color-dark)] flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          Pricing
                        </h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[var(--color-dark)] font-medium">
                              Price <span className="text-[var(--color-canyon)]">*</span>
                            </Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-dark)]/70">₹</span>
                              <Input
                                type="number"
                                value={variant.price === 0 ? '' : (variant.price || '')}
                                onChange={(e) => updateVariant(index, { price: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                                placeholder="0.00"
                                step="0.01"
                                className="pl-8 bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[var(--color-dark)] font-medium">Compare at Price</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-dark)]/70">₹</span>
                              <Input
                                type="number"
                                value={variant.compare_at_price || ''}
                                onChange={(e) => updateVariant(index, { compare_at_price: parseFloat(e.target.value) || undefined })}
                                placeholder="0.00"
                                step="0.01"
                                className="pl-8 bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[var(--color-dark)] font-medium">Cost</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-dark)]/70">₹</span>
                              <Input
                                type="number"
                                value={variant.cost_price || ''}
                                onChange={(e) => updateVariant(index, { cost_price: parseFloat(e.target.value) || undefined })}
                                placeholder="0.00"
                                step="0.01"
                                className="pl-8 bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Inventory */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-[var(--color-dark)] flex items-center gap-2">
                          <Package className="w-4 h-4" />
                          Inventory
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[var(--color-dark)] font-medium">Stock Quantity</Label>
                            <Input
                              type="number"
                              value={variant.stock === 0 ? '' : (variant.stock || '')}
                              onChange={(e) => updateVariant(index, { stock: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                              placeholder="0"
                              min="0"
                              className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[var(--color-dark)] font-medium">Weight (kg)</Label>
                            <Input
                              type="number"
                              value={variant.weight || ''}
                              onChange={(e) => updateVariant(index, { weight: parseFloat(e.target.value) || undefined })}
                              placeholder="0.0"
                              step="0.01"
                              className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Images */}
                      {productImages.length > 0 && (
                        <div className="space-y-4">
                          <h4 className="text-sm font-medium text-[var(--color-dark)] flex items-center gap-2">
                            <ImageIcon className="w-4 h-4" />
                            Variant Images
                          </h4>
                          <div className="grid grid-cols-4 gap-3">
                            {productImages.map((imageUrl, imgIndex) => {
                              const isAssigned = (variant.assigned_images || []).includes(imageUrl);
                              return (
                                <button
                                  key={imgIndex}
                                  type="button"
                                  onClick={() => toggleImageAssignment(index, imageUrl)}
                                  className={`relative aspect-square rounded-lg border-2 overflow-hidden transition-all ${
                                    isAssigned
                                      ? 'border-[var(--color-canyon)] ring-2 ring-[var(--color-canyon)]/20'
                                      : 'border-[var(--color-coyote)] hover:border-[var(--color-dark)]'
                                  }`}
                                >
                                  <img
                                    src={imageUrl}
                                    alt={`Product ${imgIndex + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                  {isAssigned && (
                                    <div className="absolute inset-0 bg-[var(--color-canyon)]/20 flex items-center justify-center">
                                      <div className="w-6 h-6 bg-[var(--color-canyon)] rounded-full flex items-center justify-center">
                                        <span className="text-white text-xs">✓</span>
                                      </div>
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                          <p className="text-xs text-[var(--color-dark)]/60">
                            Click images to assign them to this variant
                          </p>
                        </div>
                      )}

                      {/* Attributes */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-[var(--color-dark)]">Attributes</h4>
                        <div className="space-y-2">
                          {variant.attributes.map((attr, attrIndex) => (
                            <div key={attrIndex} className="flex gap-2">
                              <Input
                                value={attr.key}
                                onChange={(e) => {
                                  const newAttrs = [...variant.attributes];
                                  newAttrs[attrIndex].key = e.target.value;
                                  updateVariant(index, { attributes: newAttrs });
                                }}
                                placeholder="Key"
                                className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
                              />
                              <Input
                                value={attr.value}
                                onChange={(e) => {
                                  const newAttrs = [...variant.attributes];
                                  newAttrs[attrIndex].value = e.target.value;
                                  updateVariant(index, { attributes: newAttrs });
                                }}
                                placeholder="Value"
                                className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const newAttrs = variant.attributes.filter((_, i) => i !== attrIndex);
                                  updateVariant(index, { attributes: newAttrs.length > 0 ? newAttrs : [{ key: '', value: '' }] });
                                }}
                                className="text-[var(--color-canyon)] hover:bg-[var(--color-coyote)]"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              updateVariant(index, {
                                attributes: [...variant.attributes, { key: '', value: '' }]
                              });
                            }}
                            className="border-[var(--color-coyote)] hover:bg-[var(--color-coyote)]"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Attribute
                          </Button>
                        </div>
                      </div>

                      {/* Actions */}
                      <Separator className="bg-[var(--color-coyote)]" />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={variant.is_active}
                            onCheckedChange={(checked: boolean) => updateVariant(index, { is_active: checked })}
                            className="data-[state=checked]:bg-[var(--color-canyon)]"
                          />
                          <Label className="text-[var(--color-dark)]">Active</Label>
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => removeVariant(index)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remove Variant
                        </Button>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}

      {formData.variants.length > 0 && (
        <Alert className="bg-[var(--color-creme)] border-[var(--color-coyote)]">
          <Package className="h-4 w-4 text-[var(--color-canyon)]" />
          <AlertDescription className="text-[var(--color-dark)]/70">
            <strong>Tip:</strong> Variants inherit the base product price by default. Adjust individual variant prices as needed.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
