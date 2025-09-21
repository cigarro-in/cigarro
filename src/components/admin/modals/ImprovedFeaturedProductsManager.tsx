import { useState, useEffect } from 'react';
import { Package, Save, X, Settings } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Alert, AlertDescription } from '../../ui/alert';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Switch } from '../../ui/switch';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { GripVertical } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { ProductSelector } from '../shared/ProductSelector';
import { SingleImageUpload } from '../../ui/UnifiedImageUpload';
import { supabase } from '../../../utils/supabase/client';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  slug: string;
  brand: string;
  price: number;
  gallery_images?: string[];
  is_active: boolean;
}

interface SelectedProduct extends Product {
  order: number;
}

interface SectionConfig {
  title: string;
  subtitle: string;
  description: string;
  background_image: string;
  button_text: string;
  button_url: string;
  max_items: number;
  is_enabled: boolean;
}

interface FeaturedProductsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function ImprovedFeaturedProductsManager({ open, onOpenChange, onUpdate }: FeaturedProductsManagerProps) {
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [sectionConfig, setSectionConfig] = useState<SectionConfig>({
    title: 'Curated Selection of Premium Tobacco',
    subtitle: 'Featured Products',
    description: 'Discover our handpicked selection of premium tobacco products',
    background_image: '',
    button_text: 'View All Products',
    button_url: '/products',
    max_items: 3,
    is_enabled: true
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load section configuration
      const { data: configData, error: configError } = await supabase
        .from('section_configurations')
        .select('*')
        .eq('section_name', 'featured_products')
        .single();

      if (configError && configError.code !== 'PGRST116') {
        throw configError;
      }

      if (configData) {
        setSectionConfig({
          title: configData.title || 'Curated Selection of Premium Tobacco',
          subtitle: configData.subtitle || 'Featured Products',
          description: configData.description || 'Discover our handpicked selection of premium tobacco products',
          background_image: configData.background_image || '',
          button_text: configData.button_text || 'View All Products',
          button_url: configData.button_url || '/products',
          max_items: configData.max_items || 3,
          is_enabled: configData.is_enabled !== false
        });
      }

      // Load featured products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, slug, brand, price, gallery_images, is_active')
        .eq('is_featured', true)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (productsError) throw productsError;

      const featuredProducts: SelectedProduct[] = (productsData || []).map((product, index) => ({
        ...product,
        order: index + 1
      }));

      setSelectedProducts(featuredProducts);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load featured products data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSectionConfig = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('section_configurations')
        .upsert({
          section_name: 'featured_products',
          title: sectionConfig.title,
          subtitle: sectionConfig.subtitle,
          description: sectionConfig.description,
          background_image: sectionConfig.background_image,
          button_text: sectionConfig.button_text,
          button_url: sectionConfig.button_url,
          max_items: sectionConfig.max_items,
          is_enabled: sectionConfig.is_enabled,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'section_name'
        });

      if (error) throw error;

      toast.success('Section configuration saved successfully');
      onUpdate();
    } catch (error) {
      console.error('Error saving section config:', error);
      toast.error('Failed to save section configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleProductsChange = async (products: SelectedProduct[]) => {
    setSelectedProducts(products);

    try {
      // First, remove all existing featured flags and reset featured_order
      await supabase
        .from('products')
        .update({ is_featured: false, featured_order: 0 })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all

      // Then set featured flag and order for selected products
      if (products.length > 0) {
        const updates = products.map((product, index) => ({
          id: product.id,
          is_featured: true,
          featured_order: index + 1
        }));

        for (const update of updates) {
          const { error } = await supabase
            .from('products')
            .update({ is_featured: update.is_featured, featured_order: update.featured_order })
            .eq('id', update.id);

          if (error) throw error;
        }
      }

      toast.success('Featured products updated successfully');
      onUpdate();
    } catch (error) {
      console.error('Error updating featured products:', error);
      toast.error('Failed to update featured products');
    }
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const newProducts = Array.from(selectedProducts);
    const [reorderedItem] = newProducts.splice(result.source.index, 1);
    newProducts.splice(result.destination.index, 0, reorderedItem);

    // Update order numbers
    const updatedProducts = newProducts.map((product, index) => ({
      ...product,
      order: index + 1
    }));

    setSelectedProducts(updatedProducts);
    handleProductsChange(updatedProducts);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Featured Products Management
          </DialogTitle>
          <DialogDescription>
            Configure the featured products section on your homepage. Manage which products are highlighted and customize the section content and settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Alert>
            <Package className="h-4 w-4" />
            <AlertDescription>
              Manage the featured products section on your homepage. Configure the section content and select which products to highlight.
            </AlertDescription>
          </Alert>

          <Tabs defaultValue="products" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="products">Featured Products</TabsTrigger>
              <TabsTrigger value="settings">Section Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="space-y-4">
              <ProductSelector
                selectedProducts={selectedProducts}
                onProductsChange={handleProductsChange}
                maxProducts={sectionConfig.max_items}
                title="Featured Products"
                description="Select products to feature on the homepage. Drag and drop to reorder them."
              />

              {/* Drag and Drop Reorder Section */}
              {selectedProducts.length > 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Reorder Featured Products
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Drag the products below to change their display order on the homepage.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <DragDropContext onDragEnd={onDragEnd}>
                      <Droppable droppableId="featured-products">
                        {(provided) => (
                          <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className="space-y-3"
                          >
                            {selectedProducts
                              .sort((a, b) => a.order - b.order)
                              .map((product, index) => (
                                <Draggable key={product.id} draggableId={product.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      className={`flex items-center justify-between p-4 border rounded-lg bg-muted/20 ${
                                        snapshot.isDragging ? 'shadow-lg bg-background' : ''
                                      }`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <div className="w-12 h-12 bg-muted rounded overflow-hidden">
                                          <img
                                            src={product.gallery_images?.[0] || ''}
                                            alt={product.name}
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">#{product.order}</span>
                                            <h3 className="font-medium">{product.name}</h3>
                                          </div>
                                          <p className="text-sm text-muted-foreground">{product.brand}</p>
                                          <p className="text-sm font-medium">₹{product.price.toLocaleString()}</p>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Section Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="section_title">Section Title</Label>
                      <Input
                        id="section_title"
                        value={sectionConfig.title}
                        onChange={(e) => setSectionConfig(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Enter section title"
                      />
                    </div>
                    <div>
                      <Label htmlFor="section_subtitle">Section Subtitle</Label>
                      <Input
                        id="section_subtitle"
                        value={sectionConfig.subtitle}
                        onChange={(e) => setSectionConfig(prev => ({ ...prev, subtitle: e.target.value }))}
                        placeholder="Enter section subtitle"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="section_description">Section Description</Label>
                    <Textarea
                      id="section_description"
                      value={sectionConfig.description}
                      onChange={(e) => setSectionConfig(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Enter section description"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>Background Image (Optional)</Label>
                    <div className="mt-2">
                      <SingleImageUpload
                        imageUrl={sectionConfig.background_image || null}
                        onImageUrlChange={(url) => setSectionConfig(prev => ({ ...prev, background_image: url || '' }))}
                        showSelector={true}
                        title="Select Background Image"
                        description="Choose a background image for the featured products section"
                        aspectRatio="landscape"
                        size="lg"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Upload a background image for the featured products section (optional)
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="button_text">Button Text</Label>
                      <Input
                        id="button_text"
                        value={sectionConfig.button_text}
                        onChange={(e) => setSectionConfig(prev => ({ ...prev, button_text: e.target.value }))}
                        placeholder="e.g., View All Products"
                      />
                    </div>
                    <div>
                      <Label htmlFor="button_url">Button URL</Label>
                      <Input
                        id="button_url"
                        value={sectionConfig.button_url}
                        onChange={(e) => setSectionConfig(prev => ({ ...prev, button_url: e.target.value }))}
                        placeholder="e.g., /products"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="max_items">Maximum Products</Label>
                      <Input
                        id="max_items"
                        type="number"
                        min="1"
                        max="10"
                        value={sectionConfig.max_items}
                        onChange={(e) => setSectionConfig(prev => ({ ...prev, max_items: parseInt(e.target.value) || 3 }))}
                        placeholder="3"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Number of products to display (1-10)
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 pt-6">
                      <Switch
                        id="section_enabled"
                        checked={sectionConfig.is_enabled}
                        onCheckedChange={(checked: boolean) => setSectionConfig(prev => ({ ...prev, is_enabled: checked }))}
                      />
                      <Label htmlFor="section_enabled">Enable Section</Label>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t">
                    <Button 
                      onClick={handleSaveSectionConfig}
                      disabled={isSaving}
                      className="flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {isSaving ? 'Saving...' : 'Save Section Settings'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-between gap-2 pt-4 border-t">
            <Button 
              onClick={handleSaveSectionConfig}
              disabled={isSaving}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save All Changes'}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
