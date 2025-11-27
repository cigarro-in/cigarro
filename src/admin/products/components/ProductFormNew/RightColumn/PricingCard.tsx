import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Label } from "../../../../../components/ui/label";
import { Input } from "../../../../../components/ui/input";
import { ProductFormData, calculateProfitMargin } from "../../../../../types/product";
import { Alert, AlertDescription } from "../../../../../components/ui/alert";
import { Info } from "lucide-react";

interface PricingCardProps {
  formData: ProductFormData;
  onChange: (updates: Partial<ProductFormData>) => void;
}

export function PricingCard({ formData, onChange }: PricingCardProps) {
  // Find default variant
  const defaultVariant = formData.variants.find(v => v.is_default);
  
  // Calculate margin from default variant
  const margin = defaultVariant ? calculateProfitMargin(defaultVariant.price, defaultVariant.cost_price) : 0;

  return (
    <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)] shadow-sm">
      <CardHeader className="pb-4 border-b border-[var(--color-coyote)]/20">
        <CardTitle className="text-sm font-sans text-[var(--color-dark)] uppercase tracking-wider">Pricing</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        
        {!defaultVariant ? (
          <Alert className="bg-amber-50 border-amber-200 text-amber-800">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Add a default variant to set pricing information. All pricing is now managed through variants.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Default Variant Price */}
            <div className="space-y-2">
              <Label className="text-xs text-[var(--color-dark)]/60">
                Default Variant Price <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-dark)]/50">₹</span>
                <Input
                  type="number"
                  value={defaultVariant.price}
                  onChange={(e) => {
                    const newVariants = [...formData.variants];
                    const index = newVariants.findIndex(v => v.is_default);
                    if (index >= 0) {
                      newVariants[index] = { ...newVariants[index], price: parseFloat(e.target.value) };
                      onChange({ variants: newVariants });
                    }
                  }}
                  className="pl-8 bg-[var(--color-creme)] border-[var(--color-coyote)]"
                />
              </div>
            </div>

            {/* Compare At */}
            <div className="space-y-2">
              <Label className="text-xs text-[var(--color-dark)]/60">Compare at price</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-dark)]/50">₹</span>
                <Input
                  type="number"
                  value={defaultVariant.compare_at_price || ''}
                  onChange={(e) => {
                    const newVariants = [...formData.variants];
                    const index = newVariants.findIndex(v => v.is_default);
                    if (index >= 0) {
                      newVariants[index] = { ...newVariants[index], compare_at_price: parseFloat(e.target.value) };
                      onChange({ variants: newVariants });
                    }
                  }}
                  className="pl-8 bg-[var(--color-creme)] border-[var(--color-coyote)]"
                />
              </div>
            </div>

            {/* Cost Price & Margin */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-xs text-[var(--color-dark)]/60">Cost per item</Label>
                {margin !== 0 && (
                  <span className={`text-xs font-medium ${margin > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {margin}% Margin
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-dark)]/50">₹</span>
                <Input
                  type="number"
                  value={defaultVariant.cost_price || ''}
                  onChange={(e) => {
                    const newVariants = [...formData.variants];
                    const index = newVariants.findIndex(v => v.is_default);
                    if (index >= 0) {
                      newVariants[index] = { ...newVariants[index], cost_price: parseFloat(e.target.value) };
                      onChange({ variants: newVariants });
                    }
                  }}
                  className="pl-8 bg-[var(--color-creme)] border-[var(--color-coyote)]"
                />
              </div>
              <p className="text-[10px] text-[var(--color-dark)]/40">Customers won't see this</p>
            </div>
          </>
        )}

      </CardContent>
    </Card>
  );
}
