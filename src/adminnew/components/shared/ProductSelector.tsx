import { useState, useEffect } from 'react';
import { Search, Plus, X, Package, Check, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { supabase } from '../../../lib/supabase/client';
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
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedProductIds.length > 0) {
      fetchSelectedProducts();
    } else {
      setSelectedProducts([]);
    }
  }, [selectedProductIds]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          slug,
          brand:brands!inner(name),
          product_variants(
            id,
            price,
            images,
            is_default
          )
        `)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      
      const mappedProducts: Product[] = (data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        brand: Array.isArray(item.brand) ? item.brand[0] : item.brand,
        product_variants: item.product_variants
      }));

      setProducts(mappedProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSelectedProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          slug,
          brand:brands!inner(name),
          product_variants(
            id,
            price,
            images,
            is_default
          )
        `)
        .in('id', selectedProductIds);

      if (error) throw error;

      const mappedSelectedProducts: Product[] = (data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        brand: Array.isArray(item.brand) ? item.brand[0] : item.brand,
        product_variants: item.product_variants
      }));

      // Maintain order based on selectedProductIds
      const orderedProducts = selectedProductIds
        .map(id => mappedSelectedProducts.find(p => p.id === id))
        .filter(Boolean) as Product[];

      setSelectedProducts(orderedProducts);
    } catch (error) {
      console.error('Error fetching selected products:', error);
    }
  };

  // Filter available products (exclude already selected)
  const availableProducts = products.filter(product => 
    !selectedProductIds.includes(product.id) &&
    (product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.brand?.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleAddProduct = (product: Product) => {
    if (maxProducts && selectedProductIds.length >= maxProducts) return;
    if (selectedProductIds.includes(product.id)) return;
    
    const newSelection = [...selectedProductIds, product.id];
    onSelectionChange(newSelection);
    setSelectedProducts([...selectedProducts, product]);
  };

  const handleRemoveProduct = (productId: string) => {
    const newSelection = selectedProductIds.filter(id => id !== productId);
    onSelectionChange(newSelection);
    setSelectedProducts(selectedProducts.filter(p => p.id !== productId));
  };

  const handleClearAll = () => {
    onSelectionChange([]);
    setSelectedProducts([]);
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
    <div className="border border-[var(--color-coyote)]/30 rounded-lg overflow-hidden bg-[var(--color-creme-light)]">
      {/* Header */}
      <div className="bg-[var(--color-creme)] px-4 py-2 border-b border-[var(--color-coyote)]/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="w-4 h-4 text-[var(--color-canyon)]" />
          <span className="font-medium text-sm text-[var(--color-dark)]">Product Selection</span>
          <Badge 
            variant="secondary"
            className={isAtLimit 
              ? "bg-amber-100 text-amber-800 text-xs" 
              : "bg-[var(--color-creme)] text-[var(--color-dark)]/60 text-xs"
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
            className="text-[var(--color-dark)]/50 hover:text-red-600 hover:bg-red-50 text-xs h-7"
          >
            Clear all
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[var(--color-coyote)]/20">
        {/* Left Panel: Available Products */}
        <div className="flex flex-col">
          <div className="p-2 border-b border-[var(--color-coyote)]/10 bg-[var(--color-creme-light)]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-dark)]/40" />
              <Input
                placeholder="Search available products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>
          </div>

          <div className="h-[240px] overflow-y-auto bg-[var(--color-creme-light)]">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-[var(--color-dark)]/40">
                <Loader2 className="w-5 h-5 animate-spin mb-2" />
                <span className="text-xs">Loading products...</span>
              </div>
            ) : availableProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[var(--color-dark)]/40 px-4">
                <Package className="w-8 h-8 mb-2 opacity-40" />
                <span className="text-xs text-center">
                  {searchTerm ? 'No products match your search' : 'All products have been selected'}
                </span>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-coyote)]/10">
                {availableProducts.map(product => (
                  <button
                    key={product.id}
                    onClick={() => handleAddProduct(product)}
                    disabled={isAtLimit}
                    className={`w-full flex items-center gap-2 p-2 text-left transition-colors ${
                      isAtLimit 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:bg-[var(--color-creme)] cursor-pointer'
                    }`}
                  >
                    <div className="w-8 h-8 rounded overflow-hidden bg-[var(--color-creme)] flex-shrink-0 border border-[var(--color-coyote)]/20">
                      {getProductImage(product) ? (
                        <ImageWithFallback
                          src={getProductImage(product)}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-3 h-3 text-[var(--color-dark)]/30" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs text-[var(--color-dark)] truncate">{product.name}</p>
                      <p className="text-xs text-[var(--color-dark)]/50 truncate">{product.brand?.name}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {getProductPrice(product) && (
                        <span className="text-xs font-medium text-[var(--color-canyon)]">
                          {formatINR(getProductPrice(product))}
                        </span>
                      )}
                      <div className="w-5 h-5 rounded-full bg-[var(--color-canyon)]/10 flex items-center justify-center">
                        <Plus className="w-3 h-3 text-[var(--color-canyon)]" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Selected Products */}
        <div className="flex flex-col bg-[var(--color-canyon)]/5">
          <div className="p-2 border-b border-[var(--color-coyote)]/10 bg-[var(--color-canyon)]/10">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[var(--color-canyon)]" />
              <span className="text-xs font-medium text-[var(--color-dark)]">Selected Products</span>
            </div>
          </div>

          <div className="h-[240px] overflow-y-auto">
            {selectedProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[var(--color-dark)]/40 px-4">
                <ArrowRight className="w-6 h-6 mb-2 opacity-30" />
                <span className="text-xs text-center">Click products on the left to add them here</span>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-coyote)]/10">
                {selectedProducts.map((product, index) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-2 p-2 bg-[var(--color-creme-light)] hover:bg-[var(--color-creme)] transition-colors group"
                  >
                    <span className="w-5 h-5 rounded-full bg-[var(--color-canyon)] text-white text-xs flex items-center justify-center font-medium flex-shrink-0">
                      {index + 1}
                    </span>

                    <div className="w-8 h-8 rounded overflow-hidden bg-[var(--color-creme)] flex-shrink-0 border-2 border-[var(--color-canyon)]/20">
                      {getProductImage(product) ? (
                        <ImageWithFallback
                          src={getProductImage(product)}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-3 h-3 text-[var(--color-dark)]/30" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs text-[var(--color-dark)] truncate">{product.name}</p>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-[var(--color-dark)]/50 truncate">{product.brand?.name}</span>
                        {getProductPrice(product) && (
                          <>
                            <span className="text-[var(--color-dark)]/30">•</span>
                            <span className="text-xs font-medium text-[var(--color-canyon)]">
                              {formatINR(getProductPrice(product))}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveProduct(product.id)}
                      className="w-5 h-5 rounded-full bg-[var(--color-creme)] hover:bg-red-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X className="w-3 h-3 text-[var(--color-dark)]/40 group-hover:text-red-600" />
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
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 text-center">
          <span className="text-xs text-amber-700 font-medium">
            Maximum of {maxProducts} products reached
          </span>
        </div>
      )}
    </div>
  );
}
