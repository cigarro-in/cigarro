import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../../components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Button } from "../../../../../components/ui/button";
import { Input } from "../../../../../components/ui/input";
import { Label } from "../../../../../components/ui/label";
import { Switch } from "../../../../../components/ui/switch";
import { MultipleImageUpload } from "../../../../../components/ui/MultipleImageUpload";
import { Trash2, Plus, Package, Box } from "lucide-react";
import { ProductFormData, VariantFormData, calculateDiscount } from "../../../../../types/product";
import { formatINR } from "../../../../../utils/currency";

interface SmartVariantsProps {
  formData: ProductFormData;
  onChange: (updates: Partial<ProductFormData>) => void;
}

export function SmartVariants({ formData, onChange }: SmartVariantsProps) {
  // Get default variant price (if exists)
  const getDefaultVariantPrice = (): number => {
    const defaultVariant = formData.variants.find(v => v.is_default);
    return defaultVariant?.price || 0;
  };
  
  const addVariant = (type: 'carton' | 'custom') => {
    const basePrice = getDefaultVariantPrice();
    const isFirstVariant = formData.variants.length === 0;
    
    let newVariant: VariantFormData = {
      variant_name: '',
      variant_type: 'pack',
      units_contained: 20,
      unit: 'sticks',
      price: basePrice,
      stock: 0,
      track_inventory: false, // Default to false as requested
      is_active: true,
      is_default: isFirstVariant, // First variant is default
      images: [],
      compare_at_price: 0,
      cost_price: 0
    };

    if (type === 'carton') {
      newVariant = {
        ...newVariant,
        variant_name: 'Carton',
        variant_type: 'carton',
        units_contained: 10,
        unit: 'packs',
        price: basePrice * 10 * 0.95, // 5% discount default
        compare_at_price: basePrice * 10
      };
    } else {
      newVariant = {
        ...newVariant,
        variant_name: 'Custom',
        variant_type: 'pack',
        units_contained: 20
      };
    }

    onChange({ variants: [...formData.variants, newVariant] });
  };

  const updateVariant = (index: number, updates: Partial<VariantFormData>) => {
    const newVariants = [...formData.variants];
    
    // Handle default variant changes
    if (updates.is_default === true) {
      // Unset any other default variants
      newVariants.forEach((v, i) => {
        if (i !== index && v.is_default) {
          newVariants[i] = { ...v, is_default: false };
        }
      });
    }
    
    newVariants[index] = { ...newVariants[index], ...updates };
    onChange({ variants: newVariants });
  };

  const removeVariant = (index: number) => {
    const variantToRemove = formData.variants[index];
    const newVariants = formData.variants.filter((_, i) => i !== index);
    
    // If removing the default variant, set the first remaining variant as default
    if (variantToRemove.is_default && newVariants.length > 0) {
      newVariants[0] = { ...newVariants[0], is_default: true };
    }
    
    onChange({ variants: newVariants });
  };

  return (
    <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)] shadow-sm">
      <CardHeader className="pb-4 border-b border-[var(--color-coyote)]/20 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-sans text-[var(--color-dark)]">Selling Options</CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        
        {/* Base Product (Pack) is always assumed, but we list variants here */}
        {formData.variants.length === 0 && (
          <div className="text-center py-8 border-2 border-dashed border-[var(--color-coyote)]/30 rounded-lg bg-[var(--color-creme)]/50">
            <Package className="w-12 h-12 mx-auto text-[var(--color-coyote)] mb-3" />
            <p className="text-[var(--color-dark)] font-medium">No variants added</p>
            <p className="text-sm text-[var(--color-dark)]/60 mb-4">Add at least one variant to define the product.</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => addVariant('custom')} variant="outline" className="border-[var(--color-coyote)]">
                + Add Default Variant
              </Button>
              <Button onClick={() => addVariant('carton')} variant="ghost">
                + Add Carton (10x)
              </Button>
            </div>
          </div>
        )}

        {/* Variants List */}
        <div className="space-y-4">
          {formData.variants.map((variant, index) => {
             const discount = calculateDiscount(variant.price, variant.compare_at_price);
             
             return (
              <div key={index} className={`p-4 bg-[var(--color-creme)] border ${variant.is_default ? 'border-canyon border-2' : 'border-[var(--color-coyote)]'} rounded-lg`}>
                
                <div className="grid grid-cols-[1fr_120px_120px_auto] gap-4 items-start mb-4">
                  {/* Default Variant Toggle */}
                  <div className="absolute -top-3 -right-3">
                    <div 
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium cursor-pointer ${variant.is_default ? 'bg-canyon text-white' : 'bg-gray-100 text-gray-500'}`}
                      onClick={() => updateVariant(index, { is_default: true })}
                    >
                      {variant.is_default ? 'Default Variant' : 'Make Default'}
                    </div>
                  </div>
                  {/* Info */}
                  <div className="space-y-2">
                    <Label className="text-xs text-[var(--color-dark)]/60">
                      {variant.is_default ? 'Default Variant Name' : 'Variant Name'}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={variant.variant_name}
                        onChange={(e) => updateVariant(index, { variant_name: e.target.value })}
                        className="h-9 bg-white border-[var(--color-coyote)]/50"
                        placeholder="e.g. Packet"
                      />
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 px-2 py-1 bg-[var(--color-creme-light)] border border-[var(--color-coyote)]/30 rounded text-xs">
                          <Box className="w-3 h-3" />
                          <input 
                            type="number" 
                            value={variant.units_contained} 
                            onChange={(e) => updateVariant(index, { units_contained: parseInt(e.target.value) })}
                            className="w-10 bg-transparent text-center focus:outline-none"
                          />
                        </div>
                        <Select
                          value={variant.unit}
                          onValueChange={(val) => updateVariant(index, { unit: val })}
                        >
                          <SelectTrigger className="h-9 w-[100px] text-xs bg-white border-[var(--color-coyote)]/50">
                            <SelectValue placeholder="Unit" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sticks">Sticks</SelectItem>
                            <SelectItem value="packs">Packs</SelectItem>
                            <SelectItem value="cartons">Cartons</SelectItem>
                            <SelectItem value="bundles">Bundles</SelectItem>
                            <SelectItem value="pieces">Pieces</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="space-y-2">
                    <Label className="text-xs text-[var(--color-dark)]/60">Price</Label>
                    <Input
                      type="number"
                      value={variant.price}
                      onChange={(e) => updateVariant(index, { price: parseFloat(e.target.value) })}
                      className="h-9 bg-white border-[var(--color-coyote)]/50"
                    />
                    {discount.discount_percentage && (
                      <span className="text-[10px] text-green-600 font-medium">
                        {discount.discount_percentage}% Margin
                      </span>
                    )}
                  </div>

                  {/* Stock */}
                  <div className="space-y-2">
                    <Label className="text-xs text-[var(--color-dark)]/60">Stock</Label>
                    <div className="flex flex-col gap-1">
                      <Input
                        type="number"
                        value={variant.stock}
                        onChange={(e) => updateVariant(index, { stock: parseInt(e.target.value) })}
                        className="h-9 bg-white border-[var(--color-coyote)]/50"
                      />
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={variant.track_inventory} 
                          onCheckedChange={(c) => updateVariant(index, { track_inventory: c })}
                          className="scale-75 origin-left"
                        />
                        <span className="text-[10px] text-muted-foreground">Track</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-8">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeVariant(index)}
                      className="text-red-500 hover:bg-red-50 h-9 w-9"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Variant Images */}
                <div className="border-t border-[var(--color-coyote)]/20 pt-4">
                  <Label className="text-xs text-[var(--color-dark)]/60 block mb-2">
                    {variant.is_default ? (
                      <>Product Images <span className="text-red-500">*</span> <span className="text-canyon">(Primary variant - these are the main product images)</span></>
                    ) : (
                      'Variant Images (Optional)'
                    )}
                  </Label>
                  <MultipleImageUpload
                    imageUrls={variant.images || []}
                    onImageUrlsChange={(images) => updateVariant(index, { images: images })}
                    showSelector={true}
                    id={`variant-image-${index}`}
                  />
                  {variant.is_default && (!variant.images || variant.images.length === 0) && (
                    <p className="text-xs text-red-500 mt-2">Default variant must have at least one image</p>
                  )}
                </div>

              </div>
            );
          })}
        </div>

        {formData.variants.length > 0 && (
          <div className="flex gap-3 pt-2">
             <Button onClick={() => addVariant('carton')} variant="outline" className="border-[var(--color-coyote)] border-dashed text-[var(--color-dark)]/70">
                <Plus className="w-4 h-4 mr-2" /> Add Carton
              </Button>
              <Button onClick={() => addVariant('custom')} variant="outline" className="border-[var(--color-coyote)] border-dashed text-[var(--color-dark)]/70">
                <Plus className="w-4 h-4 mr-2" /> Add Custom
              </Button>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
