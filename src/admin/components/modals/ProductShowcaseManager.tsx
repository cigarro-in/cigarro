import { useState, useEffect } from 'react';
import {
  Package,
  Save,
  X,
  Search,
  CheckCircle,
  Monitor,
  Loader2
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Badge } from '../../../components/ui/badge';
import { Switch } from '../../../components/ui/switch';
import { ImageUpload } from '../../../components/ui/ImageUpload';
import { supabase } from '../../../lib/supabase/client';
import { toast } from 'sonner';

interface ProductShowcaseManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

interface ProductVariantLite {
  id: string;
  price: number;
  is_default?: boolean;
}

interface Product {
  id: string;
  name: string;
  price?: number; // legacy
  is_active: boolean;
  product_variants?: ProductVariantLite[];
}

export function ProductShowcaseManager({ open, onOpenChange, onUpdate }: ProductShowcaseManagerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Collection State
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [sectionConfig, setSectionConfig] = useState({
    title: 'Discover Our Most Celebrated Collections',
    background_image: '' as string | null,
    is_enabled: true
  });
  
  // Products State
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [collectionProducts, setCollectionProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Load Showcase Collection
      const { data: collectionData, error: collectionError } = await supabase
        .from('collections')
        .select('id, title, image_url')
        .eq('slug', 'product-showcase')
        .single();

      if (collectionError && collectionError.code !== 'PGRST116') throw collectionError;

      // If collection doesn't exist, we'll create it on save or handle it gracefully
      if (collectionData) {
        setCollectionId(collectionData.id);
        setSectionConfig(prev => ({
          ...prev,
          title: collectionData.title,
          background_image: collectionData.image_url
        }));

        // 2. Load Products in this Collection
        const { data: productLinks, error: linksError } = await supabase
          .from('collection_products')
          .select('product_id, sort_order, products(id, name, is_active, product_variants(id, price, is_default, images))')
          .eq('collection_id', collectionData.id)
          .order('sort_order');

        if (linksError) throw linksError;

        const linkedProducts = (productLinks?.map(link => link.products) || [])
          .filter((p: any) => !!p && !Array.isArray(p))
          .map((p: any) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            is_active: p.is_active,
            product_variants: p.product_variants
          }));
        
        setCollectionProducts(linkedProducts);
      }

      // 3. Load All Products for Selection
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, is_active, product_variants(id, price, is_default, images)')
        .order('name');

      if (productsError) throw productsError;
      setAllProducts(productsData || []);

      // 4. Load Section Config (Legacy/Overlay settings if needed)
      const { data: configData } = await supabase
        .from('section_configurations')
        .select('is_enabled')
        .eq('section_name', 'product_showcase')
        .single();
      
      if (configData) {
        setSectionConfig(prev => ({ ...prev, is_enabled: configData.is_enabled }));
      }

    } catch (error) {
      console.error('Error loading showcase data:', error);
      toast.error('Failed to load showcase data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let targetCollectionId = collectionId;

      // 1. Create/Update Collection Record
      const collectionPayload = {
        title: sectionConfig.title,
        slug: 'product-showcase', // Fixed slug for homepage usage
        description: 'Homepage Product Showcase Section',
        image_url: sectionConfig.background_image,
        type: 'manual',
        is_active: true,
        updated_at: new Date().toISOString()
      };

      if (targetCollectionId) {
        const { error } = await supabase
          .from('collections')
          .update(collectionPayload)
          .eq('id', targetCollectionId);
        if (error) throw error;
      } else {
        const { data: newCol, error } = await supabase
          .from('collections')
          .insert([{ ...collectionPayload, created_at: new Date().toISOString() }])
          .select()
          .single();
        if (error) throw error;
        targetCollectionId = newCol.id;
        setCollectionId(newCol.id);
      }

      // 2. Update Section Config (Enabled/Disabled state)
      const { error: configError } = await supabase
        .from('section_configurations')
        .upsert({
            section_name: 'product_showcase',
            is_enabled: sectionConfig.is_enabled,
            title: sectionConfig.title, // Sync title
            background_image: sectionConfig.background_image // Sync image
        }, { onConflict: 'section_name' });

      if (configError) throw configError;

      // 3. Update Product Links
      // First, remove all existing links for this collection
      await supabase.from('collection_products').delete().eq('collection_id', targetCollectionId);

      // Then insert new links
      if (collectionProducts.length > 0) {
        const links = collectionProducts.map((p, index) => ({
          collection_id: targetCollectionId,
          product_id: p.id,
          sort_order: index + 1,
          created_at: new Date().toISOString()
        }));
        
        const { error: linksError } = await supabase.from('collection_products').insert(links);
        if (linksError) throw linksError;
      }

      toast.success('Showcase updated successfully');
      onUpdate();
      onOpenChange(false);

    } catch (error) {
      console.error('Error saving showcase:', error);
      toast.error('Failed to save showcase');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleProductSelection = (product: Product) => {
    if (collectionProducts.find(p => p.id === product.id)) {
      setCollectionProducts(prev => prev.filter(p => p.id !== product.id));
    } else {
      setCollectionProducts(prev => [...prev, product]);
    }
  };

  const getProductPrice = (product: Product): number => {
    if (product.product_variants && product.product_variants.length > 0) {
      const def = product.product_variants.find(v => v.is_default) || product.product_variants[0];
      return def.price;
    }
    return product.price || 0;
  };

  const filteredAllProducts = allProducts.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Product Showcase Management
          </DialogTitle>
          <DialogDescription>
            Configure the "Celebrated Collections" section on the homepage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Section Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="enabled">Enable Section</Label>
                <Switch
                  id="enabled"
                  checked={sectionConfig.is_enabled}
                  onCheckedChange={(checked) => setSectionConfig(prev => ({ ...prev, is_enabled: checked }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Section Title</Label>
                <Input
                  value={sectionConfig.title}
                  onChange={(e) => setSectionConfig(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Discover Our Most Celebrated Collections"
                />
              </div>

              <div className="space-y-2">
                <Label>Featured Image (Left Column)</Label>
                <ImageUpload
                    imageUrl={sectionConfig.background_image}
                    onImageUrlChange={(url) => setSectionConfig(prev => ({ ...prev, background_image: url }))}
                    showSelector={true}
                    title="Showcase Image"
                />
              </div>
            </CardContent>
          </Card>

          {/* Products */}
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>Selected Products ({collectionProducts.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {collectionProducts.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground border-2 border-dashed rounded-lg">
                  No products selected. Choose products below.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {collectionProducts.map((p, idx) => (
                    <div key={p.id} className="flex items-center justify-between p-2 border rounded bg-muted/20">
                      <span className="truncate font-medium text-sm">{idx + 1}. {p.name}</span>
                      <Button size="sm" variant="ghost" onClick={() => toggleProductSelection(p)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Product Selector */}
          <Card>
            <CardHeader>
              <CardTitle>Add Products</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products to add..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
                
                <div className="max-h-[300px] overflow-y-auto space-y-2 border rounded-md p-2">
                  {isLoading ? (
                    <div className="flex justify-center py-4"><Loader2 className="animate-spin" /></div>
                  ) : filteredAllProducts.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">No products found</div>
                  ) : (
                    filteredAllProducts.map(product => {
                      const isSelected = collectionProducts.some(p => p.id === product.id);
                      return (
                        <div key={product.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded cursor-pointer" onClick={() => !isSelected && toggleProductSelection(product)}>
                            <div className="flex items-center gap-2 overflow-hidden">
                                <div className="h-8 w-8 bg-muted rounded overflow-hidden flex-shrink-0">
                                    {(product as any).product_variants?.[0]?.images?.[0] && <img src={(product as any).product_variants[0].images[0]} className="h-full w-full object-cover" />}
                                </div>
                                <div className="truncate text-sm">
                                    <div className="font-medium truncate">{product.name}</div>
                                    <div className="text-xs text-muted-foreground">₹{getProductPrice(product)}</div>
                                </div>
                            </div>
                            <Button size="sm" variant={isSelected ? "secondary" : "outline"} disabled={isSelected}>
                                {isSelected ? <CheckCircle className="h-4 w-4 text-green-600" /> : "Add"}
                            </Button>
                        </div>
                      );
                    })
                  )}
                </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
