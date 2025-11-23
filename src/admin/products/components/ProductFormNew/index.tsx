import { useState, useEffect } from "react";
import { Product, ProductFormData } from "../../../../types/product";
import { FormHeader } from "./FormHeader";
import { BasicInfo } from "./LeftColumn/BasicInfo";
import { MediaGrid } from "./LeftColumn/MediaGrid";
import { ProductDNA } from "./LeftColumn/ProductDNA";
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
    brand: '',
    description: '',
    price: 0,
    stock: 0,
    track_inventory: true,
    continue_selling_when_out_of_stock: false,
    gallery_images: [],
    is_active: true,
    is_featured: false,
    is_showcase: false,
    specifications: [],
    variants: [],
    collections: [],
    // Defaults
    pack_size: '',
    origin: ''
  };

  const [formData, setFormData] = useState<ProductFormData>(
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
    if (formData.price <= 0) {
      toast.error("Price must be greater than 0");
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
          <MediaGrid formData={formData} onChange={handleChange} />
          <ProductDNA formData={formData} onChange={handleChange} />
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
  console.log('Mapping product to form data:', product.name);
  const mappedVariants = product.product_variants?.map(v => ({
    ...v,
    variant_name: v.variant_name,
    variant_type: v.variant_type || 'packaging',
    attributes: v.attributes 
      ? Object.entries(v.attributes).map(([key, value]) => ({ key, value: String(value) }))
      : [],
    assigned_images: v.images || [],
    packaging: v.packaging || 'pack',
    units_contained: v.units_contained || 1,
    track_inventory: v.track_inventory ?? true
  })) || [];
  console.log('Mapped variants:', mappedVariants);

  return {
    name: product.name,
    slug: product.slug,
    brand: product.brand,
    brand_id: product.brand_id,
    description: product.description || '',
    short_description: product.short_description,
    price: product.price,
    compare_at_price: product.compare_at_price,
    cost_price: product.cost_price,
    stock: product.stock,
    track_inventory: product.track_inventory ?? true,
    continue_selling_when_out_of_stock: product.continue_selling_when_out_of_stock ?? false,
    gallery_images: product.gallery_images || [],
    is_active: product.is_active,
    is_featured: product.is_featured || false,
    is_showcase: product.is_showcase || false,
    origin: product.origin,
    pack_size: product.pack_size,
    specifications: product.specifications 
      ? Object.entries(product.specifications).map(([key, value]) => ({ key, value }))
      : [],
    variants: mappedVariants,
    collections: product.collections?.map(c => c.id) || [],
    
    // SEO
    meta_title: product.meta_title,
    meta_description: product.meta_description,
    meta_keywords: product.meta_keywords,
  };
}
