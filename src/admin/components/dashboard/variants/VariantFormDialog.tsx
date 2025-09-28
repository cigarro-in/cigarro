import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../../components/ui/dialog';
import { Label } from '../../../../components/ui/label';
import { Input } from '../../../../components/ui/input';
import { Button } from '../../../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { Checkbox } from '../../../../components/ui/checkbox';
import { MultipleImageUpload } from '../../../../components/ui/MultipleImageUpload';
import { Product, ProductVariant, VariantFormData } from '../types/index';

interface VariantFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingVariant: ProductVariant | null;
  variantForm: VariantFormData;
  onVariantFormChange: (form: VariantFormData) => void;
  products: Product[];
  onSave: () => void;
  loading?: boolean;
}

export function VariantFormDialog({
  open,
  onOpenChange,
  editingVariant,
  variantForm,
  onVariantFormChange,
  products,
  onSave,
  loading = false
}: VariantFormDialogProps) {
  const updateForm = (updates: Partial<VariantFormData>) => {
    onVariantFormChange({ ...variantForm, ...updates });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingVariant ? 'Edit Variant' : 'Add New Variant'}
          </DialogTitle>
          <DialogDescription>
            {editingVariant 
              ? 'Update the variant details below.' 
              : 'Create a new product variant with specific attributes like packaging, color, or size.'
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Product *</Label>
              <Select 
                value={variantForm.product_id} 
                onValueChange={(value: string) => updateForm({ product_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} - {product.brand || 'No Brand'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Variant Name *</Label>
              <Input
                value={variantForm.variant_name}
                onChange={(e) => updateForm({ variant_name: e.target.value })}
                placeholder="e.g., Packet, Carton, Half Carton"
              />
            </div>
          </div>

          <div>
            <Label>Variant Type *</Label>
            <Select 
              value={variantForm.variant_type} 
              onValueChange={(value: string) => updateForm({ variant_type: value as VariantFormData['variant_type'] })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="packaging">Packaging</SelectItem>
                <SelectItem value="color">Color</SelectItem>
                <SelectItem value="size">Size</SelectItem>
                <SelectItem value="material">Material</SelectItem>
                <SelectItem value="flavor">Flavor</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Price (₹) *</Label>
              <Input
                type="number"
                value={variantForm.price}
                onChange={(e) => updateForm({ price: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
            
            <div>
              <Label>Stock Quantity *</Label>
              <Input
                type="number"
                value={variantForm.stock}
                onChange={(e) => updateForm({ stock: parseInt(e.target.value) || 0 })}
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={variantForm.sort_order}
                onChange={(e) => updateForm({ sort_order: parseInt(e.target.value) || 0 })}
                placeholder="0"
                min="0"
              />
            </div>
            
            <div className="flex items-center space-x-2 pt-6">
              <Checkbox
                id="variant-active"
                checked={variantForm.is_active}
                onCheckedChange={(checked: boolean) => updateForm({ is_active: !!checked })}
              />
              <Label htmlFor="variant-active">Active</Label>
            </div>
          </div>

          <div>
            <Label>Variant Images</Label>
            <MultipleImageUpload
              imageUrls={variantForm.variant_images}
              onImageUrlsChange={(images: string[]) => updateForm({ variant_images: images })}
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-6 border-t">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            onClick={onSave}
            disabled={loading || !variantForm.product_id || !variantForm.variant_name}
          >
            {loading ? 'Saving...' : editingVariant ? 'Update Variant' : 'Create Variant'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
