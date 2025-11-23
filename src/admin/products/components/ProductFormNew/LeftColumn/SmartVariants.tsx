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
  
  const addVariant = (type: 'carton' | 'custom') => {
    const basePrice = formData.price || 0;
    
    let newVariant: VariantFormData = {
      variant_name: '',
      variant_type: 'packaging',
      packaging: 'pack',
      units_contained: 1,
      price: basePrice,
      stock: 0,
      track_inventory: true,
      is_active: true,
      sort_order: formData.variants.length,
      attributes: [],
      assigned_images: []
    };

    if (type === 'carton') {
      newVariant = {
        ...newVariant,
        variant_name: 'Carton (10 Packs)',
        packaging: 'carton',
        units_contained: 10,
        price: basePrice * 10 * 0.95, // 5% discount default
        compare_at_price: basePrice * 10
      };
    } else {
      newVariant = {
        ...newVariant,
        variant_name: 'Custom Variant',
        packaging: 'bundle',
        units_contained: 1
      };
    }

    onChange({ variants: [...formData.variants, newVariant] });
  };

  const updateVariant = (index: number, updates: Partial<VariantFormData>) => {
    const newVariants = [...formData.variants];
    newVariants[index] = { ...newVariants[index], ...updates };
    onChange({ variants: newVariants });
  };

  const removeVariant = (index: number) => {
    const newVariants = formData.variants.filter((_, i) => i !== index);
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
            <p className="text-sm text-[var(--color-dark)]/60 mb-4">The base product is sold as a single unit.</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => addVariant('carton')} variant="outline" className="border-[var(--color-coyote)]">
                + Add Carton (10x)
              </Button>
              <Button onClick={() => addVariant('custom')} variant="ghost">
                + Add Custom
              </Button>
            </div>
          </div>
        )}

        {/* Variants List */}
        <div className="space-y-4">
          {formData.variants.map((variant, index) => {
             const discount = calculateDiscount(variant.price, variant.compare_at_price);
             
             return (
              <div key={index} className="p-4 bg-[var(--color-creme)] border border-[var(--color-coyote)] rounded-lg">
                
                <div className="grid grid-cols-[1fr_120px_120px_auto] gap-4 items-start mb-4">
                  {/* Info */}
                  <div className="space-y-2">
                    <Label className="text-xs text-[var(--color-dark)]/60">Variant Name</Label>
                    <div className="flex gap-2">
                      <Input
                        value={variant.variant_name}
                        onChange={(e) => updateVariant(index, { variant_name: e.target.value })}
                        className="h-9 bg-white border-[var(--color-coyote)]/50"
                      />
                      <div className="flex items-center gap-1 px-2 py-1 bg-[var(--color-creme-light)] border border-[var(--color-coyote)]/30 rounded text-xs">
                        <Box className="w-3 h-3" />
                        <input 
                          type="number" 
                          value={variant.units_contained} 
                          onChange={(e) => updateVariant(index, { units_contained: parseInt(e.target.value) })}
                          className="w-8 bg-transparent text-center focus:outline-none"
                        />
                        <span className="text-[var(--color-dark)]/50">units</span>
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
                    <Input
                      type="number"
                      value={variant.stock}
                      onChange={(e) => updateVariant(index, { stock: parseInt(e.target.value) })}
                      className="h-9 bg-white border-[var(--color-coyote)]/50"
                    />
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

                {/* Variant Image */}
                <div className="border-t border-[var(--color-coyote)]/20 pt-4">
                  <Label className="text-xs text-[var(--color-dark)]/60 block mb-2">Variant Image (Optional)</Label>
                  <div className="flex items-center gap-4">
                    <div className="scale-75 origin-top-left -mb-4 -mr-4">
                      <MultipleImageUpload
                        imageUrls={variant.assigned_images || []}
                        onImageUrlsChange={(images) => updateVariant(index, { assigned_images: images })}
                        showSelector={true}
                        maxImages={1}
                        id={`variant-image-${index}`}
                      />
                    </div>
                    <div className="text-xs text-[var(--color-dark)]/40 italic">
                      Upload an image specifically for this variant (e.g. Red Box). <br/>
                      If left empty, the main product image will be used.
                    </div>
                  </div>
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
