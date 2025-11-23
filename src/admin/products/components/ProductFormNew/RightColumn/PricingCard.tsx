import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Label } from "../../../../../components/ui/label";
import { Input } from "../../../../../components/ui/input";
import { ProductFormData, calculateProfitMargin } from "../../../../../types/product";

interface PricingCardProps {
  formData: ProductFormData;
  onChange: (updates: Partial<ProductFormData>) => void;
}

export function PricingCard({ formData, onChange }: PricingCardProps) {
  const margin = calculateProfitMargin(formData.price, formData.cost_price);

  return (
    <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)] shadow-sm">
      <CardHeader className="pb-4 border-b border-[var(--color-coyote)]/20">
        <CardTitle className="text-sm font-sans text-[var(--color-dark)] uppercase tracking-wider">Pricing</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        
        {/* Price */}
        <div className="space-y-2">
          <Label className="text-xs text-[var(--color-dark)]/60">Base Price</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-dark)]/50">₹</span>
            <Input
              type="number"
              value={formData.price}
              onChange={(e) => onChange({ price: parseFloat(e.target.value) })}
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
              value={formData.compare_at_price || ''}
              onChange={(e) => onChange({ compare_at_price: parseFloat(e.target.value) })}
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
              value={formData.cost_price || ''}
              onChange={(e) => onChange({ cost_price: parseFloat(e.target.value) })}
              className="pl-8 bg-[var(--color-creme)] border-[var(--color-coyote)]"
            />
          </div>
          <p className="text-[10px] text-[var(--color-dark)]/40">Customers won't see this</p>
        </div>

      </CardContent>
    </Card>
  );
}
