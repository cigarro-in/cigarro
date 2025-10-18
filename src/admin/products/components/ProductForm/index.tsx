// ============================================================================
// PRODUCT FORM - Shopify-style with Cigarro Theme
// Premium product management with tabs, variants, and discount pricing
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Save, X, Loader2, Package, Trash2 } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../../components/ui/dialog';
import { Alert, AlertDescription } from '../../../../components/ui/alert';
import { Badge } from '../../../../components/ui/badge';
import { Separator } from '../../../../components/ui/separator';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Switch } from '../../../../components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '../../../../utils/supabase/client';
import { Product, ProductFormData, VariantFormData, generateSlug, calculateDiscount } from '../../../../types/product';

// Tab Components
import { QuickSetupTab } from './QuickSetupTab';
import { BasicInfoTab } from './BasicInfoTab';
import { PricingInventoryTab } from './PricingInventoryTab';
import { VariantsTab } from './VariantsTab';
import { ImagesTab } from './ImagesTab';
import { SEOTab } from './SEOTab';

interface ProductFormProps {
  product?: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete?: (product: Product) => void;
}

export function ProductForm({ product, isOpen, onClose, onSave, onDelete }: ProductFormProps) {
  const [activeTab, setActiveTab] = useState('quick');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>(getInitialFormData());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    name?: boolean;
    brand?: boolean;
    price?: boolean;
    images?: boolean;
  }>({});

  useEffect(() => {
    if (isOpen) {
      // Reset validation errors when modal opens
      setValidationErrors({});
      
      if (product) {
        loadProductData(product);
      } else {
        setFormData(getInitialFormData());
        setActiveTab('quick');
      }
      setHasUnsavedChanges(false);
    }
  }, [product, isOpen]);

  function getInitialFormData(): ProductFormData {
    return {
      name: '',
      slug: '',
      brand: '',
      description: '',
      short_description: '',
      price: 0,
      compare_at_price: undefined,
      cost_price: undefined,
      stock: 0,
      track_inventory: true,
      continue_selling_when_out_of_stock: false,
      gallery_images: [],
      image_alt_text: '',
      is_active: true,
      is_featured: false,
      is_showcase: false,
      origin: '',
      pack_size: '',
      specifications: [{ key: '', value: '' }],
      meta_title: '',
      meta_description: '',
      meta_keywords: '',
      canonical_url: '',
      og_title: '',
      og_description: '',
      og_image: '',
      twitter_title: '',
      twitter_description: '',
      twitter_image: '',
      structured_data: {},
      variants: []
    };
  }

  async function loadProductData(product: Product) {
    try {
      // Load product variants
      const { data: variantsData, error } = await supabase
        .from('product_variants')
        .select('*, variant_images(*)')
        .eq('product_id', product.id)
        .order('sort_order');

      if (error) throw error;

      const mappedVariants: VariantFormData[] = (variantsData || []).map((v: any) => ({
        id: v.id,
        variant_name: v.variant_name,
        variant_slug: v.variant_slug || '',
        variant_type: v.variant_type,
        price: v.price,
        compare_at_price: v.compare_at_price,
        cost_price: v.cost_price,
        stock: v.stock,
        track_inventory: v.track_inventory ?? true,
        weight: v.weight,
        dimensions: v.dimensions,
        attributes: v.attributes
          ? Object.entries(v.attributes).map(([key, value]) => ({ key, value: String(value) }))
          : [{ key: '', value: '' }],
        is_active: v.is_active,
        sort_order: v.sort_order,
        assigned_images: (v.variant_images || []).map((img: any) => img.image_url),
        meta_title: v.meta_title || '',
        meta_description: v.meta_description || '',
        meta_keywords: v.meta_keywords || '',
        og_title: v.og_title || '',
        og_description: v.og_description || '',
        structured_data: v.structured_data || {}
      }));

      const loadedData = {
        name: product.name,
        slug: product.slug,
        brand: product.brand,
        description: product.description || '',
        short_description: product.short_description || '',
        price: product.price,
        compare_at_price: product.compare_at_price || undefined,
        cost_price: product.cost_price || undefined,
        stock: product.stock,
        track_inventory: product.track_inventory ?? true,
        continue_selling_when_out_of_stock: product.continue_selling_when_out_of_stock ?? false,
        gallery_images: product.gallery_images || [],
        image_alt_text: product.image_alt_text || '',
        is_active: product.is_active,
        is_featured: product.is_featured ?? false,
        is_showcase: product.is_showcase ?? false,
        origin: product.origin || '',
        pack_size: product.pack_size || '',
        specifications: product.specifications
          ? Object.entries(product.specifications).map(([key, value]) => ({ key, value }))
          : [{ key: '', value: '' }],
        meta_title: product.meta_title || '',
        meta_description: product.meta_description || '',
        meta_keywords: product.meta_keywords || '',
        canonical_url: product.canonical_url || '',
        og_title: product.og_title || '',
        og_description: product.og_description || '',
        og_image: product.og_image || '',
        twitter_title: product.twitter_title || '',
        twitter_description: product.twitter_description || '',
        twitter_image: product.twitter_image || '',
        structured_data: product.structured_data || {},
        variants: mappedVariants
      };

      console.log('📥 ========== LOADED PRODUCT DATA ==========');
      console.log('📥 Basic Info:', {
        name: loadedData.name,
        slug: loadedData.slug,
        brand: loadedData.brand,
        description: loadedData.description?.substring(0, 50) + '...',
        short_description: loadedData.short_description?.substring(0, 50) + '...'
      });
      console.log('📥 Pricing:', {
        price: loadedData.price,
        compare_at_price: loadedData.compare_at_price,
        cost_price: loadedData.cost_price,
        stock: loadedData.stock
      });
      console.log('📥 Images:', {
        gallery_images_count: loadedData.gallery_images.length,
        gallery_images: loadedData.gallery_images,
        image_alt_text: loadedData.image_alt_text
      });
      console.log('📥 Status:', {
        is_active: loadedData.is_active,
        is_featured: loadedData.is_featured,
        is_showcase: loadedData.is_showcase,
        track_inventory: loadedData.track_inventory,
        continue_selling_when_out_of_stock: loadedData.continue_selling_when_out_of_stock
      });
      console.log('📥 Product Details:', {
        origin: loadedData.origin,
        pack_size: loadedData.pack_size,
        specifications_count: loadedData.specifications.length,
        specifications: loadedData.specifications
      });
      console.log('📥 SEO:', {
        meta_title: loadedData.meta_title,
        meta_description: loadedData.meta_description?.substring(0, 50) + '...',
        meta_keywords: loadedData.meta_keywords,
        canonical_url: loadedData.canonical_url
      });
      console.log('📥 Social Media:', {
        og_title: loadedData.og_title,
        og_description: loadedData.og_description?.substring(0, 50) + '...',
        og_image: loadedData.og_image,
        twitter_title: loadedData.twitter_title
      });
      console.log('📥 Variants:', {
        count: loadedData.variants.length,
        details: loadedData.variants.map(v => ({
          id: v.id,
          name: v.variant_name,
          type: v.variant_type,
          price: v.price,
          stock: v.stock,
          assigned_images_count: v.assigned_images?.length || 0,
          assigned_images: v.assigned_images,
          is_active: v.is_active
        }))
      });
      console.log('📥 ==========================================');

      setFormData(loadedData);
    } catch (error) {
      console.error('Error loading product data:', error);
      toast.error('Failed to load product data');
    }
  }

  const handleFormChange = useCallback((updates: Partial<ProductFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
    // Clear validation errors when user starts fixing them
    if (updates.name !== undefined) setValidationErrors(prev => ({ ...prev, name: false }));
    if (updates.brand !== undefined) setValidationErrors(prev => ({ ...prev, brand: false }));
    if (updates.price !== undefined) setValidationErrors(prev => ({ ...prev, price: false }));
    if (updates.gallery_images !== undefined) setValidationErrors(prev => ({ ...prev, images: false }));
  }, []);

  const validateRequiredFields = (): boolean => {
    const errors = {
      name: !formData.name.trim(),
      brand: !formData.brand.trim(),
      price: formData.price <= 0,
      images: formData.gallery_images.length === 0
    };

    setValidationErrors(errors);

    if (errors.name || errors.brand || errors.price || errors.images) {
      const missingFields = [
        errors.name && 'Name',
        errors.brand && 'Brand',
        errors.price && 'Price',
        errors.images && 'Images'
      ].filter(Boolean).join(', ');
      
      toast.error(`Missing required fields: ${missingFields}`);
      
      // Navigate to appropriate tab
      if (errors.name || errors.brand || errors.price) {
        setActiveTab('quick');
      } else if (errors.images) {
        setActiveTab('images');
      }
      
      return false;
    }

    return true;
  };

  const handleSave = async (e?: React.MouseEvent) => {
    // Prevent any default behavior
    e?.preventDefault();
    e?.stopPropagation();
    
    try {
      setLoading(true);

      console.log('💾 ========== SAVING PRODUCT DATA ==========');
      console.log('💾 Basic Info:', {
        name: formData.name,
        slug: formData.slug || generateSlug(formData.name),
        brand: formData.brand,
        description: formData.description?.substring(0, 50) + '...',
        short_description: formData.short_description?.substring(0, 50) + '...'
      });
      console.log('💾 Pricing:', {
        price: formData.price,
        compare_at_price: formData.compare_at_price,
        cost_price: formData.cost_price,
        stock: formData.stock
      });
      console.log('💾 Images:', {
        gallery_images_count: formData.gallery_images.length,
        gallery_images: formData.gallery_images,
        image_alt_text: formData.image_alt_text
      });
      console.log('💾 Status:', {
        is_active: formData.is_active,
        is_featured: formData.is_featured,
        is_showcase: formData.is_showcase,
        track_inventory: formData.track_inventory,
        continue_selling_when_out_of_stock: formData.continue_selling_when_out_of_stock
      });
      console.log('💾 Product Details:', {
        origin: formData.origin,
        pack_size: formData.pack_size,
        specifications_count: formData.specifications.length,
        specifications: formData.specifications
      });
      console.log('💾 SEO:', {
        meta_title: formData.meta_title,
        meta_description: formData.meta_description?.substring(0, 50) + '...',
        meta_keywords: formData.meta_keywords,
        canonical_url: formData.canonical_url
      });
      console.log('💾 Social Media:', {
        og_title: formData.og_title,
        og_description: formData.og_description?.substring(0, 50) + '...',
        og_image: formData.og_image,
        twitter_title: formData.twitter_title
      });
      console.log('💾 Variants:', {
        count: formData.variants.length,
        details: formData.variants.map(v => ({
          id: v.id,
          name: v.variant_name,
          type: v.variant_type,
          price: v.price,
          stock: v.stock,
          assigned_images_count: v.assigned_images?.length || 0,
          assigned_images: v.assigned_images,
          is_active: v.is_active
        }))
      });
      console.log('💾 ==========================================');

      // Validate required fields
      if (!validateRequiredFields()) {
        setLoading(false);
        return;
      }

      // Generate slug if empty
      const slug = formData.slug || generateSlug(formData.name);

      // Prepare specifications
      const specifications = formData.specifications
        .filter(spec => spec.key.trim() && spec.value.trim())
        .reduce((acc, spec) => ({ ...acc, [spec.key]: spec.value }), {});

      // Prepare product data
      const productData = {
        name: formData.name.trim(),
        slug,
        brand: formData.brand.trim(),
        description: (formData.description || '').trim(),
        short_description: formData.short_description?.trim() || null,
        price: formData.price,
        compare_at_price: formData.compare_at_price || null,
        cost_price: formData.cost_price || null,
        stock: formData.stock,
        track_inventory: formData.track_inventory,
        continue_selling_when_out_of_stock: formData.continue_selling_when_out_of_stock,
        gallery_images: formData.gallery_images,
        image_alt_text: formData.image_alt_text?.trim() || null,
        is_active: formData.is_active,
        is_featured: formData.is_featured,
        is_showcase: formData.is_showcase,
        origin: formData.origin?.trim() || null,
        pack_size: formData.pack_size?.trim() || null,
        specifications,
        meta_title: formData.meta_title?.trim() || null,
        meta_description: formData.meta_description?.trim() || null,
        meta_keywords: formData.meta_keywords?.trim() || null,
        canonical_url: formData.canonical_url?.trim() || null,
        og_title: formData.og_title?.trim() || null,
        og_description: formData.og_description?.trim() || null,
        og_image: formData.og_image?.trim() || null,
        twitter_title: formData.twitter_title?.trim() || null,
        twitter_description: formData.twitter_description?.trim() || null,
        twitter_image: formData.twitter_image?.trim() || null,
        structured_data: formData.structured_data || {},
        updated_at: new Date().toISOString()
      };

      let productId: string;

      if (product) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', product.id);

        if (error) throw error;
        productId = product.id;
        toast.success('Product updated successfully');
      } else {
        // Create new product
        const { data, error } = await supabase
          .from('products')
          .insert([productData])
          .select()
          .single();

        if (error) throw error;
        productId = data.id;
        toast.success('Product created successfully');
      }

      // Handle variants
      await saveVariants(productId);

      setHasUnsavedChanges(false);
      onSave();
      onClose();
    } catch (error: any) {
      console.error('Error saving product:', error);
      toast.error(error.message || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  async function saveVariants(productId: string) {
    console.log('💾 Saving variants:', formData.variants.length);
    
    // Delete removed variants
    if (product) {
      const existingVariantIds = formData.variants.filter(v => v.id).map(v => v.id);
      if (existingVariantIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('product_variants')
          .delete()
          .eq('product_id', productId)
          .not('id', 'in', `(${existingVariantIds.join(',')})`);

        if (deleteError) console.error('Error deleting variants:', deleteError);
      }
    }

    // Save variants
    for (const variant of formData.variants) {
      console.log('💾 Saving variant:', variant.variant_name, 'with', variant.assigned_images?.length || 0, 'images');
      const attributes = variant.attributes
        .filter(attr => attr.key.trim() && attr.value.trim())
        .reduce((acc, attr) => ({ ...acc, [attr.key]: attr.value }), {});

      const variantData = {
        product_id: productId,
        variant_name: variant.variant_name.trim(),
        variant_slug: variant.variant_slug || generateSlug(variant.variant_name),
        variant_type: variant.variant_type,
        price: variant.price,
        compare_at_price: variant.compare_at_price || null,
        cost_price: variant.cost_price || null,
        stock: variant.stock,
        track_inventory: variant.track_inventory,
        weight: variant.weight || null,
        dimensions: variant.dimensions || null,
        attributes,
        is_active: variant.is_active,
        sort_order: variant.sort_order,
        meta_title: variant.meta_title?.trim() || null,
        meta_description: variant.meta_description?.trim() || null,
        meta_keywords: variant.meta_keywords?.trim() || null,
        og_title: variant.og_title?.trim() || null,
        og_description: variant.og_description?.trim() || null,
        structured_data: variant.structured_data || {},
        updated_at: new Date().toISOString()
      };

      if (variant.id) {
        // Update existing variant
        const { error } = await supabase
          .from('product_variants')
          .update(variantData)
          .eq('id', variant.id);

        if (error) throw error;

        // Update variant images
        await saveVariantImages(variant.id, variant.assigned_images);
      } else {
        // Create new variant
        const { data, error } = await supabase
          .from('product_variants')
          .insert([variantData])
          .select()
          .single();

        if (error) throw error;

        // Save variant images
        await saveVariantImages(data.id, variant.assigned_images);
      }
    }
  }

  async function saveVariantImages(variantId: string, imageUrls: string[]) {
    // Delete existing variant images
    await supabase
      .from('variant_images')
      .delete()
      .eq('variant_id', variantId);

    // Insert new variant images
    if (imageUrls.length > 0) {
      const images = imageUrls.map((url, index) => ({
        variant_id: variantId,
        image_url: url,
        sort_order: index,
        is_primary: index === 0,
        lazy_load: true
      }));

      await supabase
        .from('variant_images')
        .insert(images);
    }
  }

  // Calculate discount info for display
  const discountInfo = useMemo(() => 
    calculateDiscount(formData.price, formData.compare_at_price),
    [formData.price, formData.compare_at_price]
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        if (hasUnsavedChanges) {
          if (confirm('You have unsaved changes. Are you sure you want to close?')) {
            setValidationErrors({});
            setHasUnsavedChanges(false);
            onClose();
          }
        } else {
          setValidationErrors({});
          onClose();
        }
      }
    }} modal={true}>
      <DialogContent 
        className="max-w-7xl h-[95vh] flex flex-col bg-[var(--color-creme-light)] border-2 border-[var(--color-coyote)] shadow-2xl p-0 gap-0 overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Fixed Header */}
        <DialogHeader className="border-b-2 border-[var(--color-coyote)] px-8 py-6 bg-gradient-to-r from-[var(--color-creme)] to-[var(--color-creme-light)] flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[var(--color-dark)] rounded-xl shadow-lg">
                <Package className="w-6 h-6 text-[var(--color-creme-light)]" />
              </div>
              <div>
                <DialogTitle className="text-3xl font-serif text-[var(--color-dark)] tracking-tight">
                  {product ? 'Edit Product' : 'New Product'}
                </DialogTitle>
                <DialogDescription className="text-sm text-[var(--color-dark)]/70 mt-1 font-sans">
                  {product ? `Editing: ${product.name}` : 'Create a new premium product with variants and pricing'}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {discountInfo.discount_percentage && (
                <Badge className="bg-[var(--color-canyon)] text-[var(--color-creme-light)] px-3 py-1.5 text-sm font-medium shadow-md">
                  {discountInfo.discount_percentage}% OFF
                </Badge>
              )}
              {hasUnsavedChanges && (
                <Badge variant="outline" className="border-2 border-[var(--color-canyon)] text-[var(--color-canyon)] px-3 py-1.5 text-sm font-medium">
                  Unsaved Changes
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            {/* Fixed Tab Navigation */}
            <TabsList className="bg-[var(--color-creme)] border-b-2 border-[var(--color-coyote)] rounded-none justify-start px-8 py-2 gap-2 flex-shrink-0">
              <TabsTrigger 
                value="quick"
                className="data-[state=active]:bg-[var(--color-dark)] data-[state=active]:text-[var(--color-creme-light)] data-[state=inactive]:text-[var(--color-dark)]/70 rounded-lg px-6 py-2.5 font-sans font-medium transition-all hover:bg-[var(--color-coyote)] data-[state=active]:shadow-md"
              >
                Quick Setup
              </TabsTrigger>
              <TabsTrigger 
                value="basic"
                className="data-[state=active]:bg-[var(--color-dark)] data-[state=active]:text-[var(--color-creme-light)] data-[state=inactive]:text-[var(--color-dark)]/70 rounded-lg px-6 py-2.5 font-sans font-medium transition-all hover:bg-[var(--color-coyote)] data-[state=active]:shadow-md"
              >
                Basic Info
              </TabsTrigger>
              <TabsTrigger 
                value="pricing"
                className="data-[state=active]:bg-[var(--color-dark)] data-[state=active]:text-[var(--color-creme-light)] data-[state=inactive]:text-[var(--color-dark)]/70 rounded-lg px-6 py-2.5 font-sans font-medium transition-all hover:bg-[var(--color-coyote)] data-[state=active]:shadow-md"
              >
                Pricing & Inventory
              </TabsTrigger>
              <TabsTrigger 
                value="variants"
                className="data-[state=active]:bg-[var(--color-dark)] data-[state=active]:text-[var(--color-creme-light)] data-[state=inactive]:text-[var(--color-dark)]/70 rounded-lg px-6 py-2.5 font-sans font-medium transition-all hover:bg-[var(--color-coyote)] data-[state=active]:shadow-md"
              >
                Variants {formData.variants.length > 0 && <span className="ml-1.5 px-2 py-0.5 bg-[var(--color-canyon)] text-[var(--color-creme-light)] rounded-full text-xs">{formData.variants.length}</span>}
              </TabsTrigger>
              <TabsTrigger 
                value="images"
                className="data-[state=active]:bg-[var(--color-dark)] data-[state=active]:text-[var(--color-creme-light)] data-[state=inactive]:text-[var(--color-dark)]/70 rounded-lg px-6 py-2.5 font-sans font-medium transition-all hover:bg-[var(--color-coyote)] data-[state=active]:shadow-md"
              >
                Images {formData.gallery_images.length > 0 && <span className="ml-1.5 px-2 py-0.5 bg-[var(--color-canyon)] text-[var(--color-creme-light)] rounded-full text-xs">{formData.gallery_images.length}</span>}
              </TabsTrigger>
              <TabsTrigger 
                value="seo"
                className="data-[state=active]:bg-[var(--color-dark)] data-[state=active]:text-[var(--color-creme-light)] data-[state=inactive]:text-[var(--color-dark)]/70 rounded-lg px-6 py-2.5 font-sans font-medium transition-all hover:bg-[var(--color-coyote)] data-[state=active]:shadow-md"
              >
                SEO
              </TabsTrigger>
            </TabsList>

            {/* Scrollable Tab Content */}
            <div className="flex-1 overflow-y-auto px-8 py-6 bg-[var(--color-creme)] scrollbar-thin scrollbar-thumb-[var(--color-coyote)] scrollbar-track-transparent">
              <TabsContent value="quick" className="mt-0 h-full">
                <QuickSetupTab formData={formData} onChange={handleFormChange} validationErrors={validationErrors} />
              </TabsContent>
              <TabsContent value="basic" className="mt-0 h-full">
                <BasicInfoTab formData={formData} onChange={handleFormChange} />
              </TabsContent>

              <TabsContent value="pricing" className="mt-0 h-full">
                <PricingInventoryTab formData={formData} onChange={handleFormChange} />
              </TabsContent>

              <TabsContent value="variants" className="mt-0 h-full">
                <VariantsTab 
                  formData={formData} 
                  onChange={handleFormChange}
                  productImages={formData.gallery_images}
                />
              </TabsContent>

              <TabsContent value="images" className="mt-0 h-full">
                <ImagesTab formData={formData} onChange={handleFormChange} />
              </TabsContent>

              <TabsContent value="seo" className="mt-0 h-full">
                <SEOTab formData={formData} onChange={handleFormChange} />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Fixed Footer */}
        <div className="border-t-2 border-[var(--color-coyote)] px-8 py-5 bg-gradient-to-r from-[var(--color-creme-light)] to-[var(--color-creme)] flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (hasUnsavedChanges) {
                    if (confirm('You have unsaved changes. Are you sure you want to close?')) {
                      setValidationErrors({});
                      setHasUnsavedChanges(false);
                      onClose();
                    }
                  } else {
                    onClose();
                  }
                }}
                disabled={loading}
                className="border-2 border-[var(--color-coyote)] hover:bg-[var(--color-coyote)] hover:text-[var(--color-dark)] px-6 py-2.5 font-sans font-medium transition-all"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>

              {product && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    if (confirm(`Delete "${product.name}"? This action cannot be undone.`)) {
                      onDelete(product);
                      onClose();
                    }
                  }}
                  disabled={loading}
                  className="bg-red-600 text-white hover:bg-red-700 px-6 py-2.5 font-sans font-medium transition-all"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Product
                </Button>
              )}
            </div>

            <Button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="bg-[var(--color-dark)] text-[var(--color-creme-light)] hover:bg-[var(--color-canyon)] px-8 py-2.5 font-sans font-medium shadow-lg transition-all hover:shadow-xl disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {product ? 'Update Product' : 'Save Product'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
