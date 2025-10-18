// ============================================================================
// REVIEW & PUBLISH STEP - Final Review Before Publishing
// Visual preview and validation checklist
// ============================================================================

import { CheckCircle2, AlertCircle, Package, DollarSign, Image as ImageIcon, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { Alert, AlertDescription } from '../../../../components/ui/alert';
import { Switch } from '../../../../components/ui/switch';
import { Label } from '../../../../components/ui/label';
import { ProductFormData, Product, calculateDiscount } from '../../../../types/product';
import { formatINR } from '../../../../utils/currency';

interface ReviewPublishStepProps {
  formData: ProductFormData;
  product?: Product | null;
}

export function ReviewPublishStep({ formData, product }: ReviewPublishStepProps) {
  const validationChecks = [
    {
      label: 'Product name added',
      passed: formData.name.trim().length > 0,
      required: true
    },
    {
      label: 'Brand selected',
      passed: formData.brand.trim().length > 0,
      required: true
    },
    {
      label: 'Price set',
      passed: formData.price > 0,
      required: true
    },
    {
      label: 'At least one image',
      passed: formData.gallery_images.length > 0,
      required: true
    },
    {
      label: 'Product description',
      passed: formData.description.trim().length > 0,
      required: false
    },
    {
      label: 'SEO metadata',
      passed: formData.meta_title && formData.meta_description,
      required: false
    },
    {
      label: 'Stock quantity set',
      passed: formData.stock >= 0,
      required: true
    }
  ];

  const requiredPassed = validationChecks.filter(c => c.required && c.passed).length;
  const requiredTotal = validationChecks.filter(c => c.required).length;
  const optionalPassed = validationChecks.filter(c => !c.required && c.passed).length;
  const optionalTotal = validationChecks.filter(c => !c.required).length;

  const allRequiredPassed = requiredPassed === requiredTotal;

  const discount = formData.compare_at_price 
    ? calculateDiscount(formData.price, formData.compare_at_price)
    : null;

  return (
    <div className="space-y-6">
      {/* Validation Status */}
      <Alert className={allRequiredPassed ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300'}>
        {allRequiredPassed ? (
          <CheckCircle2 className="w-4 h-4 text-green-600" />
        ) : (
          <AlertCircle className="w-4 h-4 text-yellow-600" />
        )}
        <AlertDescription className="text-[var(--color-dark)]">
          {allRequiredPassed ? (
            <strong>Ready to publish!</strong>
          ) : (
            <strong>Please complete required fields before publishing</strong>
          )}
        </AlertDescription>
      </Alert>

      {/* Product Preview */}
      <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
        <CardHeader>
          <CardTitle className="text-lg text-[var(--color-dark)]">Product Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {/* Product Image */}
            <div className="w-32 h-32 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--color-creme)] border border-[var(--color-coyote)]">
              {formData.gallery_images[0] ? (
                <img 
                  src={formData.gallery_images[0]} 
                  alt={formData.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[var(--color-dark)]/40">
                  <ImageIcon className="w-12 h-12" />
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="flex-1 space-y-2">
              <div>
                <h3 className="text-xl font-serif font-bold text-[var(--color-dark)]">
                  {formData.name || 'Product Name'}
                </h3>
                <p className="text-sm text-[var(--color-dark)]/70">
                  {formData.brand || 'Brand'}
                </p>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[var(--color-dark)]">
                  {formatINR(formData.price)}
                </span>
                {discount && discount.discount_percentage && (
                  <>
                    <span className="text-lg text-[var(--color-dark)]/50 line-through">
                      {formatINR(formData.compare_at_price!)}
                    </span>
                    <Badge className="bg-[var(--color-canyon)]">
                      {discount.discount_percentage}% OFF
                    </Badge>
                  </>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Package className="w-4 h-4 text-[var(--color-dark)]/60" />
                  <span className="text-[var(--color-dark)]/70">
                    Stock: {formData.stock}
                  </span>
                </div>
                {formData.variants.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Tag className="w-4 h-4 text-[var(--color-dark)]/60" />
                    <span className="text-[var(--color-dark)]/70">
                      {formData.variants.length} variant{formData.variants.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>

              {formData.short_description && (
                <p className="text-sm text-[var(--color-dark)]/70 line-clamp-2">
                  {formData.short_description}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Checklist */}
      <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
        <CardHeader>
          <CardTitle className="text-lg text-[var(--color-dark)]">Validation Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Required */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-[var(--color-dark)]">Required Fields</h4>
              <Badge variant={allRequiredPassed ? 'default' : 'destructive'}>
                {requiredPassed}/{requiredTotal}
              </Badge>
            </div>
            <div className="space-y-2">
              {validationChecks.filter(c => c.required).map((check, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <span className={check.passed ? 'text-green-600' : 'text-red-600'}>
                    {check.passed ? '✅' : '❌'}
                  </span>
                  <span className={check.passed ? 'text-[var(--color-dark)]' : 'text-red-600'}>
                    {check.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Optional */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-[var(--color-dark)]">Optional Improvements</h4>
              <Badge variant="outline">
                {optionalPassed}/{optionalTotal}
              </Badge>
            </div>
            <div className="space-y-2">
              {validationChecks.filter(c => !c.required).map((check, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <span className={check.passed ? 'text-green-600' : 'text-[var(--color-dark)]/40'}>
                    {check.passed ? '✅' : '⚪'}
                  </span>
                  <span className="text-[var(--color-dark)]/70">
                    {check.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product Summary */}
      <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
        <CardHeader>
          <CardTitle className="text-lg text-[var(--color-dark)]">Product Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-[var(--color-dark)]/60">Product Name:</span>
              <p className="font-semibold text-[var(--color-dark)]">{formData.name || '-'}</p>
            </div>
            <div>
              <span className="text-[var(--color-dark)]/60">Brand:</span>
              <p className="font-semibold text-[var(--color-dark)]">{formData.brand || '-'}</p>
            </div>
            <div>
              <span className="text-[var(--color-dark)]/60">Price:</span>
              <p className="font-semibold text-[var(--color-dark)]">{formatINR(formData.price)}</p>
            </div>
            <div>
              <span className="text-[var(--color-dark)]/60">Stock:</span>
              <p className="font-semibold text-[var(--color-dark)]">{formData.stock}</p>
            </div>
            <div>
              <span className="text-[var(--color-dark)]/60">Images:</span>
              <p className="font-semibold text-[var(--color-dark)]">{formData.gallery_images.length}</p>
            </div>
            <div>
              <span className="text-[var(--color-dark)]/60">Variants:</span>
              <p className="font-semibold text-[var(--color-dark)]">{formData.variants.length}</p>
            </div>
            <div>
              <span className="text-[var(--color-dark)]/60">Origin:</span>
              <p className="font-semibold text-[var(--color-dark)]">{formData.origin || '-'}</p>
            </div>
            <div>
              <span className="text-[var(--color-dark)]/60">Pack Size:</span>
              <p className="font-semibold text-[var(--color-dark)]">{formData.pack_size || '-'}</p>
            </div>
          </div>

          {formData.description && (
            <div>
              <span className="text-sm text-[var(--color-dark)]/60">Description:</span>
              <p className="text-sm text-[var(--color-dark)]/80 mt-1 line-clamp-3">
                {formData.description}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Publishing Options */}
      <Card className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
        <CardHeader>
          <CardTitle className="text-lg text-[var(--color-dark)]">Publishing Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-[var(--color-creme)] rounded-lg">
            <div>
              <Label className="text-[var(--color-dark)] font-semibold">Product Status</Label>
              <p className="text-sm text-[var(--color-dark)]/70">
                {formData.is_active ? 'Active - Visible to customers' : 'Inactive - Hidden from store'}
              </p>
            </div>
            <Badge variant={formData.is_active ? 'default' : 'outline'}>
              {formData.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>

          <div className="flex items-center justify-between p-3 bg-[var(--color-creme)] rounded-lg">
            <div>
              <Label className="text-[var(--color-dark)] font-semibold">Featured Product</Label>
              <p className="text-sm text-[var(--color-dark)]/70">
                Show on homepage featured section
              </p>
            </div>
            <Badge variant={formData.is_featured ? 'default' : 'outline'}>
              {formData.is_featured ? 'Yes' : 'No'}
            </Badge>
          </div>

          <div className="flex items-center justify-between p-3 bg-[var(--color-creme)] rounded-lg">
            <div>
              <Label className="text-[var(--color-dark)] font-semibold">Showcase Product</Label>
              <p className="text-sm text-[var(--color-dark)]/70">
                Show in product showcase section
              </p>
            </div>
            <Badge variant={formData.is_showcase ? 'default' : 'outline'}>
              {formData.is_showcase ? 'Yes' : 'No'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {!allRequiredPassed && (
        <Alert className="bg-yellow-50 border-yellow-300">
          <AlertCircle className="w-4 h-4 text-yellow-600" />
          <AlertDescription className="text-[var(--color-dark)]">
            Please go back and complete all required fields before publishing.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
