// Variant Selector Component
import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { ProductVariant } from '../../types/variants';
import { formatINR } from '../../utils/currency';

interface VariantSelectorProps {
  variants: ProductVariant[];
  selectedVariant: ProductVariant | null;
  onVariantSelect: (variant: ProductVariant) => void;
  basePrice: number;
  productName: string;
}

export const VariantSelector: React.FC<VariantSelectorProps> = ({
  variants,
  selectedVariant,
  onVariantSelect,
  basePrice,
  productName
}) => {
  const [hoveredVariant, setHoveredVariant] = useState<ProductVariant | null>(null);

  // Group variants by type
  const variantsByType = variants.reduce((acc, variant) => {
    if (!acc[variant.variant_type]) {
      acc[variant.variant_type] = [];
    }
    acc[variant.variant_type].push(variant);
    return acc;
  }, {} as Record<string, ProductVariant[]>);

  // Auto-select first variant if none selected
  useEffect(() => {
    if (!selectedVariant && variants.length > 0) {
      onVariantSelect(variants[0]);
    }
  }, [variants, selectedVariant, onVariantSelect]);

  const getVariantTypeLabel = (type: string): string => {
    switch (type) {
      case 'packaging':
        return 'Packaging';
      case 'color':
        return 'Color';
      case 'size':
        return 'Size';
      default:
        return 'Options';
    }
  };

  const getVariantDisplayPrice = (variant: ProductVariant): string => {
    if (variant.price === basePrice) {
      return formatINR(variant.price);
    }
    
    const difference = variant.price - basePrice;
    const sign = difference > 0 ? '+' : '';
    return `${formatINR(variant.price)} (${sign}${formatINR(Math.abs(difference))})`;
  };

  const getVariantSavings = (variant: ProductVariant): string | null => {
    if (variant.price < basePrice) {
      const savings = basePrice - variant.price;
      return `Save ${formatINR(savings)}`;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {Object.entries(variantsByType).map(([type, typeVariants]) => (
        <div key={type} className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">
            {getVariantTypeLabel(type)}
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {typeVariants.map((variant) => {
              const isSelected = selectedVariant?.id === variant.id;
              const isHovered = hoveredVariant?.id === variant.id;
              const savings = getVariantSavings(variant);
              
              return (
                <Card
                  key={variant.id}
                  className={`cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'ring-2 ring-accent bg-accent/5'
                      : 'hover:ring-1 hover:ring-accent/50 hover:bg-accent/5'
                  }`}
                  onClick={() => onVariantSelect(variant)}
                  onMouseEnter={() => setHoveredVariant(variant)}
                  onMouseLeave={() => setHoveredVariant(null)}
                >
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      {/* Variant Name */}
                      <div className="flex items-center justify-between">
                        <h5 className="font-medium text-foreground">
                          {variant.variant_name}
                        </h5>
                        {savings && (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                            {savings}
                          </Badge>
                        )}
                      </div>
                      
                      {/* Price */}
                      <div className="text-lg font-semibold text-accent">
                        {getVariantDisplayPrice(variant)}
                      </div>
                      
                      {/* SKU */}
                      {variant.sku && (
                        <div className="text-xs text-muted-foreground font-mono">
                          SKU: {variant.sku}
                        </div>
                      )}
                      
                      {/* Weight */}
                      {variant.weight && (
                        <div className="text-xs text-muted-foreground">
                          Weight: {variant.weight}g
                        </div>
                      )}
                      
                      {/* Selection Indicator */}
                      {isSelected && (
                        <div className="flex items-center gap-1 text-xs text-accent">
                          <div className="w-2 h-2 bg-accent rounded-full"></div>
                          Selected
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
      
      {/* Variant Details */}
      {selectedVariant && (
        <div className="mt-6 p-4 bg-muted/20 rounded-lg border border-border/20">
          <h4 className="font-medium text-foreground mb-2">
            Selected: {selectedVariant.variant_name}
          </h4>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Price:</span>
              <span className="ml-2 font-semibold text-accent">
                {formatINR(selectedVariant.price)}
              </span>
            </div>
            
            {selectedVariant.weight && (
              <div>
                <span className="text-muted-foreground">Weight:</span>
                <span className="ml-2">{selectedVariant.weight}g</span>
              </div>
            )}
            
            {selectedVariant.sku && (
              <div>
                <span className="text-muted-foreground">SKU:</span>
                <span className="ml-2 font-mono text-xs">{selectedVariant.sku}</span>
              </div>
            )}
            
            {selectedVariant.dimensions && (
              <div>
                <span className="text-muted-foreground">Dimensions:</span>
                <span className="ml-2">
                  {selectedVariant.dimensions.length} × {selectedVariant.dimensions.width} × {selectedVariant.dimensions.height} cm
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Combo Display Component
import { ProductCombo } from '../../types/variants';

interface ComboDisplayProps {
  combo: ProductCombo;
  onAddToCart: () => void;
}

export const ComboDisplayComponent: React.FC<ComboDisplayProps> = ({
  combo,
  onAddToCart
}) => {
  const savings = combo.original_price - combo.combo_price;
  const savingsPercentage = Math.round((savings / combo.original_price) * 100);

  return (
    <Card className="border-2 border-accent/20 bg-gradient-to-br from-accent/5 to-accent/10">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Combo Header */}
          <div className="text-center">
            <h3 className="text-xl font-serif text-foreground mb-2">
              {combo.name}
            </h3>
            <p className="text-muted-foreground text-sm">
              {combo.description}
            </p>
          </div>
          
          {/* Pricing */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl font-bold text-accent">
                {formatINR(combo.combo_price)}
              </span>
              <span className="text-lg text-muted-foreground line-through">
                {formatINR(combo.original_price)}
              </span>
            </div>
            
            <Badge className="bg-green-100 text-green-800 text-sm">
              Save {formatINR(savings)} ({savingsPercentage}% off)
            </Badge>
          </div>
          
          {/* Included Items */}
          <div className="space-y-3">
            <h4 className="font-medium text-foreground">
              This combo includes:
            </h4>
            
            <div className="space-y-2">
              {combo.items.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-accent rounded-full"></div>
                    <span className="text-foreground">
                      {item.product?.name || 'Product'}
                      {item.variant?.variant_name && ` (${item.variant.variant_name})`}
                    </span>
                    <span className="text-muted-foreground">
                      × {item.quantity}
                    </span>
                  </div>
                  
                  <span className="text-muted-foreground">
                    {formatINR((item.variant?.price || item.product?.price || 0) * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Add to Cart Button */}
          <Button 
            onClick={onAddToCart}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            size="lg"
          >
            Add Combo to Cart - {formatINR(combo.combo_price)}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
