// ============================================================================
// PRICING & INVENTORY TAB - Shopify-style pricing with discounts
// ============================================================================

import { DollarSign, Package, TrendingDown, AlertTriangle, Info } from 'lucide-react';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Switch } from '../../../../components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Alert, AlertDescription } from '../../../../components/ui/alert';
import { Badge } from '../../../../components/ui/badge';
import { Separator } from '../../../../components/ui/separator';
import { ProductFormData, calculateDiscount, calculateProfitMargin, getInventoryStatus } from '../../../../types/product';
import { formatINR } from '../../../../utils/currency';

interface PricingInventoryTabProps {
  formData: ProductFormData;
  onChange: (updates: Partial<ProductFormData>) => void;
}

export function PricingInventoryTab({ formData, onChange }: PricingInventoryTabProps) {
  const discountInfo = calculateDiscount(formData.price, formData.compare_at_price);
  const profitMargin = calculateProfitMargin(formData.price, formData.cost_price);
  const inventoryStatus = getInventoryStatus(formData.stock, formData.continue_selling_when_out_of_stock);

  return (
    <div className="space-y-6">
      {/* Pricing */}
      <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[var(--color-canyon)]" />
            <CardTitle className="text-lg font-sans text-[var(--color-dark)]">Pricing</CardTitle>
          </div>
          <CardDescription className="text-[var(--color-dark)]/70">
            Set product pricing and discounts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Price */}
          <div className="space-y-2">
            <Label htmlFor="price" className="text-[var(--color-dark)] font-medium">
              Price <span className="text-[var(--color-canyon)]">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-dark)]/70">
                ₹
              </span>
              <Input
                id="price"
                type="number"
                value={formData.price || ''}
                onChange={(e) => onChange({ price: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="pl-8 bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)] text-lg font-medium"
                required
              />
            </div>
            <p className="text-sm text-[var(--color-dark)]/60">
              Customers pay this price
            </p>
          </div>

          {/* Compare at Price (Original Price for Discount) */}
          <div className="space-y-2">
            <Label htmlFor="compare_at_price" className="text-[var(--color-dark)] font-medium">
              Compare at Price
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-dark)]/70">
                ₹
              </span>
              <Input
                id="compare_at_price"
                type="number"
                value={formData.compare_at_price || ''}
                onChange={(e) => onChange({ compare_at_price: parseFloat(e.target.value) || undefined })}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="pl-8 bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
              />
            </div>
            <p className="text-sm text-[var(--color-dark)]/60">
              Original price before discount (shown as strikethrough)
            </p>
          </div>

          {/* Discount Display */}
          {discountInfo.discount_percentage && (
            <Alert className="bg-[var(--color-canyon)]/10 border-[var(--color-canyon)]">
              <TrendingDown className="h-4 w-4 text-[var(--color-canyon)]" />
              <AlertDescription className="text-[var(--color-dark)]">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {discountInfo.discount_percentage}% OFF
                  </span>
                  <span>
                    Save {formatINR(discountInfo.discount_amount || 0)}
                  </span>
                </div>
                <div className="mt-2 text-sm">
                  <span className="line-through text-[var(--color-dark)]/60">
                    {formatINR(discountInfo.compare_at_price || 0)}
                  </span>
                  <span className="mx-2">→</span>
                  <span className="text-[var(--color-canyon)] font-bold">
                    {formatINR(discountInfo.price)}
                  </span>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <Separator className="bg-[var(--color-coyote)]" />

          {/* Cost Price (Internal) */}
          <div className="space-y-2">
            <Label htmlFor="cost_price" className="text-[var(--color-dark)] font-medium">
              Cost per Item
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-dark)]/70">
                ₹
              </span>
              <Input
                id="cost_price"
                type="number"
                value={formData.cost_price || ''}
                onChange={(e) => onChange({ cost_price: parseFloat(e.target.value) || undefined })}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="pl-8 bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
              />
            </div>
            <p className="text-sm text-[var(--color-dark)]/60">
              Your cost for this product (not shown to customers)
            </p>
          </div>

          {/* Profit Margin Display */}
          {profitMargin > 0 && (
            <div className="p-3 bg-[var(--color-creme)] border border-[var(--color-coyote)] rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-dark)]/70">Profit Margin</span>
                <Badge className="bg-[var(--color-dark)] text-[var(--color-creme-light)]">
                  {profitMargin}%
                </Badge>
              </div>
              {formData.cost_price && (
                <p className="text-xs text-[var(--color-dark)]/60 mt-1">
                  Profit: {formatINR(formData.price - formData.cost_price)} per item
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inventory */}
      <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[var(--color-canyon)]" />
            <CardTitle className="text-lg font-sans text-[var(--color-dark)]">Inventory</CardTitle>
          </div>
          <CardDescription className="text-[var(--color-dark)]/70">
            Manage stock levels and tracking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stock Quantity */}
          <div className="space-y-2">
            <Label htmlFor="stock" className="text-[var(--color-dark)] font-medium">
              Stock Quantity
            </Label>
            <Input
              id="stock"
              type="number"
              value={formData.stock || ''}
              onChange={(e) => onChange({ stock: parseInt(e.target.value) || 0 })}
              placeholder="0"
              min="0"
              step="1"
              className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)] text-lg font-medium"
            />
            <div className="flex items-center gap-2">
              <Badge 
                variant={inventoryStatus.stock_status === 'in_stock' ? 'default' : 
                        inventoryStatus.stock_status === 'low_stock' ? 'secondary' : 
                        'destructive'}
                className={
                  inventoryStatus.stock_status === 'in_stock' 
                    ? 'bg-green-600' 
                    : inventoryStatus.stock_status === 'low_stock'
                    ? 'bg-yellow-600'
                    : 'bg-red-600'
                }
              >
                {inventoryStatus.stock_status === 'in_stock' && 'In Stock'}
                {inventoryStatus.stock_status === 'low_stock' && 'Low Stock'}
                {inventoryStatus.stock_status === 'out_of_stock' && 'Out of Stock'}
              </Badge>
              <span className="text-sm text-[var(--color-dark)]/60">
                {formData.stock} units available
              </span>
            </div>
          </div>

          {/* Inventory Tracking */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-[var(--color-creme)] border border-[var(--color-coyote)] rounded-lg">
              <div>
                <Label className="text-[var(--color-dark)] font-medium">Track Inventory</Label>
                <p className="text-sm text-[var(--color-dark)]/70">Monitor stock levels automatically</p>
              </div>
              <Switch
                checked={formData.track_inventory}
                onCheckedChange={(checked) => onChange({ track_inventory: checked })}
                className="data-[state=checked]:bg-[var(--color-canyon)]"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-[var(--color-creme)] border border-[var(--color-coyote)] rounded-lg">
              <div>
                <Label className="text-[var(--color-dark)] font-medium">Continue Selling When Out of Stock</Label>
                <p className="text-sm text-[var(--color-dark)]/70">Allow backorders</p>
              </div>
              <Switch
                checked={formData.continue_selling_when_out_of_stock}
                onCheckedChange={(checked) => onChange({ continue_selling_when_out_of_stock: checked })}
                className="data-[state=checked]:bg-[var(--color-canyon)]"
              />
            </div>
          </div>

          {/* Low Stock Warning */}
          {inventoryStatus.stock_status === 'low_stock' && (
            <Alert className="bg-yellow-50 border-yellow-600">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-[var(--color-dark)]">
                Stock is running low. Consider restocking soon.
              </AlertDescription>
            </Alert>
          )}

          {/* Out of Stock Warning */}
          {inventoryStatus.stock_status === 'out_of_stock' && !formData.continue_selling_when_out_of_stock && (
            <Alert className="bg-red-50 border-red-600">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-[var(--color-dark)]">
                Product is out of stock and cannot be purchased.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Alert className="bg-[var(--color-creme)] border-[var(--color-coyote)]">
        <Info className="h-4 w-4 text-[var(--color-canyon)]" />
        <AlertDescription className="text-[var(--color-dark)]/70">
          <strong>Pricing Tips:</strong> Set "Compare at Price" higher than "Price" to show discounts. 
          Cost per item helps track profit margins but is never shown to customers.
        </AlertDescription>
      </Alert>
    </div>
  );
}
