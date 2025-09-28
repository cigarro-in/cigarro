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
        return 'Type';
      case 'color':
        return 'Color';
      case 'size':
        return 'Size';
      case 'weight':
        return 'Weight';
      case 'strength':
        return 'Strength';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  const isVariantAvailable = (variant: ProductVariant): boolean => {
    return variant.stock ? variant.stock > 0 : (variant.stock_quantity ? variant.stock_quantity > 0 : true);
  };

  return (
    <div className="space-y-8">
      {Object.entries(variantsByType).map(([type, typeVariants]) => (
        <div key={type} className="space-y-4">
          <h3 className="text-sm uppercase tracking-widest text-dark/60 font-medium">
            {getVariantTypeLabel(type)}
          </h3>
          
          <div className="flex flex-wrap gap-3">
            {typeVariants.map((variant) => {
              const isSelected = selectedVariant?.id === variant.id;
              const isAvailable = isVariantAvailable(variant);
              
              return (
                <button
                  key={variant.id}
                  onClick={() => isAvailable && onVariantSelect(variant)}
                  disabled={!isAvailable}
                  className={`
                    px-6 py-3 rounded-full text-sm font-medium transition-all duration-300
                    ${isSelected
                      ? 'bg-dark text-creme shadow-md'
                      : isAvailable
                        ? 'bg-creme-light border border-coyote/30 text-dark hover:border-dark/40 hover:shadow-sm'
                        : 'bg-creme-light border border-coyote/20 text-dark/30 cursor-not-allowed line-through'
                    }
                  `}
                >
                  {variant.variant_name}
                  {!isAvailable && (
                    <span className="ml-2 text-xs">(Out of stock)</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
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
