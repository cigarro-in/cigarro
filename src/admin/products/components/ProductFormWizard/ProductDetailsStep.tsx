// ============================================================================
// PRODUCT DETAILS STEP - Rich Content & Specifications
// Optional step for detailed product information
// ============================================================================

import { Plus, Trash2, Calculator } from 'lucide-react';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { ProductFormData } from '../../../../types/product';
import { formatINR } from '../../../../utils/currency';

interface ProductDetailsStepProps {
  formData: ProductFormData;
  setFormData: (data: ProductFormData) => void;
}

export function ProductDetailsStep({ formData, setFormData }: ProductDetailsStepProps) {
  const addSpecification = () => {
    setFormData({
      ...formData,
      specifications: [...formData.specifications, { key: '', value: '' }]
    });
  };

  const removeSpecification = (index: number) => {
    setFormData({
      ...formData,
      specifications: formData.specifications.filter((_, i) => i !== index)
    });
  };

  const updateSpecification = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...formData.specifications];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, specifications: updated });
  };

  const profitMargin = formData.cost_price && formData.price > 0
    ? Math.round(((formData.price - formData.cost_price) / formData.price) * 100)
    : 0;

  const discountPercentage = formData.compare_at_price && formData.compare_at_price > formData.price
    ? Math.round(((formData.compare_at_price - formData.price) / formData.compare_at_price) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Product Description */}
      <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
        <CardHeader>
          <CardTitle className="text-lg text-[var(--color-dark)]">Product Description</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description" className="text-[var(--color-dark)] font-semibold">
              Full Description
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detailed product description with features, benefits, and usage information..."
              rows={6}
              className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
            />
            <p className="text-xs text-[var(--color-dark)]/60">
              {formData.description.length} characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="short_description" className="text-[var(--color-dark)] font-semibold">
              Short Description
              <span className="text-xs font-normal text-[var(--color-dark)]/60 ml-2">
                For product cards and previews
              </span>
            </Label>
            <Textarea
              id="short_description"
              value={formData.short_description || ''}
              onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
              placeholder="Brief product summary (150-200 characters recommended)..."
              rows={3}
              className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
            />
            <p className="text-xs text-[var(--color-dark)]/60">
              {(formData.short_description || '').length} characters
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Pricing */}
      <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
        <CardHeader>
          <CardTitle className="text-lg text-[var(--color-dark)] flex items-center gap-2">
            <Calculator className="w-5 h-5 text-[var(--color-canyon)]" />
            Advanced Pricing & Profit
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cost_price" className="text-[var(--color-dark)] font-semibold">
                Your Cost Price (₹)
              </Label>
              <Input
                id="cost_price"
                type="number"
                value={formData.cost_price || ''}
                onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || undefined })}
                placeholder="300"
                min="0"
                step="0.01"
                className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="selling_price" className="text-[var(--color-dark)] font-semibold">
                Selling Price (₹)
              </Label>
              <Input
                id="selling_price"
                type="number"
                value={formData.price || ''}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                placeholder="500"
                min="0"
                step="0.01"
                className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="compare_price" className="text-[var(--color-dark)] font-semibold">
                Compare At Price (₹)
              </Label>
              <Input
                id="compare_price"
                type="number"
                value={formData.compare_at_price || ''}
                onChange={(e) => setFormData({ ...formData, compare_at_price: parseFloat(e.target.value) || undefined })}
                placeholder="600"
                min="0"
                step="0.01"
                className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
              />
            </div>
          </div>

          {/* Profit & Discount Display */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-[var(--color-creme)] rounded-lg border border-[var(--color-coyote)]">
            <div>
              <p className="text-sm text-[var(--color-dark)]/70 mb-1">Profit Margin</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[var(--color-dark)]">
                  {profitMargin}%
                </span>
                {formData.cost_price && (
                  <span className="text-sm text-[var(--color-dark)]/60">
                    ({formatINR(formData.price - formData.cost_price)} profit)
                  </span>
                )}
              </div>
              {profitMargin > 0 && (
                <Badge className={profitMargin >= 40 ? 'bg-green-600' : profitMargin >= 20 ? 'bg-yellow-600' : 'bg-red-600'}>
                  {profitMargin >= 40 ? 'Excellent' : profitMargin >= 20 ? 'Good' : 'Low'}
                </Badge>
              )}
            </div>

            <div>
              <p className="text-sm text-[var(--color-dark)]/70 mb-1">Customer Discount</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[var(--color-canyon)]">
                  {discountPercentage}% OFF
                </span>
                {formData.compare_at_price && formData.compare_at_price > formData.price && (
                  <span className="text-sm text-[var(--color-dark)]/60">
                    (Save {formatINR(formData.compare_at_price - formData.price)})
                  </span>
                )}
              </div>
              {discountPercentage > 0 && (
                <Badge className="bg-[var(--color-canyon)]">
                  Discount Active
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product Details */}
      <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
        <CardHeader>
          <CardTitle className="text-lg text-[var(--color-dark)]">Product Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="origin" className="text-[var(--color-dark)] font-semibold">
                Origin/Country
              </Label>
              <Input
                id="origin"
                value={formData.origin || ''}
                onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                placeholder="e.g., USA, India, UK"
                className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pack_size" className="text-[var(--color-dark)] font-semibold">
                Pack Size
              </Label>
              <Input
                id="pack_size"
                value={formData.pack_size || ''}
                onChange={(e) => setFormData({ ...formData, pack_size: e.target.value })}
                placeholder="e.g., 20 cigarettes, 10 cigars"
                className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Specifications */}
      <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-[var(--color-dark)]">Product Specifications</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSpecification}
              className="border-[var(--color-coyote)] hover:bg-[var(--color-coyote)]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Spec
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {formData.specifications.length === 0 ? (
            <p className="text-sm text-[var(--color-dark)]/60 text-center py-4">
              No specifications added yet. Click "Add Spec" to add product specifications.
            </p>
          ) : (
            formData.specifications.map((spec, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={spec.key}
                  onChange={(e) => updateSpecification(index, 'key', e.target.value)}
                  placeholder="Specification name (e.g., Nicotine)"
                  className="bg-[var(--color-creme)] border-[var(--color-coyote)] flex-1"
                />
                <Input
                  value={spec.value}
                  onChange={(e) => updateSpecification(index, 'value', e.target.value)}
                  placeholder="Value (e.g., 0.8mg)"
                  className="bg-[var(--color-creme)] border-[var(--color-coyote)] flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeSpecification(index)}
                  className="border-[var(--color-coyote)] hover:bg-red-50 hover:border-red-300"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
