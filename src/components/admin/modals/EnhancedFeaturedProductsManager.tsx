import { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Eye, 
  EyeOff,
  Save,
  X,
  Package,
  Star,
  Search,
  Filter,
  Grid3X3,
  List,
  TrendingUp
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Switch } from '../../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Badge } from '../../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Checkbox } from '../../ui/checkbox';
import { ImageWithFallback } from '../../figma/ImageWithFallback';
import { supabase } from '../../../utils/supabase/client';
import { formatINR } from '../../../utils/currency';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  gallery_images: string[];
  is_active: boolean;
  rating: number;
  review_count: number;
  stock: number;
}

interface FeaturedProduct {
  id: string;
  product_id: string;
  section_title?: string;
  section_subtitle?: string;
  display_order: number;
  is_active: boolean;
  featured_type: 'trending' | 'bestseller' | 'new' | 'recommended';
  product?: Product;
}

interface FeaturedProductsConfig {
  section_title: string;
  section_subtitle: string;
  max_products: number;
  layout_style: 'grid' | 'carousel' | 'list';
  show_ratings: boolean;
  show_prices: boolean;
  show_badges: boolean;
}

interface EnhancedFeaturedProductsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function EnhancedFeaturedProductsManager({ open, onOpenChange, onUpdate }: EnhancedFeaturedProductsManagerProps) {
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [config, setConfig] = useState<FeaturedProductsConfig>({
    section_title: 'Featured Products',
    section_subtitle: 'Discover our handpicked selection',
    max_products: 8,
    layout_style: 'grid',
    show_ratings: true,
    show_prices: true,
    show_badges: true
  });
  const [loading, setLoading] = useState(false);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      fetchFeaturedProducts();
      fetchAvailableProducts();
      fetchConfig();
    }
  }, [open]);

  const fetchFeaturedProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('featured_products')
        .select(`
          *,
          product:products(*)
        `)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setFeaturedProducts(data || []);
    } catch (error) {
      console.error('Error fetching featured products:', error);
      toast.error('Failed to fetch featured products');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setAvailableProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('homepage_sections')
        .select('config')
        .eq('component_name', 'FeaturedProducts')
        .single();

      if (error) throw error;
      if (data?.config) {
        setConfig({ ...config, ...data.config });
      }
    } catch (error) {
      console.error('Error fetching config:', error);
    }
  };

  const saveConfig = async () => {
    try {
      const { error } = await supabase
        .from('homepage_sections')
        .upsert({
          component_name: 'FeaturedProducts',
          config: config,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      toast.success('Configuration saved successfully');
      onUpdate();
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save configuration');
    }
  };

  const addFeaturedProducts = async () => {
    if (selectedProducts.length === 0) {
      toast.error('Please select at least one product');
      return;
    }

    try {
      setLoading(true);
      const newFeaturedProducts = selectedProducts.map((productId, index) => ({
        product_id: productId,
        display_order: featuredProducts.length + index + 1,
        is_active: true,
        featured_type: 'recommended' as const
      }));

      const { error } = await supabase
        .from('featured_products')
        .insert(newFeaturedProducts);

      if (error) throw error;
      
      toast.success(`${selectedProducts.length} products added to featured list`);
      setSelectedProducts([]);
      setShowProductSelector(false);
      fetchFeaturedProducts();
      onUpdate();
    } catch (error) {
      console.error('Error adding featured products:', error);
      toast.error('Failed to add featured products');
    } finally {
      setLoading(false);
    }
  };

  const removeFeaturedProduct = async (id: string) => {
    try {
      const { error } = await supabase
        .from('featured_products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Product removed from featured list');
      fetchFeaturedProducts();
      onUpdate();
    } catch (error) {
      console.error('Error removing featured product:', error);
      toast.error('Failed to remove featured product');
    }
  };

  const updateFeaturedType = async (id: string, type: string) => {
    try {
      const { error } = await supabase
        .from('featured_products')
        .update({ featured_type: type })
        .eq('id', id);

      if (error) throw error;
      fetchFeaturedProducts();
    } catch (error) {
      console.error('Error updating featured type:', error);
      toast.error('Failed to update product type');
    }
  };

  const toggleProductStatus = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('featured_products')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;
      fetchFeaturedProducts();
    } catch (error) {
      console.error('Error toggling product status:', error);
      toast.error('Failed to update product status');
    }
  };

  const filteredProducts = availableProducts.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const featuredProductIds = featuredProducts.map(fp => fp.product_id);
  const availableForSelection = filteredProducts.filter(p => !featuredProductIds.includes(p.id));

  const getFeaturedTypeBadge = (type: string) => {
    const badges = {
      trending: { label: 'Trending', variant: 'default' as const, icon: TrendingUp },
      bestseller: { label: 'Bestseller', variant: 'secondary' as const, icon: Star },
      new: { label: 'New', variant: 'outline' as const, icon: Package },
      recommended: { label: 'Recommended', variant: 'outline' as const, icon: Eye }
    };
    return badges[type as keyof typeof badges] || badges.recommended;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto bg-creme border-coyote">
          <DialogHeader className="border-b border-coyote pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-semibold text-dark">Featured Products Manager</DialogTitle>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => setShowProductSelector(true)}
                  className="bg-canyon hover:bg-canyon/90 text-creme"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Products
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="py-6">
            <Tabs defaultValue="products" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-coyote/20">
                <TabsTrigger value="products" className="data-[state=active]:bg-canyon data-[state=active]:text-creme">
                  <Package className="h-4 w-4 mr-2" />
                  Featured Products ({featuredProducts.length})
                </TabsTrigger>
                <TabsTrigger value="settings" className="data-[state=active]:bg-canyon data-[state=active]:text-creme">
                  <Grid3X3 className="h-4 w-4 mr-2" />
                  Section Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="products" className="mt-6">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-canyon mx-auto"></div>
                    <p className="text-dark/60 mt-4">Loading featured products...</p>
                  </div>
                ) : featuredProducts.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="mx-auto w-16 h-16 bg-coyote/20 rounded-full flex items-center justify-center mb-4">
                      <Package className="h-8 w-8 text-coyote" />
                    </div>
                    <h3 className="text-lg font-medium text-dark mb-2">No Featured Products</h3>
                    <p className="text-dark/60 mb-4">Add products to showcase on your homepage</p>
                    <Button
                      onClick={() => setShowProductSelector(true)}
                      className="bg-canyon hover:bg-canyon/90 text-creme"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Product
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {featuredProducts.map((featured, index) => {
                      const product = featured.product;
                      if (!product) return null;

                      const badgeInfo = getFeaturedTypeBadge(featured.featured_type);
                      const BadgeIcon = badgeInfo.icon;

                      return (
                        <Card key={featured.id} className="bg-creme-light border-coyote">
                          <CardContent className="p-4">
                            <div className="flex items-center space-x-4">
                              {/* Product Image */}
                              <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-coyote/10">
                                <ImageWithFallback
                                  src={product.gallery_images?.[0] || ''}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>

                              {/* Product Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h4 className="font-semibold text-dark truncate">{product.name}</h4>
                                    <p className="text-sm text-dark/70">{product.brand}</p>
                                    <p className="text-sm font-medium text-canyon">{formatINR(product.price)}</p>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Badge variant={badgeInfo.variant} className="flex items-center space-x-1">
                                      <BadgeIcon className="h-3 w-3" />
                                      <span>{badgeInfo.label}</span>
                                    </Badge>
                                    <Badge variant={featured.is_active ? 'default' : 'secondary'}>
                                      {featured.is_active ? 'Active' : 'Inactive'}
                                    </Badge>
                                    <Badge variant="outline">#{index + 1}</Badge>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between mt-3">
                                  <div className="flex items-center space-x-2">
                                    <Select
                                      value={featured.featured_type}
                                      onValueChange={(value: string) => updateFeaturedType(featured.id, value)}
                                    >
                                      <SelectTrigger className="w-32 h-8 bg-creme border-coyote text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="bg-creme border-coyote">
                                        <SelectItem value="trending">Trending</SelectItem>
                                        <SelectItem value="bestseller">Bestseller</SelectItem>
                                        <SelectItem value="new">New</SelectItem>
                                        <SelectItem value="recommended">Recommended</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="flex items-center space-x-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => toggleProductStatus(featured.id, featured.is_active)}
                                      className="text-dark hover:bg-coyote/20"
                                    >
                                      {featured.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeFeaturedProduct(featured.id)}
                                      className="text-red-600 hover:bg-red-50"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="settings" className="mt-6">
                <Card className="bg-creme-light border-coyote">
                  <CardHeader>
                    <CardTitle className="text-dark">Section Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <Label className="text-dark font-medium">Section Title</Label>
                        <Input
                          value={config.section_title}
                          onChange={(e) => setConfig(prev => ({ ...prev, section_title: e.target.value }))}
                          className="bg-creme border-coyote text-dark mt-2"
                        />
                      </div>
                      <div>
                        <Label className="text-dark font-medium">Section Subtitle</Label>
                        <Input
                          value={config.section_subtitle}
                          onChange={(e) => setConfig(prev => ({ ...prev, section_subtitle: e.target.value }))}
                          className="bg-creme border-coyote text-dark mt-2"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <Label className="text-dark font-medium">Maximum Products</Label>
                        <Select
                          value={config.max_products.toString()}
                          onValueChange={(value: string) => setConfig(prev => ({ ...prev, max_products: parseInt(value) }))}
                        >
                          <SelectTrigger className="bg-creme border-coyote text-dark mt-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-creme border-coyote">
                            <SelectItem value="4">4 Products</SelectItem>
                            <SelectItem value="6">6 Products</SelectItem>
                            <SelectItem value="8">8 Products</SelectItem>
                            <SelectItem value="12">12 Products</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-dark font-medium">Layout Style</Label>
                        <Select
                          value={config.layout_style}
                          onValueChange={(value: string) => setConfig(prev => ({ ...prev, layout_style: value as 'grid' | 'carousel' | 'list' }))}
                        >
                          <SelectTrigger className="bg-creme border-coyote text-dark mt-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-creme border-coyote">
                            <SelectItem value="grid">Grid Layout</SelectItem>
                            <SelectItem value="carousel">Carousel</SelectItem>
                            <SelectItem value="list">List View</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label className="text-dark font-medium mb-4 block">Display Options</Label>
                      <div className="grid grid-cols-3 gap-6">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="show-ratings"
                            checked={config.show_ratings}
                            onCheckedChange={(checked: boolean) => setConfig(prev => ({ ...prev, show_ratings: !!checked }))}
                          />
                          <Label htmlFor="show-ratings" className="text-dark">Show Ratings</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="show-prices"
                            checked={config.show_prices}
                            onCheckedChange={(checked: boolean) => setConfig(prev => ({ ...prev, show_prices: !!checked }))}
                          />
                          <Label htmlFor="show-prices" className="text-dark">Show Prices</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="show-badges"
                            checked={config.show_badges}
                            onCheckedChange={(checked: boolean) => setConfig(prev => ({ ...prev, show_badges: !!checked }))}
                          />
                          <Label htmlFor="show-badges" className="text-dark">Show Badges</Label>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-coyote">
                      <Button
                        onClick={saveConfig}
                        className="bg-canyon hover:bg-canyon/90 text-creme"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Configuration
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Selector Modal */}
      <Dialog open={showProductSelector} onOpenChange={setShowProductSelector}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-creme border-coyote">
          <DialogHeader className="border-b border-coyote pb-4">
            <DialogTitle className="text-dark">Add Products to Featured List</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <div className="flex items-center space-x-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark/40 h-4 w-4" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-creme border-coyote text-dark"
                />
              </div>
              <Badge variant="outline">{selectedProducts.length} selected</Badge>
            </div>

            <div className="grid gap-3 max-h-96 overflow-y-auto">
              {availableForSelection.map((product) => (
                <Card key={product.id} className="bg-creme-light border-coyote">
                  <CardContent className="p-3">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={(checked: boolean) => {
                          if (checked) {
                            setSelectedProducts(prev => [...prev, product.id]);
                          } else {
                            setSelectedProducts(prev => prev.filter(id => id !== product.id));
                          }
                        }}
                      />
                      <div className="w-12 h-12 rounded overflow-hidden bg-coyote/10 flex-shrink-0">
                        <ImageWithFallback
                          src={product.gallery_images?.[0] || ''}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-dark truncate">{product.name}</h4>
                        <p className="text-sm text-dark/70">{product.brand}</p>
                        <p className="text-sm font-medium text-canyon">{formatINR(product.price)}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{product.stock} in stock</Badge>
                        {product.rating > 0 && (
                          <Badge variant="secondary" className="flex items-center space-x-1">
                            <Star className="h-3 w-3" />
                            <span>{product.rating.toFixed(1)}</span>
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-coyote">
            <Button
              variant="outline"
              onClick={() => setShowProductSelector(false)}
              className="border-coyote text-dark hover:bg-coyote/20"
            >
              Cancel
            </Button>
            <Button
              onClick={addFeaturedProducts}
              disabled={selectedProducts.length === 0 || loading}
              className="bg-canyon hover:bg-canyon/90 text-creme"
            >
              Add {selectedProducts.length} Product{selectedProducts.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
