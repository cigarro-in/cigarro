// ============================================================================
// PRODUCT FORM WIZARD - Modern Multi-Step Approach
// Progressive disclosure with AI-powered features
// ============================================================================

import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Save, X, Sparkles, Check } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';
import { Progress } from '../../../../components/ui/progress';
import { Badge } from '../../../../components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '../../../../utils/supabase/client';
import { Product, ProductFormData, generateSlug } from '../../../../types/product';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '../../../../components/ui/alert-dialog';

// Step Components
import { QuickAddStep } from './QuickAddStep';
import { ProductDetailsStep } from './ProductDetailsStep';
import { VariantsPricingStep } from './VariantsPricingStep';
import { MediaSEOStep } from './MediaSEOStep';
import { ReviewPublishStep } from './ReviewPublishStep';

interface ProductFormWizardProps {
  product?: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const STEPS = [
  { id: 'quick', label: 'Quick Add', icon: Sparkles, required: true },
  { id: 'details', label: 'Details', icon: null, required: false },
  { id: 'variants', label: 'Variants', icon: null, required: false },
  { id: 'media', label: 'Media & SEO', icon: null, required: false },
  { id: 'review', label: 'Review', icon: Check, required: true }
];

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
    specifications: [],
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

export function ProductFormWizard({ product, isOpen, onClose, onSave }: ProductFormWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>(getInitialFormData());
  const [skipOptionalSteps, setSkipOptionalSteps] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState<string>('');
  const [missingRequired, setMissingRequired] = useState<{ name?: boolean; brand?: boolean; price?: boolean; images?: boolean }>({});

  // Define helper functions before useEffects
  const computeMissingRequired = (data: ProductFormData) => {
    return {
      name: !data.name.trim(),
      brand: !data.brand.trim(),
      price: !(data.price > 0),
      images: (data.gallery_images?.length || 0) === 0,
    };
  };

  const isDirty = () => {
    try {
      return JSON.stringify(formData) !== initialSnapshot;
    } catch {
      return true;
    }
  };

  const requestClose = () => {
    if (isDirty()) {
      setShowCloseConfirm(true);
      return;
    }
    onClose();
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      requestClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (product) {
        loadProductData(product);
      } else {
        const fresh = getInitialFormData();
        setFormData(fresh);
        setInitialSnapshot(JSON.stringify(fresh));
        // Compute initial missing required fields
        const initial = computeMissingRequired(fresh);
        setMissingRequired(initial);
      }
      setCurrentStep(0);
    }
  }, [product, isOpen]);

  useEffect(() => {
    // Recompute missing required whenever essentials change
    const computed = computeMissingRequired(formData);
    setMissingRequired(computed);
  }, [formData.name, formData.brand, formData.price, formData.gallery_images]);

  async function loadProductData(product: Product) {
    try {
      const { data: variantsData } = await supabase
        .from('product_variants')
        .select('*, variant_images(*)')
        .eq('product_id', product.id)
        .order('sort_order');

      const mappedVariants = (variantsData || []).map((v: any) => ({
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
          : [],
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

      const loaded: ProductFormData = {
        name: product.name,
        slug: product.slug,
        brand: product.brand,
        description: product.description,
        short_description: product.short_description || '',
        price: product.price,
        compare_at_price: product.compare_at_price,
        cost_price: product.cost_price,
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
          : [],
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

      setFormData(loaded);
      setInitialSnapshot(JSON.stringify(loaded));
      const loadedMissing = computeMissingRequired(loaded);
      setMissingRequired(loadedMissing);
    } catch (error) {
      console.error('Error loading product:', error);
      toast.error('Failed to load product data');
    }
  }

  const handleNext = () => {
    if (!validateStep(currentStep)) return;

    if (currentStep === 0 && skipOptionalSteps) {
      setCurrentStep(STEPS.length - 1);
    } else {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0:
        if (!formData.name.trim()) {
          toast.error('Product name is required');
          return false;
        }
        if (!formData.brand.trim()) {
          toast.error('Brand is required');
          return false;
        }
        if (formData.price <= 0) {
          toast.error('Price must be greater than 0');
          return false;
        }
        if (formData.gallery_images.length === 0) {
          toast.error('At least one image is required');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleSave = async (isDraft: boolean = false) => {
    try {
      setLoading(true);

      const productData = {
        name: formData.name,
        slug: formData.slug || generateSlug(formData.name),
        brand: formData.brand,
        description: formData.description,
        short_description: formData.short_description,
        price: formData.price,
        compare_at_price: formData.compare_at_price,
        cost_price: formData.cost_price,
        stock: formData.stock,
        track_inventory: formData.track_inventory,
        continue_selling_when_out_of_stock: formData.continue_selling_when_out_of_stock,
        gallery_images: formData.gallery_images,
        image_alt_text: formData.image_alt_text,
        is_active: isDraft ? false : formData.is_active,
        is_featured: formData.is_featured,
        is_showcase: formData.is_showcase,
        origin: formData.origin,
        pack_size: formData.pack_size,
        specifications: formData.specifications.reduce((acc, spec) => {
          if (spec.key && spec.value) {
            acc[spec.key] = spec.value;
          }
          return acc;
        }, {} as Record<string, string>),
        meta_title: formData.meta_title,
        meta_description: formData.meta_description,
        meta_keywords: formData.meta_keywords,
        canonical_url: formData.canonical_url,
        og_title: formData.og_title,
        og_description: formData.og_description,
        og_image: formData.og_image,
        twitter_title: formData.twitter_title,
        twitter_description: formData.twitter_description,
        twitter_image: formData.twitter_image,
        structured_data: formData.structured_data
      };

      let productId: string;

      if (product?.id) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', product.id);

        if (error) throw error;
        productId = product.id;
      } else {
        const { data, error } = await supabase
          .from('products')
          .insert(productData)
          .select()
          .single();

        if (error) throw error;
        productId = data.id;
      }

      if (formData.variants.length > 0) {
        await saveVariants(productId);
      }

      toast.success(isDraft ? 'Product saved as draft' : 'Product saved successfully');
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  const saveVariants = async (productId: string) => {
    for (const variant of formData.variants) {
      const variantData = {
        product_id: productId,
        variant_name: variant.variant_name,
        variant_slug: variant.variant_slug || generateSlug(variant.variant_name),
        variant_type: variant.variant_type,
        price: variant.price,
        compare_at_price: variant.compare_at_price,
        cost_price: variant.cost_price,
        stock: variant.stock,
        track_inventory: variant.track_inventory,
        weight: variant.weight,
        dimensions: variant.dimensions,
        attributes: variant.attributes.reduce((acc, attr) => {
          if (attr.key && attr.value) {
            acc[attr.key] = attr.value;
          }
          return acc;
        }, {} as Record<string, string>),
        is_active: variant.is_active,
        sort_order: variant.sort_order,
        meta_title: variant.meta_title,
        meta_description: variant.meta_description,
        meta_keywords: variant.meta_keywords,
        og_title: variant.og_title,
        og_description: variant.og_description,
        structured_data: variant.structured_data
      };

      if (variant.id) {
        await supabase.from('product_variants').update(variantData).eq('id', variant.id);
      } else {
        const { data } = await supabase.from('product_variants').insert(variantData).select().single();
        
        if (data && variant.assigned_images.length > 0) {
          const imageData = variant.assigned_images.map((url, index) => ({
            variant_id: data.id,
            image_url: url,
            sort_order: index,
            is_primary: index === 0
          }));
          await supabase.from('variant_images').insert(imageData);
        }
      }
    }
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent 
          className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-[var(--color-creme-light)] p-0 rounded-lg"
          onInteractOutside={(e) => {
            e.preventDefault();
            requestClose();
          }}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            requestClose();
          }}
        >
          <DialogHeader className="sticky top-0 z-10 bg-[var(--color-creme-light)] border-b border-[var(--color-coyote)] px-6 pt-6">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-2xl font-serif text-[var(--color-dark)]">
                {product ? 'Edit Product' : 'Add New Product'}
              </DialogTitle>
              <Badge variant="outline" className="text-xs">
                Step {currentStep + 1} of {STEPS.length}
              </Badge>
            </div>
            <Progress value={progress} className="h-2 mt-4" />
            {Object.values(missingRequired).some(Boolean) && (
              <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                Missing: {[
                  missingRequired.name && 'Name',
                  missingRequired.brand && 'Brand',
                  missingRequired.price && 'Price',
                  missingRequired.images && 'Images',
                ].filter(Boolean).join(', ')}
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-6 px-6">
            {currentStep === 0 && (
              <QuickAddStep
                formData={formData}
                setFormData={setFormData}
                skipOptionalSteps={skipOptionalSteps}
                setSkipOptionalSteps={setSkipOptionalSteps}
                errors={missingRequired}
              />
            )}
          {currentStep === 1 && (
            <ProductDetailsStep formData={formData} setFormData={setFormData} />
          )}
          {currentStep === 2 && (
            <VariantsPricingStep formData={formData} setFormData={setFormData} />
          )}
          {currentStep === 3 && (
            <MediaSEOStep formData={formData} setFormData={setFormData} />
          )}
          {currentStep === 4 && (
            <ReviewPublishStep formData={formData} product={product} />
          )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[var(--color-coyote)] px-6 pb-6 sticky bottom-0 bg-[var(--color-creme-light)]">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0 || loading}
            className="border-[var(--color-coyote)]"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="flex gap-2">
            {currentStep === STEPS.length - 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSave(true)}
                disabled={loading}
                className="border-[var(--color-coyote)]"
              >
                Save as Draft
              </Button>
            )}
            
            {currentStep === STEPS.length - 1 ? (
              <Button
                type="button"
                onClick={() => handleSave(false)}
                disabled={loading}
                className="bg-[var(--color-dark)] text-[var(--color-creme-light)] hover:bg-[var(--color-canyon)]"
              >
                {loading ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Publish Product
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleNext}
                disabled={loading}
                className="bg-[var(--color-dark)] text-[var(--color-creme-light)] hover:bg-[var(--color-canyon)]"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unsaved changes confirmation */}
      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent className="bg-[var(--color-creme-light)] border-[var(--color-coyote)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[var(--color-dark)]">Discard changes?</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--color-dark)]/70">
              You have unsaved changes. If you close now, they will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[var(--color-coyote)]" onClick={() => setShowCloseConfirm(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction className="bg-[var(--color-canyon)] text-white hover:bg-[var(--color-dark)]" onClick={() => { setShowCloseConfirm(false); onClose(); }}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
