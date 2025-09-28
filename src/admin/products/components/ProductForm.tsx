import { useState, useEffect } from 'react';
import { Save, X, Plus, Trash2, Edit, Eye, AlertCircle, CheckCircle, Star } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Switch } from '../../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Separator } from '../../../components/ui/separator';
import { toast } from 'sonner';
import { formatINR } from '../../../utils/currency';
import { supabase } from '../../../utils/supabase/client';
import { MultipleImageUpload } from '../../../components/ui/MultipleImageUpload';
import { ProductFormData, VariantFormData } from '../../../types/product-seo';

interface Product {
  id: string;
  name: string;
  slug: string;
  brand: string;
  price: number;
  description: string;
  stock: number;
  is_active: boolean;
  rating: number;
  review_count: number;
  origin: string;
  pack_size: string;
  specifications: Record<string, string>;
  gallery_images: string[];
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  canonical_url: string;
  og_title: string;
  og_description: string;
  og_image: string;
  twitter_title: string;
  twitter_description: string;
  twitter_image: string;
  image_alt_text: string;
  structured_data: Record<string, any>;
  seo_score: number;
}

interface ProductFormProps {
  product?: Product | null;
  isActive?: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}

// Using ProductFormData from types/product-seo.ts

export function ProductForm({ product, isActive = true, onSave, onCancel, onDelete }: ProductFormProps) {
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    slug: '',
    brand: '',
    price: 0,
    description: '',
    stock: 0,
    is_active: true,
    rating: 0,
    review_count: 0,
    origin: '',
    pack_size: '',
    specifications: [{ key: '', value: '' }],
    gallery_images: [],
    image_alt_text: '',
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
  });
  // For each variant (by index), store assigned image URLs from the product gallery
  const [imageAssignments, setImageAssignments] = useState<Record<number, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([]);
  const [showCustomBrand, setShowCustomBrand] = useState(false);

  const calculateSEOScore = () => {
    let score = 0;
    const checks = [
      { field: formData.meta_title, weight: 15 },
      { field: formData.meta_description, weight: 15 },
      { field: formData.meta_keywords, weight: 10 },
      { field: formData.og_title, weight: 10 },
      { field: formData.og_description, weight: 10 },
      { field: formData.og_image, weight: 10 },
      { field: formData.description, weight: 10, minLength: 100 },
      { field: formData.gallery_images.length > 0 ? 'yes' : '', weight: 10 },
      { field: formData.image_alt_text, weight: 10 }
    ];
    
    checks.forEach(check => {
      if (check.field && check.field.length > (check.minLength || 0)) {
        score += check.weight;
      }
    });
    
    return score;
  };

  useEffect(() => {
    // Load brands
    const loadBrands = async () => {
      try {
        const { data, error } = await supabase
          .from('brands')
          .select('id, name')
          .eq('is_active', true)
          .order('name');
        
        if (error) {
          console.warn('Brands table not found, using empty state');
          setBrands([]);
        } else {
          setBrands(data || []);
        }
      } catch (error) {
        console.warn('Error loading brands:', error);
        setBrands([]);
      }
    };

    loadBrands();

    if (product) {
      const productBrand = product.brand || '';
      
      setFormData({
        name: product.name || '',
        slug: product.slug || '',
        brand: productBrand,
        price: product.price || 0,
        description: product.description || '',
        stock: product.stock || 0,
        is_active: product.is_active ?? true,
        rating: product.rating || 0,
        review_count: product.review_count || 0,
        origin: product.origin || '',
        pack_size: product.pack_size || '',
        specifications: product.specifications 
          ? Object.entries(product.specifications).map(([key, value]) => ({ key, value }))
          : [{ key: '', value: '' }],
        gallery_images: product.gallery_images || [],
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
        image_alt_text: product.image_alt_text || '',
        structured_data: product.structured_data || {},
        variants: []
      });

      // Check if the product's brand is in the brands list, if not, show custom input
      if (productBrand && brands.length > 0) {
        const brandExists = brands.some(brand => brand.name === productBrand);
        setShowCustomBrand(!brandExists);
      }

      // Load variants and initialize image assignments
      (async () => {
        try {
          const { data: variantsData, error } = await supabase
            .from('product_variants')
            .select('id, product_id, variant_name, variant_slug, variant_type, price, stock, weight, dimensions, attributes, is_active, sort_order, meta_title, meta_description, meta_keywords, og_title, og_description, structured_data, variant_images(*)')
            .eq('product_id', product.id)
            .order('sort_order');
          if (error) throw error;

          const mappedVariants: VariantFormData[] = (variantsData || []).map((v: any, idx: number) => {
            const attrs: { key: string; value: string }[] = v.attributes
              ? Object.entries(v.attributes).map(([k, val]) => ({ key: k, value: String(val) }))
              : [{ key: '', value: '' }];
            return {
              id: v.id,
              variant_name: v.variant_name,
              variant_slug: v.variant_slug || '',
              variant_type: v.variant_type,
              price: v.price,
              stock: v.stock || 0,
              weight: v.weight ?? undefined,
              dimensions: v.dimensions ?? undefined,
              attributes: attrs,
              is_active: v.is_active,
              sort_order: v.sort_order ?? idx,
              meta_title: v.meta_title || '',
              meta_description: v.meta_description || '',
              meta_keywords: v.meta_keywords || '',
              og_title: v.og_title || '',
              og_description: v.og_description || '',
              structured_data: v.structured_data || {},
              assigned_image_ids: []
            };
          });

          // Initialize variant image assignments from existing variant_images (by URL)
          const newAssignments: Record<number, string[]> = {};
          (variantsData || []).forEach((v: any, idx: number) => {
            const urls: string[] = (v.variant_images || []).map((img: any) => img.image_url).filter(Boolean);
            if (urls.length > 0) newAssignments[idx] = urls;
          });

          setFormData(prev => ({ ...prev, variants: mappedVariants }));
          setImageAssignments(newAssignments);
        } catch (err) {
          console.error('Failed to load variants for product form', err);
        }
      })();
    }
  }, [product]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const generateUniqueSlug = async (baseSlug: string, excludeId?: string): Promise<string> => {
    let slug = baseSlug;
    let counter = 1;
    
    while (true) {
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('slug', slug)
        .neq('id', excludeId || '')
        .single();
      
      if (!existing) {
        return slug;
      }
      
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: generateSlug(name)
    }));
  };

  const resetFormData = () => {
    setFormData({
      name: '',
      slug: '',
      brand: '',
      price: 0,
      description: '',
      stock: 0,
      is_active: true,
      rating: 0,
      review_count: 0,
      origin: '',
      pack_size: '',
      specifications: [{ key: '', value: '' }],
      gallery_images: [],
      image_alt_text: '',
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
    });
  };

  const handleSpecificationChange = (index: number, field: 'key' | 'value', value: string) => {
    setFormData(prev => ({
      ...prev,
      specifications: prev.specifications.map((spec, i) =>
        i === index ? { ...spec, [field]: value } : spec
      )
    }));
  };

  const addSpecification = () => {
    setFormData(prev => ({
      ...prev,
      specifications: [...prev.specifications, { key: '', value: '' }]
    }));
  };

  const removeSpecification = (index: number) => {
    setFormData(prev => ({
      ...prev,
      specifications: prev.specifications.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);

    console.log('Form submission started', { product: product?.id, formData, brandValue: formData.brand });

    try {
      // Ensure formData is properly initialized
      if (!formData) {
        toast.error('Form data is not properly initialized. Resetting form...');
        resetFormData();
        setLoading(false);
        return;
      }
      // Validate required fields
      if (!formData.name?.trim()) {
        console.log('Validation failed: Product name is required');
        toast.error('Product name is required');
        setLoading(false);
        return;
      }
      if (!formData.brand?.trim()) {
        console.log('Validation failed: Brand is required', { brand: formData.brand, showCustomBrand });
        toast.error('Brand is required');
        setLoading(false);
        return;
      }
      if (!formData.price || formData.price <= 0) {
        console.log('Validation failed: Price must be greater than 0');
        toast.error('Price must be greater than 0');
        setLoading(false);
        return;
      }

      // Validate variants
      for (let i = 0; i < formData.variants.length; i++) {
        const variant = formData.variants[i];
        if (!variant.variant_name?.trim()) {
          toast.error(`Variant ${i + 1}: Name is required`);
          return;
        }
        if (!variant.price || variant.price <= 0) {
          toast.error(`Variant ${i + 1}: Price must be greater than 0`);
          return;
        }
        if (variant.stock < 0) {
          toast.error(`Variant ${i + 1}: Stock cannot be negative`);
          return;
        }
      }

      // Prepare data for submission
      const specifications = formData.specifications
        .filter(spec => spec.key && spec.value)
        .reduce((acc, spec) => ({ ...acc, [spec.key]: spec.value }), {});

      // Generate unique slug
      const baseSlug = formData.slug?.trim() || generateSlug(formData.name);
      const uniqueSlug = await generateUniqueSlug(baseSlug, product?.id);

      // Auto-fill SEO where possible
      const computedMetaTitle = formData.meta_title?.trim() || `${formData.name} | ${formData.brand} | Premium Quality`;
      const computedMetaDescription = formData.meta_description?.trim() || `Buy ${formData.name} from ${formData.brand} for ₹${formData.price}. Premium quality, fast delivery, authentic products. Order now!`;
      const computedCanonical = formData.canonical_url?.trim() || `https://cigarro.in/product/${uniqueSlug}`;
      const computedOgTitle = formData.og_title?.trim() || computedMetaTitle;
      const computedOgDescription = formData.og_description?.trim() || computedMetaDescription;
      const computedOgImage = (formData.og_image?.trim() || formData.gallery_images?.[0] || '').toString();
      const computedTwitterTitle = formData.twitter_title?.trim() || computedMetaTitle;
      const computedTwitterDescription = formData.twitter_description?.trim() || computedMetaDescription;
      const computedTwitterImage = (formData.twitter_image?.trim() || formData.gallery_images?.[0] || '').toString();

      const productData = {
        name: formData.name?.trim() || '',
        slug: uniqueSlug,
        brand: formData.brand?.trim() || '',
        price: Number(formData.price) || 0,
        description: formData.description?.trim() || null,
        stock: Number(formData.stock) || 0,
        is_active: Boolean(formData.is_active),
        rating: Number(formData.rating) || 0,
        review_count: Number(formData.review_count) || 0,
        origin: formData.origin?.trim() || null,
        pack_size: formData.pack_size?.trim() || null,
        specifications: Object.keys(specifications).length > 0 ? specifications : null,
        gallery_images: formData.gallery_images || [],
        meta_title: computedMetaTitle,
        meta_description: computedMetaDescription,
        meta_keywords: formData.meta_keywords?.trim() || null,
        canonical_url: computedCanonical,
        og_title: computedOgTitle,
        og_description: computedOgDescription,
        og_image: computedOgImage || null,
        twitter_title: computedTwitterTitle,
        twitter_description: computedTwitterDescription,
        twitter_image: computedTwitterImage || null,
        image_alt_text: formData.image_alt_text?.trim() || null,
        structured_data: formData.structured_data || {}
      };

      let error;
      let currentProductId: string | undefined = product?.id;
      
      if (product) {
        // Update existing product
        console.log('Updating product:', product.id, productData);
        const { error: updateError } = await supabase
          .from('products')
          .update(productData)
          .eq('id', product.id);
        error = updateError;
        console.log('Update result:', { error: updateError });
      } else {
        // Create new product and get id
        const { error: insertError, data: inserted } = await supabase
          .from('products')
          .insert([productData])
          .select('id')
          .single();
        error = insertError;
        currentProductId = inserted?.id;
      }

      if (error) {
        console.error('Database error:', error);
        throw new Error(`Database error: ${error.message || 'Unknown error'}`);
      }

      // Save variants, collect IDs
      let savedVariantIds: string[] = [];
      if (formData.variants.length > 0 && currentProductId) {
        try {
          savedVariantIds = await saveProductVariants(currentProductId, formData.variants);
        } catch (variantError) {
          console.error('Error saving variants:', variantError);
          const errorMessage = variantError instanceof Error ? variantError.message : 'Unknown error';
          throw new Error(`Failed to save variants: ${errorMessage}`);
        }
      }

      // Save product images and variant assignments
      if (currentProductId) {
        try {
          console.log('Saving product images:', { currentProductId, savedVariantIds, images: formData.gallery_images });
          await saveProductImages(currentProductId, savedVariantIds);
          console.log('Images saved successfully');
        } catch (imageError) {
          console.error('Error saving images:', imageError);
          // Don't throw here as images are not critical for basic functionality
          toast.warning('Product saved but there was an issue with images');
        }
      }

      // Update form data with the unique slug
      setFormData(prev => ({ ...prev, slug: uniqueSlug }));

      toast.success(product ? 'Product updated successfully' : 'Product created successfully');
      onSave();
    } catch (error) {
      console.error('Error saving product:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save product';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!product || !onDelete) return;
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${product.name}"? This will also delete all variants and cannot be undone.`
    );
    
    if (!confirmDelete) return;

    setLoading(true);
    try {
      // Delete all variants first
      const { error: variantsError } = await supabase
        .from('product_variants')
        .delete()
        .eq('product_id', product.id);

      if (variantsError) throw variantsError;

      // Delete the product
      const { error: productError } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      if (productError) throw productError;

      toast.success('Product deleted successfully');
      onDelete();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    } finally {
      setLoading(false);
    }
  };

  const saveProductVariants = async (productId: string, variants: VariantFormData[]): Promise<string[]> => {
    try {
      const ids: string[] = [];
      
      for (const variant of variants) {
        // Generate variant slug if not provided
        const variantSlug = variant.variant_slug || (variant.variant_name || 'variant')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');

        const variantData = {
          product_id: productId,
          variant_name: variant.variant_name?.trim() || '',
          variant_type: variant.variant_type || 'packaging',
          variant_slug: variantSlug,
          price: Number(variant.price) || 0,
          stock: Number(variant.stock) || 0,
          weight: variant.weight ? Number(variant.weight) : null,
          dimensions: variant.dimensions || null,
          attributes: (variant.attributes || []).reduce((acc, attr) => {
            if (attr?.key && attr?.value) acc[attr.key.trim()] = attr.value.trim();
            return acc;
          }, {} as Record<string, string>),
          is_active: Boolean(variant.is_active),
          sort_order: Number(variant.sort_order) || 0,
          meta_title: variant.meta_title?.trim() || null,
          meta_description: variant.meta_description?.trim() || null,
          meta_keywords: variant.meta_keywords?.trim() || null,
          og_title: variant.og_title?.trim() || null,
          og_description: variant.og_description?.trim() || null,
          structured_data: variant.structured_data || {}
        };

        if (variant.id) {
          // Update existing variant
          const { error: updateError } = await supabase
            .from('product_variants')
            .update(variantData)
            .eq('id', variant.id);
          
          if (updateError) {
            console.error('Error updating variant:', updateError);
            throw new Error(`Failed to update variant "${variant.variant_name}": ${updateError.message}`);
          }
          ids.push(variant.id);
        } else {
          // Create new variant
          const { error: insertError, data: newVariant } = await supabase
            .from('product_variants')
            .insert(variantData)
            .select('id')
            .single();
          
          if (insertError) {
            console.error('Error creating variant:', insertError);
            throw new Error(`Failed to create variant "${variant.variant_name}": ${insertError.message}`);
          }
          
          if (newVariant?.id) {
            ids.push(newVariant.id);
          } else {
            throw new Error(`Failed to get ID for new variant "${variant.variant_name}"`);
          }
        }
      }
      return ids;
    } catch (error) {
      console.error('Error saving variants:', error);
      throw error;
    }
  };

  // Save product-level images and assign to variants
  const saveProductImages = async (productId: string, variantIds: string[]) => {
    try {
      // Only proceed if there are images to save
      if (!formData.gallery_images || formData.gallery_images.length === 0) {
        return;
      }

      // Clear existing product-level images
      const { error: deleteError } = await supabase
        .from('variant_images')
        .delete()
        .eq('product_id', productId);
      
      if (deleteError) {
        console.warn('Warning: Could not clear existing product images:', deleteError);
      }

      // Insert product-level images; first image is primary
      for (let i = 0; i < formData.gallery_images.length; i++) {
        const url = formData.gallery_images[i];
        if (!url || url.trim() === '') continue;
        
        const { error: insertError } = await supabase.from('variant_images').insert({
          product_id: productId,
          image_url: url.trim(),
          title: formData.meta_title || formData.name,
          alt_text: formData.image_alt_text || formData.name,
          caption: formData.description?.slice(0, 120) || formData.name,
          meta_description: formData.meta_description,
          lazy_load: true,
          sort_order: i,
          is_primary: i === 0
        });
        
        if (insertError) {
          console.warn(`Warning: Could not save image ${i + 1}:`, insertError);
        }
      }

      // Clear existing images for these variants, then assign
      if (variantIds.length > 0) {
        const { error: variantDeleteError } = await supabase
          .from('variant_images')
          .delete()
          .in('variant_id', variantIds);
        
        if (variantDeleteError) {
          console.warn('Warning: Could not clear existing variant images:', variantDeleteError);
        }
      }

      // Assign selected images per variant (fallback to product primary if none selected)
      for (let idx = 0; idx < formData.variants.length; idx++) {
        const v = formData.variants[idx];
        const vid = v.id || variantIds[idx];
        if (!vid) continue;
        
        const assigned = imageAssignments[idx] || [];
        const urlsToAssign = assigned.length > 0 ? assigned : (formData.gallery_images[0] ? [formData.gallery_images[0]] : []);
        
        for (const url of urlsToAssign) {
          if (!url || url.trim() === '') continue;
          
          const { error: variantImageError } = await supabase.from('variant_images').insert({
            variant_id: vid,
            image_url: url.trim(),
            title: formData.meta_title || formData.name,
            alt_text: formData.image_alt_text || formData.name,
            caption: formData.description?.slice(0, 120) || formData.name,
            meta_description: formData.meta_description,
            lazy_load: true,
            sort_order: 0,
            is_primary: false
          });
          
          if (variantImageError) {
            console.warn(`Warning: Could not assign image to variant ${v.variant_name}:`, variantImageError);
          }
        }
      }
    } catch (error) {
      console.error('Error saving product images:', error);
      throw error;
    }
  };

  const handleDeleteVariant = async (variantId: string, variantName: string) => {
    if (!variantId) {
      // Remove from local state if it's a new variant
      setFormData(prev => ({
        ...prev,
        variants: prev.variants.filter((_, i) => i !== formData.variants.findIndex(v => v.variant_name === variantName))
      }));
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete the variant "${variantName}"? This cannot be undone.`
    );
    
    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from('product_variants')
        .delete()
        .eq('id', variantId);

      if (error) throw error;

      setFormData(prev => ({
        ...prev,
        variants: prev.variants.filter(v => v.id !== variantId)
      }));

      toast.success('Variant deleted successfully');
    } catch (error) {
      console.error('Error deleting variant:', error);
      toast.error('Failed to delete variant');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 admin-form">
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-coyote/20">
          <TabsTrigger value="general" className="data-[state=active]:bg-canyon data-[state=active]:text-creme">General Info</TabsTrigger>
          <TabsTrigger value="variants" className="data-[state=active]:bg-canyon data-[state=active]:text-creme">Variants</TabsTrigger>
          <TabsTrigger value="media" className="data-[state=active]:bg-canyon data-[state=active]:text-creme">Media & Images</TabsTrigger>
          <TabsTrigger value="seo" className="data-[state=active]:bg-canyon data-[state=active]:text-creme">SEO</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card className="bg-creme-light border-coyote">
            <CardHeader>
              <CardTitle className="text-dark">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name" className="text-dark font-medium">Product Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Enter product name"
                    className="bg-creme border-coyote text-dark placeholder:text-dark/50 focus:border-canyon focus:ring-canyon"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="slug">URL Slug</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="product-url-slug"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="brand">Brand *</Label>
                  {showCustomBrand ? (
                    <div className="space-y-2">
                      <Input
                        value={formData.brand}
                        onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                        placeholder="Enter custom brand name"
                        className="bg-creme border-coyote text-dark focus:border-canyon focus:ring-canyon"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowCustomBrand(false);
                          // Keep the current brand value when going back to dropdown
                        }}
                        className="text-xs text-canyon hover:bg-canyon/10"
                      >
                        ← Back to brand list
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={formData.brand}
                      onValueChange={(value: string) => {
                        if (value === 'custom') {
                          setShowCustomBrand(true);
                          // Don't clear the brand field when switching to custom
                        } else {
                          setFormData(prev => ({ ...prev, brand: value }));
                        }
                      }}
                    >
                      <SelectTrigger className="bg-creme border-coyote text-dark focus:border-canyon focus:ring-canyon">
                        <SelectValue placeholder="Select brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {brands.map(brand => (
                          <SelectItem key={brand.id} value={brand.name}>
                            {brand.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom">+ Add Custom Brand</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div>
                  <Label htmlFor="price">Price (₹) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price ?? ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    placeholder="Enter price"
                    className="bg-creme border-coyote text-dark placeholder:text-dark/50"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter product description"
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="stock">Stock Quantity</Label>
                  <Input
                    id="stock"
                    type="number"
                    value={formData.stock ?? ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, stock: parseInt(e.target.value) || 0 }))}
                    placeholder="Enter stock quantity"
                    className="bg-creme border-coyote text-dark placeholder:text-dark/50"
                  />
                </div>
                <div>
                  <Label htmlFor="rating">Rating</Label>
                  <Input
                    id="rating"
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={formData.rating ?? ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, rating: parseFloat(e.target.value) || 0 }))}
                    placeholder="Enter rating"
                    className="bg-creme border-coyote text-dark placeholder:text-dark/50"
                  />
                </div>
                <div>
                  <Label htmlFor="review_count">Review Count</Label>
                  <Input
                    id="review_count"
                    type="number"
                    value={formData.review_count ?? ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, review_count: parseInt(e.target.value) || 0 }))}
                    placeholder="Enter review count"
                    className="bg-creme border-coyote text-dark placeholder:text-dark/50"
                  />
                </div>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="variants" className="space-y-4">
          <Card className="bg-creme-light border-coyote">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-dark">Product Variants</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newVariant: VariantFormData = {
                      variant_name: '',
                      variant_slug: '',
                      variant_type: 'packaging',
                      price: formData.price,
                      stock: 0,
                      attributes: [{ key: '', value: '' }],
                      is_active: true,
                      sort_order: formData.variants.length,
                      // Initialize SEO fields to prevent controlled/uncontrolled input warnings
                      meta_title: '',
                      meta_description: '',
                      meta_keywords: '',
                      og_title: '',
                      og_description: '',
                      structured_data: {},
                      assigned_image_ids: []
                    };
                    setFormData(prev => ({
                      ...prev,
                      variants: [...prev.variants, newVariant]
                    }));
                  }}
                  className="border-canyon text-canyon hover:bg-canyon/10"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Variant
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {formData.variants.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-dark/60 mb-4">No variants created yet</p>
                  <p className="text-sm text-dark/50">
                    Create different variations of this product (size, color, etc.)
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {formData.variants.map((variant, index) => (
                    <div key={index} className="p-6 border-2 border-coyote rounded-xl bg-creme shadow-sm">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-canyon text-white rounded-full flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </div>
                          <div>
                            <h4 className="font-semibold text-dark text-lg">
                              {variant.variant_name || 'Unnamed Variant'}
                            </h4>
                            <p className="text-sm text-dark/60 capitalize">
                              {variant.variant_type} • {variant.is_active ? 'Active' : 'Inactive'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={variant.is_active ? "default" : "secondary"}>
                            {variant.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteVariant(variant.id || '', variant.variant_name)}
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <Label className="text-dark font-semibold mb-2 block">Variant Name *</Label>
                            <Input
                              value={variant.variant_name}
                              onChange={(e) => {
                                const newVariants = [...formData.variants];
                                newVariants[index].variant_name = e.target.value;
                                // Auto-generate slug
                                newVariants[index].variant_slug = e.target.value
                                  .toLowerCase()
                                  .replace(/[^a-z0-9]+/g, '-')
                                  .replace(/(^-|-$)/g, '');
                                setFormData(prev => ({ ...prev, variants: newVariants }));
                              }}
                              placeholder="e.g., Large, Red, Premium"
                              className="bg-white border-coyote text-dark focus:ring-2 focus:ring-canyon/20"
                            />
                          </div>
                          <div>
                            <Label className="text-dark font-semibold mb-2 block">Variant Type *</Label>
                            <Select
                              value={variant.variant_type}
                              onValueChange={(value: 'packaging' | 'color' | 'size' | 'material' | 'flavor' | 'other') => {
                                const newVariants = [...formData.variants];
                                newVariants[index].variant_type = value;
                                setFormData(prev => ({ ...prev, variants: newVariants }));
                              }}
                            >
                              <SelectTrigger className="bg-white border-coyote text-dark focus:ring-2 focus:ring-canyon/20">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="packaging">📦 Packaging</SelectItem>
                                <SelectItem value="color">🎨 Color</SelectItem>
                                <SelectItem value="size">📏 Size</SelectItem>
                                <SelectItem value="material">🧵 Material</SelectItem>
                                <SelectItem value="flavor">🍃 Flavor</SelectItem>
                                <SelectItem value="other">🔧 Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div>
                            <Label className="text-dark font-semibold mb-2 block">Price (₹) *</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark/60">₹</span>
                              <Input
                                type="number"
                                step="0.01"
                                value={variant.price ?? ''}
                                onChange={(e) => {
                                  const newVariants = [...formData.variants];
                                  newVariants[index].price = parseFloat(e.target.value) || 0;
                                  setFormData(prev => ({ ...prev, variants: newVariants }));
                                }}
                                placeholder="0.00"
                                className="bg-white border-coyote text-dark placeholder:text-dark/50 pl-8 focus:ring-2 focus:ring-canyon/20"
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-dark font-semibold mb-2 block">Stock Quantity *</Label>
                            <Input
                              type="number"
                              value={variant.stock ?? ''}
                              onChange={(e) => {
                                const newVariants = [...formData.variants];
                                newVariants[index].stock = parseInt(e.target.value) || 0;
                                setFormData(prev => ({ ...prev, variants: newVariants }));
                              }}
                              placeholder="0"
                              className="bg-white border-coyote text-dark placeholder:text-dark/50 focus:ring-2 focus:ring-canyon/20"
                            />
                          </div>
                          <div className="flex items-end">
                            <div className="flex items-center space-x-3 w-full">
                              <Switch
                                checked={variant.is_active}
                                onCheckedChange={(checked: boolean) => {
                                  const newVariants = [...formData.variants];
                                  newVariants[index].is_active = checked;
                                  setFormData(prev => ({ ...prev, variants: newVariants }));
                                }}
                                className="data-[state=checked]:bg-canyon"
                              />
                              <Label className="text-dark font-semibold">Active</Label>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-dark font-medium">Attributes</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newVariants = [...formData.variants];
                              newVariants[index].attributes.push({ key: '', value: '' });
                              setFormData(prev => ({ ...prev, variants: newVariants }));
                            }}
                            className="text-canyon hover:bg-canyon/10"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Attribute
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {variant.attributes.map((attr, attrIndex) => (
                            <div key={attrIndex} className="flex gap-2">
                              <Input
                                placeholder="Attribute (e.g., Size)"
                                value={attr.key}
                                onChange={(e) => {
                                  const newVariants = [...formData.variants];
                                  newVariants[index].attributes[attrIndex].key = e.target.value;
                                  setFormData(prev => ({ ...prev, variants: newVariants }));
                                }}
                                className="bg-creme border-coyote text-dark"
                              />
                              <Input
                                placeholder="Value (e.g., Large)"
                                value={attr.value}
                                onChange={(e) => {
                                  const newVariants = [...formData.variants];
                                  newVariants[index].attributes[attrIndex].value = e.target.value;
                                  setFormData(prev => ({ ...prev, variants: newVariants }));
                                }}
                                className="bg-creme border-coyote text-dark"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newVariants = [...formData.variants];
                                  newVariants[index].attributes = newVariants[index].attributes.filter((_, i) => i !== attrIndex);
                                  setFormData(prev => ({ ...prev, variants: newVariants }));
                                }}
                                disabled={variant.attributes.length === 1}
                                className="text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Separator className="bg-coyote my-4" />

                      {/* Variant SEO */}
                      <div>
                        <h5 className="font-medium text-dark mb-3">Variant SEO</h5>
                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <Label className="text-xs text-dark">Meta Title</Label>
                            <Input
                              value={variant.meta_title ?? ''}
                              onChange={(e) => {
                                const newVariants = [...formData.variants];
                                newVariants[index].meta_title = e.target.value;
                                setFormData(prev => ({ ...prev, variants: newVariants }));
                              }}
                              placeholder="SEO title for this variant"
                              className="bg-creme border-coyote text-dark text-xs"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-dark">Meta Description</Label>
                            <Textarea
                              value={variant.meta_description ?? ''}
                              onChange={(e) => {
                                const newVariants = [...formData.variants];
                                newVariants[index].meta_description = e.target.value;
                                setFormData(prev => ({ ...prev, variants: newVariants }));
                              }}
                              placeholder="SEO description for this variant"
                              className="bg-creme border-coyote text-dark text-xs"
                              rows={2}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="media" className="space-y-4">
          <Card className="bg-creme-light border-coyote">
            <CardHeader>
              <CardTitle className="text-dark">Product Images</CardTitle>
            </CardHeader>
            <CardContent>
              <MultipleImageUpload
                imageUrls={formData.gallery_images}
                onImageUrlsChange={(images: string[]) => setFormData(prev => ({ ...prev, gallery_images: images }))}
                showSelector={true}
                title="Product Gallery"
                description="Upload product images (up to 10 images)"
              />
              <div className="mt-4">
                <Label htmlFor="image_alt_text" className="text-dark font-medium">Default Image Alt Text</Label>
                <Input
                  id="image_alt_text"
                  value={formData.image_alt_text}
                  onChange={(e) => setFormData(prev => ({ ...prev, image_alt_text: e.target.value }))}
                  placeholder="Alt text for product images"
                  className="bg-creme border-coyote text-dark placeholder:text-dark/50"
                />
              </div>

              {/* Variant Image Assignment */}
              {formData.variants.length > 0 && (
                <div className="mt-6">
                  <Separator className="bg-coyote mb-4" />
                  <h4 className="text-dark font-semibold mb-2">Assign Images to Variants</h4>
                  <p className="text-sm text-dark/70 mb-4">
                    Select which product images should be shown for each variant. If none are selected, the first product image will be used automatically.
                  </p>
                  <div className="space-y-4">
                    {formData.variants.map((v, vIndex) => (
                      <div key={vIndex} className="border border-coyote/40 rounded-lg p-3 bg-creme/60">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-dark">
                            {v.variant_name || `Variant ${vIndex + 1}`}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setImageAssignments(prev => ({ ...prev, [vIndex]: [] }));
                            }}
                            className="text-canyon hover:bg-canyon/10"
                          >
                            Clear Selection
                          </Button>
                        </div>
                        {formData.gallery_images.length === 0 ? (
                          <p className="text-sm text-dark/60">No images uploaded yet.</p>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {formData.gallery_images.map((url, imgIdx) => {
                              const selected = (imageAssignments[vIndex] || []).includes(url);
                              return (
                                <label key={imgIdx} className={`flex items-center gap-2 border rounded-md p-2 cursor-pointer ${selected ? 'border-canyon bg-canyon/10' : 'border-coyote/40'}`}>
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={(e) => {
                                      setImageAssignments(prev => {
                                        const current = prev[vIndex] || [];
                                        let next: string[];
                                        if (e.target.checked) {
                                          next = Array.from(new Set([...current, url]));
                                        } else {
                                          next = current.filter(u => u !== url);
                                        }
                                        return { ...prev, [vIndex]: next };
                                      });
                                    }}
                                  />
                                  <span className="truncate text-xs" title={url}>{url}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                        {!(imageAssignments[vIndex] && imageAssignments[vIndex].length) && (
                          <p className="text-xs text-dark/60 mt-2">No images selected. Will use the first product image.</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seo" className="space-y-4">
          <Card className="bg-creme-light border-coyote">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-dark">SEO Optimization</CardTitle>
                <Badge variant="outline" className="bg-canyon/10 text-canyon border-canyon">
                  Score: {calculateSEOScore()}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic SEO */}
              <div className="space-y-4">
                <h4 className="font-medium text-dark flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Basic SEO
                </h4>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="meta_title" className="text-dark font-medium">Meta Title *</Label>
                    <Input
                      id="meta_title"
                      value={formData.meta_title}
                      onChange={(e) => setFormData(prev => ({ ...prev, meta_title: e.target.value }))}
                      placeholder="SEO title for search engines (50-60 characters)"
                      className="bg-creme border-coyote text-dark placeholder:text-dark/50"
                      maxLength={60}
                    />
                    <p className="text-xs text-dark/60 mt-1">{formData.meta_title.length}/60 characters</p>
                  </div>
                  <div>
                    <Label htmlFor="meta_description" className="text-dark font-medium">Meta Description *</Label>
                    <Textarea
                      id="meta_description"
                      value={formData.meta_description}
                      onChange={(e) => setFormData(prev => ({ ...prev, meta_description: e.target.value }))}
                      placeholder="SEO description for search engines (150-160 characters)"
                      className="bg-creme border-coyote text-dark placeholder:text-dark/50"
                      rows={3}
                      maxLength={160}
                    />
                    <p className="text-xs text-dark/60 mt-1">{formData.meta_description.length}/160 characters</p>
                  </div>
                  <div>
                    <Label htmlFor="meta_keywords" className="text-dark font-medium">Meta Keywords</Label>
                    <Input
                      id="meta_keywords"
                      value={formData.meta_keywords}
                      onChange={(e) => setFormData(prev => ({ ...prev, meta_keywords: e.target.value }))}
                      placeholder="keyword1, keyword2, keyword3"
                      className="bg-creme border-coyote text-dark placeholder:text-dark/50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="canonical_url" className="text-dark font-medium">Canonical URL</Label>
                    <Input
                      id="canonical_url"
                      value={formData.canonical_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, canonical_url: e.target.value }))}
                      placeholder="https://example.com/products/product-name"
                      className="bg-creme border-coyote text-dark placeholder:text-dark/50"
                    />
                  </div>
                </div>
              </div>

              <Separator className="bg-coyote" />

              {/* Open Graph */}
              <div className="space-y-4">
                <h4 className="font-medium text-dark flex items-center gap-2">
                  <Eye className="h-4 w-4 text-blue-600" />
                  Open Graph (Social Media)
                </h4>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="og_title" className="text-dark font-medium">OG Title</Label>
                    <Input
                      id="og_title"
                      value={formData.og_title}
                      onChange={(e) => setFormData(prev => ({ ...prev, og_title: e.target.value }))}
                      placeholder="Title for social media sharing"
                      className="bg-creme border-coyote text-dark placeholder:text-dark/50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="og_description" className="text-dark font-medium">OG Description</Label>
                    <Textarea
                      id="og_description"
                      value={formData.og_description}
                      onChange={(e) => setFormData(prev => ({ ...prev, og_description: e.target.value }))}
                      placeholder="Description for social media sharing"
                      className="bg-creme border-coyote text-dark placeholder:text-dark/50"
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label htmlFor="og_image" className="text-dark font-medium">OG Image URL</Label>
                    <Input
                      id="og_image"
                      value={formData.og_image}
                      onChange={(e) => setFormData(prev => ({ ...prev, og_image: e.target.value }))}
                      placeholder="Image URL for social media sharing"
                      className="bg-creme border-coyote text-dark placeholder:text-dark/50"
                    />
                  </div>
                </div>
              </div>

              <Separator className="bg-coyote" />

              {/* Twitter Cards */}
              <div className="space-y-4">
                <h4 className="font-medium text-dark flex items-center gap-2">
                  <Star className="h-4 w-4 text-blue-400" />
                  Twitter Cards
                </h4>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="twitter_title" className="text-dark font-medium">Twitter Title</Label>
                    <Input
                      id="twitter_title"
                      value={formData.twitter_title}
                      onChange={(e) => setFormData(prev => ({ ...prev, twitter_title: e.target.value }))}
                      placeholder="Title for Twitter cards"
                      className="bg-creme border-coyote text-dark placeholder:text-dark/50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="twitter_description" className="text-dark font-medium">Twitter Description</Label>
                    <Textarea
                      id="twitter_description"
                      value={formData.twitter_description}
                      onChange={(e) => setFormData(prev => ({ ...prev, twitter_description: e.target.value }))}
                      placeholder="Description for Twitter cards"
                      className="bg-creme border-coyote text-dark placeholder:text-dark/50"
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label htmlFor="twitter_image" className="text-dark font-medium">Twitter Image URL</Label>
                    <Input
                      id="twitter_image"
                      value={formData.twitter_image}
                      onChange={(e) => setFormData(prev => ({ ...prev, twitter_image: e.target.value }))}
                      placeholder="Image URL for Twitter cards"
                      className="bg-creme border-coyote text-dark placeholder:text-dark/50"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-between pt-6 border-t border-coyote">
        {/* Delete button - only show when editing existing product */}
        <div>
          {product && onDelete && (
            <Button 
              type="button" 
              variant="destructive" 
              onClick={handleDeleteProduct}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {loading ? 'Deleting...' : 'Delete Product'}
            </Button>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex space-x-3">
          <Button type="button" variant="outline" onClick={onCancel} className="border-coyote text-dark hover:bg-coyote/20">
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button 
            type="button" 
            disabled={loading} 
            className="bg-canyon hover:bg-canyon/90 text-creme"
            onClick={(e) => {
              console.log('Button clicked, calling handleSubmit manually');
              handleSubmit(e as any);
            }}
          >
            <Save className="mr-2 h-4 w-4" />
            {loading ? 'Saving...' : product ? 'Update Product' : 'Create Product'}
          </Button>
        </div>
      </div>
    </form>
  );
}
