import { useState, useMemo } from 'react';
import { Search, Plus, X, Package, Check, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { ORG_SLUG } from '../../../lib/convex/org';
import { ImageWithFallback } from '../../../components/ui/ImageWithFallback';
import { formatINR } from '../../../utils/currency';

interface Product {
  id: string;
  name: string;
  slug: string;
  brand: { name: string } | null;
  product_variants: Array<{
    id: string;
    price: number;
    images: string[];
    is_default?: boolean;
  }>;
}

interface ProductSelectorProps {
  selectedProductIds: string[];
  onSelectionChange: (productIds: string[]) => void;
  maxProducts?: number;
}

export function ProductSelector({ selectedProductIds, onSelectionChange, maxProducts }: ProductSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // One Convex query replaces both Supabase fetches; selection resolves
  // from the same rows (ids are supabaseIds end to end).
  const rows = useQuery(api.adminCatalog.listProductsForAdmin, { orgSlug: ORG_SLUG });
  const loading = rows === undefined;

  const products: Product[] = useMemo(
    () =>
      (rows || [])
        .filter((p: any) => p.isActive)
        .map((p: any) => ({
          id: p.supabaseId,
          name: p.name,
          slug: p.slug,
          brand: p.brand ? { name: p.brand.name } : null,
          product_variants: (p.product_variants || []).map((v: any) => ({
            id: v.supabaseId,
            price: v.priceRupees,
            images: v.images || [],
            is_default: v.isDefault,
          })),
        })),
    [rows]
  );

  // Maintain order based on selectedProductIds
  const selectedProducts = useMemo(
    () =>
      selectedProductIds
        .map((id) => products.find((p) => p.id === id))
        .filter(Boolean) as Product[],
    [products, selectedProductIds]
  );

  // Filter available products (exclude already selected)
  const availableProducts = products.filter(product => 
    !selectedProductIds.includes(product.id) &&
    (product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.brand?.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleAddProduct = (product: Product) => {
    if (maxProducts && selectedProductIds.length >= maxProducts) return;
    if (selectedProductIds.includes(product.id)) return;
    onSelectionChange([...selectedProductIds, product.id]);
  };

  const handleRemoveProduct = (productId: string) => {
    onSelectionChange(selectedProductIds.filter(id => id !== productId));
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  const getDefaultVariant = (product: Product) => {
    return product.product_variants?.find(v => v.is_default === true) || product.product_variants?.[0];
  };

  const getProductImage = (product: Product) => {
    const defaultVariant = getDefaultVariant(product);
    return defaultVariant?.images?.[0];
  };

  const getProductPrice = (product: Product) => {
    const defaultVariant = getDefaultVariant(product);
    return defaultVariant?.price;
  };

  const isAtLimit = maxProducts ? selectedProductIds.length >= maxProducts : false;

  return (
    <div className="border border-border/30 rounded-lg overflow-hidden bg-card">
      {/* Header */}
      <div className="bg-background px-4 py-2 border-b border-border/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm text-foreground">Product Selection</span>
          <Badge 
            variant="secondary"
            className={isAtLimit 
              ? "bg-warning/10 text-warning text-xs"
              : "bg-background text-muted-foreground text-xs"
            }
          >
            {selectedProductIds.length}{maxProducts ? ` / ${maxProducts}` : ''} selected
          </Badge>
        </div>
        {selectedProducts.length > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleClearAll}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs h-7"
          >
            Clear all
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border/20">
        {/* Left Panel: Available Products */}
        <div className="flex flex-col">
          <div className="p-2 border-b border-border/10 bg-card">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search available products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>
          </div>

          <div className="h-60 overflow-y-auto bg-card">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mb-2" />
                <span className="text-xs">Loading products...</span>
              </div>
            ) : availableProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-4">
                <Package className="w-8 h-8 mb-2 opacity-40" />
                <span className="text-xs text-center">
                  {searchTerm ? 'No products match your search' : 'All products have been selected'}
                </span>
              </div>
            ) : (
              <div className="divide-y divide-border/10">
                {availableProducts.map(product => (
                  <button
                    key={product.id}
                    onClick={() => handleAddProduct(product)}
                    disabled={isAtLimit}
                    className={`w-full flex items-center gap-2 p-2 text-left transition-colors ${
                      isAtLimit 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:bg-background cursor-pointer'
                    }`}
                  >
                    <div className="w-8 h-8 rounded overflow-hidden bg-background flex-shrink-0 border border-border/20">
                      {getProductImage(product) ? (
                        <ImageWithFallback
                          src={getProductImage(product)}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-3 h-3 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs text-foreground truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{product.brand?.name}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {getProductPrice(product) && (
                        <span className="text-xs font-medium text-primary">
                          {formatINR(getProductPrice(product))}
                        </span>
                      )}
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                        <Plus className="w-3 h-3 text-primary" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Selected Products */}
        <div className="flex flex-col bg-primary/5">
          <div className="p-2 border-b border-border/10 bg-primary/10">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-foreground">Selected Products</span>
            </div>
          </div>

          <div className="h-60 overflow-y-auto">
            {selectedProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-4">
                <ArrowRight className="w-6 h-6 mb-2 opacity-30" />
                <span className="text-xs text-center">Click products on the left to add them here</span>
              </div>
            ) : (
              <div className="divide-y divide-border/10">
                {selectedProducts.map((product, index) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-2 p-2 bg-card hover:bg-background transition-colors group"
                  >
                    <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium flex-shrink-0">
                      {index + 1}
                    </span>

                    <div className="w-8 h-8 rounded overflow-hidden bg-background flex-shrink-0 border-2 border-primary/20">
                      {getProductImage(product) ? (
                        <ImageWithFallback
                          src={getProductImage(product)}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-3 h-3 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs text-foreground truncate">{product.name}</p>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground truncate">{product.brand?.name}</span>
                        {getProductPrice(product) && (
                          <>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-xs font-medium text-primary">
                              {formatINR(getProductPrice(product))}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      aria-label={`Remove ${product.name}`}
                      onClick={() => handleRemoveProduct(product.id)}
                      className="size-9 rounded-md bg-background hover:bg-destructive/10 flex items-center justify-center"
                    >
                      <X className="w-3 h-3 text-muted-foreground group-hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer with limit warning */}
      {isAtLimit && (
        <div className="px-4 py-2 bg-warning/10 border-t border-warning text-center">
          <span className="text-xs text-warning font-medium">
            Maximum of {maxProducts} products reached
          </span>
        </div>
      )}
    </div>
  );
}
