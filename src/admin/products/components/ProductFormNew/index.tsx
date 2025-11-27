import { useState, useEffect } from "react";
import { Product, ProductFormData, VariantFormData } from "../../../../types/product";
import { FormHeader } from "./FormHeader";
import { BasicInfo } from "./LeftColumn/BasicInfo";
import { ProductDNA } from "./LeftColumn/ProductDNA";
import { Specifications } from "./LeftColumn/Specifications";
import { SmartVariants } from "./LeftColumn/SmartVariants";
import { SEOPreview } from "./LeftColumn/SEOPreview";
import { StatusCard } from "./RightColumn/StatusCard";
import { PricingCard } from "./RightColumn/PricingCard";
import { OrganizationCard } from "./RightColumn/OrganizationCard";
import { toast } from "sonner";

interface ProductFormNewProps {
  initialData?: Product;
  onSave: (data: ProductFormData) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}

export function ProductFormNew({ initialData, onSave, onCancel, onDelete }: ProductFormNewProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  
  const defaultFormData: ProductFormData = {
    name: '',
    slug: '',
    brand_id: undefined,
    description: '',
    short_description: '',
    is_active: true,
    specifications: [],
    variants: [{
      variant_name: 'Packet',
      variant_type: 'pack',
      units_contained: 20,
      unit: 'sticks',
      price: 0,
      stock: 0,
      track_inventory: true,
      is_active: true,
      is_default: true,
      images: []
    }],
    collections: [],
    categories: [],
    origin: ''
  };

  const [formData, setFormData] = useState<ProductFormData>(() =>
    initialData ? mapProductToFormData(initialData) : defaultFormData
  );

  // Track dirty state
  useEffect(() => {
    setIsDirty(true);
  }, [formData]);

  // Initial load shouldn't set dirty
  useEffect(() => {
    setIsDirty(false);
  }, []);

  const handleChange = (updates: Partial<ProductFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error("Product name is required");
      return;
    }
    
    // Check if there's at least one default variant with a valid price
    const defaultVariant = formData.variants.find(v => v.is_default);
    if (!defaultVariant) {
      toast.error("At least one default variant is required");
      return;
    }
    
    if (defaultVariant.price <= 0) {
      toast.error("Default variant price must be greater than 0");
      return;
    }
    
    // Check if default variant has at least one image
    if (!defaultVariant.images || defaultVariant.images.length === 0) {
      toast.error("Default variant must have at least one image");
      return;
    }

    setIsSaving(true);
    try {
      await onSave(formData);
      toast.success("Product saved successfully");
      setIsDirty(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save product");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-creme)] pb-20">
      <FormHeader 
        title={formData.name || "Untitled Product"} 
        isEditing={!!initialData}
        isSaving={isSaving}
        onSave={handleSave}
        onCancel={onCancel}
        onDelete={onDelete}
        isDirty={isDirty}
      />

      <div className="max-w-[1100px] mx-auto px-6 grid grid-cols-[1fr_350px] gap-6">
        
        {/* LEFT COLUMN (Main Content) */}
        <div className="space-y-6">
          <BasicInfo formData={formData} onChange={handleChange} />
          <ProductDNA formData={formData} onChange={handleChange} />
          <Specifications formData={formData} onChange={handleChange} />
          <SmartVariants formData={formData} onChange={handleChange} />
          <SEOPreview formData={formData} onChange={handleChange} />
        </div>

        {/* RIGHT COLUMN (Context) */}
        <div className="space-y-6">
          <StatusCard formData={formData} onChange={handleChange} />
          <PricingCard formData={formData} onChange={handleChange} />
          <OrganizationCard formData={formData} onChange={handleChange} />
        </div>

      </div>
    </div>
  );
}

// Helper to convert DB Product to Form Data
function mapProductToFormData(product: Product): ProductFormData {
  const mappedVariants: VariantFormData[] = product.product_variants?.map(v => ({
    id: v.id,
    variant_name: v.variant_name,
    variant_slug: v.variant_slug,
    variant_type: v.variant_type || 'pack',
    is_default: v.is_default || false,
    // Map images
    images: v.images || [],
    image_alt_text: v.image_alt_text,
    // Tobacco specifics
    units_contained: v.units_contained || 20,
    unit: v.unit || 'sticks',
    // Pricing/Inventory
    price: v.price,
    compare_at_price: v.compare_at_price,
    cost_price: v.cost_price,
    stock: v.stock || 0,
    track_inventory: v.track_inventory ?? true,
    is_active: v.is_active
  })) || [];

  return {
    name: product.name,
    slug: product.slug,
    brand_id: product.brand_id,
    description: product.description || '',
    short_description: product.short_description,
    is_active: product.is_active,
    origin: product.origin,
    specifications: product.specifications 
      ? Object.entries(product.specifications).map(([key, value]) => ({ key, value }))
      : [],
    variants: mappedVariants,
    collections: product.collections?.map((c: any) => c.id) || [],
    // Handle categories from join table format (category_id) or direct format (id)
    categories: product.categories?.map((c: any) => c.category_id || c.id) || [],
    
    // SEO
    meta_title: product.meta_title,
    meta_description: product.meta_description,
    canonical_url: product.canonical_url,
  };
}
