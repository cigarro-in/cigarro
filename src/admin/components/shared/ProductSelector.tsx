import { useState, useEffect } from 'react';
import { Search, Plus, Trash2, ArrowUp, ArrowDown, Package } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../../components/ui/dialog';
import { supabase } from '../../../lib/supabase/client';
import { toast } from 'sonner';
import { ImageWithFallback } from '../../../components/ui/ImageWithFallback';

interface Product {
  id: string;
  name: string;
  slug: string;
  brand?: { name: string };
  is_active: boolean;
  product_variants?: Array<{
    id: string;
    price: number;
    is_default?: boolean;
    images?: string[];
  }>;
}

interface SelectedProduct extends Product {
  order: number;
}

interface ProductSelectorProps {
  selectedProducts: SelectedProduct[];
  onProductsChange: (products: SelectedProduct[]) => void;
  maxProducts?: number;
  title?: string;
  description?: string;
}

  // Helper function to get product price (from default variant if available)
  const getProductPrice = (product: Product): number => {
    if (product.product_variants?.length) {
      const defaultVariant = product.product_variants.find(v => v.is_default);
      if (defaultVariant) {
        return defaultVariant.price;
      }
      // Fallback to first variant
      if (product.product_variants[0]) {
        return product.product_variants[0].price;
      }
    }
    return 0;
  };

  // Helper function to get product image
  const getProductImage = (product: Product): string => {
    if (product.product_variants?.length) {
      const defaultVariant = product.product_variants.find(v => v.is_default);
      if (defaultVariant?.images?.length) {
        return defaultVariant.images[0];
      }
      if (product.product_variants[0]?.images?.length) {
        return product.product_variants[0].images[0];
      }
    }
    return '';
  };

export function ProductSelector({
  selectedProducts,
  onProductsChange,
  maxProducts = 10,
  title = "Selected Products",
  description = "Manage the products displayed in this section"
}: ProductSelectorProps) {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      // Fetch products with their variants
      const { data, error } = await supabase
        .from('products')
        .select('id, name, slug, is_active, brand:brands(name), product_variants(id, price, is_default, images)')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      
      // Normalize data to match Product interface
      const normalizedData = (data || []).map((item: any) => ({
        ...item,
        brand: Array.isArray(item.brand) ? item.brand[0] : item.brand
      }));

      setAllProducts(normalizedData);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProducts = allProducts.filter(product => {
    const brandName = product.brand?.name || '';
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         brandName.toLowerCase().includes(searchTerm.toLowerCase());
    const notSelected = !selectedProducts.some(selected => selected.id === product.id);
    return matchesSearch && notSelected;
  });

  const handleAddProduct = (product: Product) => {
    if (selectedProducts.length >= maxProducts) {
      toast.error(`Maximum ${maxProducts} products allowed`);
      return;
    }

    const newProduct: SelectedProduct = {
      ...product,
      order: selectedProducts.length + 1
    };

    onProductsChange([...selectedProducts, newProduct]);
    setShowSearchModal(false);
    setSearchTerm('');
    toast.success(`${product.name} added to selection`);
  };

  const handleRemoveProduct = (productId: string) => {
    const updatedProducts = selectedProducts
      .filter(p => p.id !== productId)
      .map((p, index) => ({ ...p, order: index + 1 }));
    
    onProductsChange(updatedProducts);
  };

  const handleReorderProduct = (productId: string, direction: 'up' | 'down') => {
    const currentIndex = selectedProducts.findIndex(p => p.id === productId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= selectedProducts.length) return;

    const reorderedProducts = [...selectedProducts];
    [reorderedProducts[currentIndex], reorderedProducts[newIndex]] = 
    [reorderedProducts[newIndex], reorderedProducts[currentIndex]];

    // Update order numbers
    const updatedProducts = reorderedProducts.map((p, index) => ({ ...p, order: index + 1 }));
    onProductsChange(updatedProducts);
  };

  return (
    <div className="space-y-6">
      {/* Selected Products Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {title} ({selectedProducts.length}/{maxProducts})
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            </div>
            <Dialog open={showSearchModal} onOpenChange={setShowSearchModal}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={selectedProducts.length >= maxProducts}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Products</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search products by name or brand..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Products Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                    {isLoading ? (
                      <div className="col-span-full text-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                        <p className="text-sm text-muted-foreground mt-2">Loading products...</p>
                      </div>
                    ) : filteredProducts.length === 0 ? (
                      <div className="col-span-full text-center py-8 text-muted-foreground">
                        {searchTerm ? 'No products found matching your search' : 'No products available to add'}
                      </div>
                    ) : (
                      filteredProducts.map(product => (
                        <div key={product.id} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                              <ImageWithFallback
                                src={getProductImage(product)}
                                alt={product.name}
                                className="w-full h-full object-cover"
                                width={48}
                                height={48}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium truncate">{product.name}</h3>
                              <p className="text-sm text-muted-foreground">{product.brand?.name}</p>
                              <p className="text-sm font-medium">₹{getProductPrice(product).toLocaleString()}</p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddProduct(product)}
                            className="w-full"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add to Selection
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {selectedProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No products selected yet</p>
              <p className="text-sm">Click "Add Product" to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedProducts
                .sort((a, b) => a.order - b.order)
                .map((product, index) => (
                <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-muted rounded overflow-hidden">
                      <ImageWithFallback
                        src={getProductImage(product)}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        width={48}
                        height={48}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          #{product.order}
                        </Badge>
                        <h3 className="font-medium">{product.name}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">{product.brand?.name}</p>
                      <p className="text-sm font-medium">₹{getProductPrice(product).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReorderProduct(product.id, 'up')}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReorderProduct(product.id, 'down')}
                      disabled={index === selectedProducts.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveProduct(product.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
