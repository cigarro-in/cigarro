// Variant Selector Component
import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { ProductVariant } from '../../types/product';
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
  // Auto-select first variant if none selected
  useEffect(() => {
    if (!selectedVariant && variants.length > 0) {
      onVariantSelect(variants[0]);
    }
  }, [variants, selectedVariant, onVariantSelect]);

  return (
    <div className="flex flex-wrap justify-start gap-3">
      {variants.map((variant) => {
        const isSelected = selectedVariant?.id === variant.id;
        
        return (
          <button
            key={variant.id}
            onClick={() => onVariantSelect(variant)}
            className={`
              px-6 py-3 rounded-full text-sm font-medium transition-all duration-300
              ${isSelected
                ? 'bg-dark text-creme shadow-md'
                : 'bg-creme-light border border-coyote/30 text-dark hover:border-dark/40 hover:shadow-sm'
              }
            `}
          >
            {variant.variant_name}
          </button>
        );
      })}
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
  const originalPrice = combo.original_price || 0;
  const savings = originalPrice - combo.combo_price;
  const savingsPercentage = originalPrice > 0 ? Math.round((savings / originalPrice) * 100) : 0;

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
              {originalPrice > 0 && (
                <span className="text-lg text-muted-foreground line-through">
                  {formatINR(originalPrice)}
                </span>
              )}
            </div>
            
            {savings > 0 && (
              <Badge className="bg-green-100 text-green-800 text-sm">
                Save {formatINR(savings)} ({savingsPercentage}% off)
              </Badge>
            )}
          </div>
          
          {/* Included Items */}
          <div className="space-y-3">
            <h4 className="font-medium text-foreground">
              This combo includes:
            </h4>
            
            <div className="space-y-2">
              {(combo.combo_items || []).map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-accent rounded-full"></div>
                    <span className="text-foreground">
                      {item.variant?.variant_name ? `${item.variant.variant_name}` : 'Product'}
                    </span>
                    <span className="text-muted-foreground">
                      × {item.quantity}
                    </span>
                  </div>
                  
                  <span className="text-muted-foreground">
                    {formatINR((item.variant?.price || 0) * item.quantity)}
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
