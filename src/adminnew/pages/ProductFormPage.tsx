import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Plus, Trash2, X, Package, Box, Info, Search } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { AdminCard, AdminCardContent, AdminCardHeader, AdminCardTitle } from '../components/shared/AdminCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { MultipleImagePicker } from '../components/shared/ImagePicker';
import { ProductImageSearchModal } from '../components/shared/ProductImageSearchModal';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { PageHeader } from '../components/shared/PageHeader';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';
import { formatINR } from '../../utils/currency';
import { ProductFormData, VariantFormData, Brand, Category, generateSlug, calculateProfitMargin } from '../../types/product';

interface ProductFormPageProps { }

export function ProductFormPage({ }: ProductFormPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<{ id: string; title: string }[]>([]);
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [deletedVariantIds, setDeletedVariantIds] = useState<string[]>([]);
  const [imageSearchOpen, setImageSearchOpen] = useState(false);
  const [imageSearchVariantIndex, setImageSearchVariantIndex] = useState<number | null>(null);

  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    slug: '',
    brand_id: '',
    description: '',
    short_description: '',
    is_active: true,
    collections: [],
    categories: [],
    origin: '',
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
      images: [],
      compare_at_price: 0,
      cost_price: 0
    }],
    meta_title: '',
    meta_description: '',
    canonical_url: ''
  });

  useEffect(() => {
    loadBrands();
    loadCategories();
    loadCollections();
    if (isEditMode) {
      loadProduct();
      setIsSlugManuallyEdited(true);
    }
  }, [id]);

  useEffect(() => {
    setIsDirty(true);
  }, [formData]);

  useEffect(() => {
    setIsDirty(false);
  }, []);

  const loadBrands = async () => {
    const { data } = await supabase
      .from('brands')
      .select('*')
      .eq('is_active', true)
      .order('name');
    setBrands(data || []);
  };

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error loading categories:', error);
      return;
    }
    setCategories(data || []);
  };

  const loadCollections = async () => {
    const { data } = await supabase
      .from('collections')
      .select('id, title')
      .eq('is_active', true)
      .order('title');
    setCollections(data || []);
  };

  const loadProduct = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, product_variants(*)')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Load category associations
      const { data: categoryData } = await supabase
        .from('product_categories')
        .select('category_id')
        .eq('product_id', id);

      const categoryIds = categoryData?.map(c => c.category_id) || [];

      // Load collection associations
      const { data: collectionData } = await supabase
        .from('collection_products')
        .select('collection_id')
        .eq('product_id', id);

      const collectionIds = collectionData?.map(c => c.collection_id) || [];

      const mappedData: ProductFormData = {
        name: data.name || '',
        slug: data.slug || '',
        brand_id: data.brand_id || '',
        description: data.description || '',
        short_description: data.short_description || '',
        is_active: data.is_active !== false,
        collections: collectionIds,
        categories: categoryIds,
        origin: data.origin || '',
        specifications: data.specifications
          ? Object.entries(data.specifications).map(([key, value]) => ({ key, value: String(value) }))
          : [],
        variants: data.product_variants?.map((v: any) => ({
          id: v.id,
          variant_name: v.variant_name,
          variant_slug: v.variant_slug,
          variant_type: v.variant_type || 'pack',
          is_default: v.is_default || false,
          units_contained: v.units_contained || 20,
          unit: v.unit || 'sticks',
          images: v.images || [],
          price: v.price,
          compare_at_price: v.compare_at_price,
          cost_price: v.cost_price,
          stock: v.stock || 0,
          track_inventory: v.track_inventory ?? true,
          is_active: v.is_active
        })) || [{
          variant_name: 'Packet',
          variant_type: 'pack',
          units_contained: 20,
          unit: 'sticks',
          price: 0,
          stock: 0,
          track_inventory: true,
          is_active: true,
          is_default: true,
          images: [],
          compare_at_price: 0,
          cost_price: 0
        }],
        meta_title: data.meta_title || '',
        meta_description: data.meta_description || '',
        canonical_url: data.canonical_url || ''
      };

      setFormData(mappedData);
    } catch (error) {
      console.error('Error loading product:', error);
      toast.error('Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({ ...prev, name }));
    // Auto-generate slug only if not manually edited
    if (!isSlugManuallyEdited) {
      setFormData(prev => ({ ...prev, slug: generateSlug(name) }));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSlugManuallyEdited(true);
    setFormData(prev => ({ ...prev, slug: generateSlug(e.target.value) }));
  };

  const handleChange = (updates: Partial<ProductFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const addVariant = (type: 'carton' | 'custom') => {
    const basePrice = formData.variants.find(v => v.is_default)?.price || 0;
    const isFirstVariant = formData.variants.length === 0;

    let newVariant: VariantFormData = {
      variant_name: '',
      variant_type: 'pack',
      units_contained: 20,
      unit: 'sticks',
      price: basePrice,
      stock: 0,
      track_inventory: false,
      is_active: true,
      is_default: isFirstVariant,
      images: [],
      compare_at_price: 0,
      cost_price: 0
    };

    if (type === 'carton') {
      newVariant = {
        ...newVariant,
        variant_name: 'Carton',
        variant_type: 'carton',
        units_contained: 10,
        unit: 'packs',
        price: basePrice * 10 * 0.95,
        compare_at_price: basePrice * 10
      };
    } else {
      newVariant = {
        ...newVariant,
        variant_name: 'Custom',
        variant_type: 'pack',
        units_contained: 20
      };
    }

    handleChange({ variants: [...formData.variants, newVariant] });
  };

  const updateVariant = (index: number, updates: Partial<VariantFormData>) => {
    const newVariants = [...formData.variants];

    if (updates.is_default === true) {
      newVariants.forEach((v, i) => {
        if (i !== index && v.is_default) {
          newVariants[i] = { ...v, is_default: false };
        }
      });
    }

    newVariants[index] = { ...newVariants[index], ...updates };
    handleChange({ variants: newVariants });
  };

  const removeVariant = (index: number) => {
    const variantToRemove = formData.variants[index];
    const newVariants = formData.variants.filter((_, i) => i !== index);

    // Track deleted variants for database cleanup
    if (variantToRemove.id) {
      setDeletedVariantIds(prev => [...prev, variantToRemove.id!]);
    }

    if (variantToRemove.is_default && newVariants.length > 0) {
      newVariants[0] = { ...newVariants[0], is_default: true };
    }

    handleChange({ variants: newVariants });
  };

  const addSpecification = () => {
    handleChange({
      specifications: [...formData.specifications, { key: '', value: '' }]
    });
  };

  const updateSpecification = (index: number, field: 'key' | 'value', value: string) => {
    const newSpecs = [...formData.specifications];
    newSpecs[index] = { ...newSpecs[index], [field]: value };
    handleChange({ specifications: newSpecs });
  };

  const removeSpecification = (index: number) => {
    const newSpecs = [...formData.specifications];
    newSpecs.splice(index, 1);
    handleChange({ specifications: newSpecs });
  };

  const handleCategoryToggle = (categoryId: string) => {
    const currentCategories = formData.categories || [];
    const newCategories = currentCategories.includes(categoryId)
      ? currentCategories.filter(id => id !== categoryId)
      : [...currentCategories, categoryId];
    handleChange({ categories: newCategories });
  };

  const handleCollectionToggle = (collectionId: string) => {
    const currentCollections = formData.collections || [];
    const newCollections = currentCollections.includes(collectionId)
      ? currentCollections.filter(id => id !== collectionId)
      : [...currentCollections, collectionId];
    handleChange({ collections: newCollections });
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Product name is required');
      return;
    }

    const defaultVariant = formData.variants.find(v => v.is_default);
    if (!defaultVariant) {
      toast.error('At least one default variant is required');
      return;
    }

    if (defaultVariant.price <= 0) {
      toast.error('Default variant price must be greater than 0');
      return;
    }

    if (!defaultVariant.images || defaultVariant.images.length === 0) {
      toast.error('Default variant must have at least one image');
      return;
    }

    setSaving(true);
    try {
      const productData = {
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        brand_id: formData.brand_id || null,
        description: formData.description.trim(),
        short_description: formData.short_description?.trim() || '',
        is_active: formData.is_active,
        origin: formData.origin?.trim() || '',
        specifications: formData.specifications.reduce((acc, spec) => {
          if (spec.key && spec.value) {
            acc[spec.key] = spec.value;
          }
          return acc;
        }, {} as Record<string, string>),
        meta_title: formData.meta_title?.trim() || formData.name.trim(),
        meta_description: formData.meta_description?.trim() || '',
        canonical_url: formData.canonical_url?.trim() || ''
      };

      if (isEditMode) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', id);

        if (error) throw error;

        // Delete removed variants
        if (deletedVariantIds.length > 0) {
          await supabase
            .from('product_variants')
            .delete()
            .in('id', deletedVariantIds);
        }

        // Update variants
        for (const variant of formData.variants) {
          const variantData = {
            variant_name: variant.variant_name,
            variant_slug: variant.variant_slug,
            variant_type: variant.variant_type,
            is_default: variant.is_default,
            units_contained: variant.units_contained,
            unit: variant.unit,
            images: variant.images,
            price: variant.price,
            compare_at_price: variant.compare_at_price,
            cost_price: variant.cost_price,
            stock: variant.stock,
            track_inventory: variant.track_inventory,
            is_active: variant.is_active
          };

          if (variant.id) {
            await supabase
              .from('product_variants')
              .update(variantData)
              .eq('id', variant.id);
          } else {
            await supabase
              .from('product_variants')
              .insert([{ ...variantData, product_id: id }]);
          }
        }

        // Update category associations
        await supabase
          .from('product_categories')
          .delete()
          .eq('product_id', id);

        if (formData.categories.length > 0) {
          await supabase
            .from('product_categories')
            .insert(
              formData.categories.map(categoryId => ({
                product_id: id,
                category_id: categoryId
              }))
            );
        }

        // Update collection associations
        await supabase
          .from('collection_products')
          .delete()
          .eq('product_id', id);

        if (formData.collections.length > 0) {
          await supabase
            .from('collection_products')
            .insert(
              formData.collections.map(collectionId => ({
                product_id: id,
                collection_id: collectionId
              }))
            );
        }

        toast.success('Product updated successfully');
      } else {
        const { data: newProduct, error } = await supabase
          .from('products')
          .insert([productData])
          .select()
          .single();

        if (error) throw error;

        // Insert variants
        const variantsToInsert = formData.variants.map(variant => ({
          ...variant,
          product_id: newProduct.id
        }));

        await supabase
          .from('product_variants')
          .insert(variantsToInsert);

        // Insert category associations
        if (formData.categories.length > 0) {
          await supabase
            .from('product_categories')
            .insert(
              formData.categories.map(categoryId => ({
                product_id: newProduct.id,
                category_id: categoryId
              }))
            );
        }

        // Insert collection associations
        if (formData.collections.length > 0) {
          await supabase
            .from('collection_products')
            .insert(
              formData.collections.map(collectionId => ({
                product_id: newProduct.id,
                collection_id: collectionId
              }))
            );
        }

        toast.success('Product created successfully');
      }

      navigate('/admin/products');
    } catch (error: any) {
      console.error('Error saving product:', error);
      toast.error(error.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Product deleted successfully');
      navigate('/admin/products');
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    } finally {
      setSaving(false);
    }
  };

  const defaultVariant = formData.variants.find(v => v.is_default);
  const margin = defaultVariant ? calculateProfitMargin(defaultVariant.price, defaultVariant.cost_price) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-creme)] pb-20">
      {/* Header */}
      <PageHeader
        title={formData.name || 'Untitled Product'}
        description={isEditMode ? 'Edit product' : 'Create new product'}
        backUrl="/admin/products"
      >
        <Button
          variant="outline"
          onClick={() => navigate('/admin/products')}
        >
          Cancel
        </Button>
        {isEditMode && (
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={saving}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={saving || !isDirty}
          className="bg-[var(--color-canyon)] hover:bg-[var(--color-canyon)]/90 text-[var(--color-creme)]"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {isEditMode ? 'Update' : 'Create'} Product
            </>
          )}
        </Button>
      </PageHeader>

      <div className="max-w-[1600px] mx-auto px-6 grid grid-cols-[1fr_350px] gap-6 mt-6">

        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Basic Information */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Product Identity</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>

              {/* Title */}
              <div className="space-y-2">
                <Label className="text-[var(--color-dark)] font-medium">
                  Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Marlboro Red (Imported)"
                  className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)] text-lg py-6"
                />
              </div>

              {/* Short Description */}
              <div className="space-y-2">
                <Label className="text-[var(--color-dark)] font-medium">Short Description</Label>
                <Input
                  value={formData.short_description || ''}
                  onChange={(e) => handleChange({ short_description: e.target.value })}
                  placeholder="Brief summary for collection pages..."
                  className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
                />
              </div>

              {/* Slug */}
              <div className="grid grid-cols-[auto_1fr] gap-2 items-center text-sm text-[var(--color-dark)]/60 bg-[var(--color-creme)]/50 p-3 rounded-md border border-[var(--color-coyote)]/30">
                <span className="font-medium">store.cigarro.in/products/</span>
                <input
                  value={formData.slug}
                  onChange={handleSlugChange}
                  className="bg-transparent border-none focus:outline-none text-[var(--color-dark)] font-medium w-full"
                  placeholder="product-slug"
                />
              </div>

              {/* Rich Description */}
              <div className="space-y-2">
                <Label className="text-[var(--color-dark)] font-medium">Description</Label>
                <div className="border-2 border-[var(--color-coyote)] rounded-md bg-[var(--color-creme)]">
                  {/* Toolbar Mockup */}
                  <div className="flex items-center gap-2 p-2 border-b border-[var(--color-coyote)]/50 bg-[var(--color-creme-light)] text-[var(--color-dark)]/70">
                    <button className="p-1 hover:bg-[var(--color-coyote)]/20 rounded"><strong>B</strong></button>
                    <button className="p-1 hover:bg-[var(--color-coyote)]/20 rounded"><em>I</em></button>
                    <button className="p-1 hover:bg-[var(--color-coyote)]/20 rounded"><u>U</u></button>
                    <div className="w-px h-4 bg-[var(--color-coyote)]/50 mx-1" />
                    <button className="p-1 hover:bg-[var(--color-coyote)]/20 rounded">List</button>
                  </div>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => handleChange({ description: e.target.value })}
                    placeholder="Describe the product..."
                    className="border-none shadow-none focus-visible:ring-0 min-h-[200px] bg-transparent"
                  />
                </div>
              </div>
            </AdminCardContent>
          </AdminCard>

          {/* Product DNA */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Product DNA</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>

              <div className="grid grid-cols-2 gap-6">
                {/* Brand */}
                <div className="space-y-2">
                  <Label className="text-[var(--color-dark)] font-medium">
                    Brand <span className="text-red-500">*</span>
                  </Label>
                  <Select value={formData.brand_id} onValueChange={(value) => handleChange({ brand_id: value })}>
                    <SelectTrigger className="bg-[var(--color-creme)] border-[var(--color-coyote)]">
                      <SelectValue placeholder="Select brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map(brand => (
                        <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Origin */}
                <div className="space-y-2">
                  <Label className="text-[var(--color-dark)] font-medium">Origin</Label>
                  <Input
                    value={formData.origin}
                    onChange={(e) => handleChange({ origin: e.target.value })}
                    placeholder="Country of origin"
                    className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)]"
                  />
                </div>
              </div>

              {/* Categories */}
              <div className="space-y-2">
                <Label className="text-[var(--color-dark)] font-medium">Categories</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {categories.length > 0 ? (
                    categories.map(category => (
                      <Badge
                        key={category.id}
                        variant={formData.categories.includes(category.id) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => handleCategoryToggle(category.id)}
                      >
                        {category.name}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--color-dark)]/50">No categories available</p>
                  )}
                </div>
              </div>

              {/* Collections */}
              <div className="space-y-2">
                <Label className="text-[var(--color-dark)] font-medium">Collections</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {collections.length > 0 ? (
                    collections.map(collection => (
                      <Badge
                        key={collection.id}
                        variant={formData.collections.includes(collection.id) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => handleCollectionToggle(collection.id)}
                      >
                        {collection.title}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--color-dark)]/50">No collections available</p>
                  )}
                </div>
              </div>
            </AdminCardContent>
          </AdminCard>

          {/* Specifications */}
          <AdminCard>
            <AdminCardHeader>
              <div className="flex items-center justify-between">
                <AdminCardTitle>Specifications</AdminCardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSpecification}
                  className="h-8 border-[var(--color-coyote)] hover:bg-[var(--color-creme)] text-[var(--color-dark)]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Specification
                </Button>
              </div>
            </AdminCardHeader>
            <AdminCardContent>
              {formData.specifications.map((spec, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Key"
                    value={spec.key}
                    onChange={(e) => updateSpecification(index, 'key', e.target.value)}
                    className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
                  />
                  <Input
                    placeholder="Value"
                    value={spec.value}
                    onChange={(e) => updateSpecification(index, 'value', e.target.value)}
                    className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeSpecification(index)}
                    className="border-[var(--color-coyote)] hover:bg-[var(--color-creme)] text-[var(--color-dark)]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {formData.specifications.length === 0 && (
                <p className="text-gray-500 text-sm">No specifications added</p>
              )}
            </AdminCardContent>
          </AdminCard>

          {/* Variants */}
          <AdminCard>
            <AdminCardHeader className="flex flex-row items-center justify-between">
              <AdminCardTitle>Selling Options</AdminCardTitle>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addVariant('carton')}
                  className="h-8 border-[var(--color-coyote)] hover:bg-[var(--color-creme)] text-[var(--color-dark)]"
                >
                  <Box className="w-4 h-4 mr-2" />
                  Add Carton
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addVariant('custom')}
                  className="h-8 border-[var(--color-coyote)] hover:bg-[var(--color-creme)] text-[var(--color-dark)]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Custom
                </Button>
              </div>
            </AdminCardHeader>
            <AdminCardContent>
              {[...formData.variants]
                .map((variant, originalIndex) => ({ variant, originalIndex }))
                .sort((a, b) => (b.variant.is_default ? 1 : 0) - (a.variant.is_default ? 1 : 0))
                .map(({ variant, originalIndex: index }) => (
                  <AdminCard key={index} className="border-2 border-[var(--color-coyote)]/30">
                    <AdminCardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={variant.is_default}
                            onCheckedChange={(checked) => updateVariant(index, { is_default: checked })}
                          />
                          <Label>Default</Label>
                        </div>
                        {formData.variants.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeVariant(index)}
                            className="border-[var(--color-coyote)] hover:bg-[var(--color-creme)] text-[var(--color-dark)]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Variant Name</Label>
                          <Input
                            value={variant.variant_name}
                            onChange={(e) => updateVariant(index, { variant_name: e.target.value })}
                            placeholder="e.g., Packet, Carton"
                            className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Variant Type</Label>
                          <Select value={variant.variant_type} onValueChange={(value) => updateVariant(index, { variant_type: value })}>
                            <SelectTrigger className="bg-[var(--color-creme)] border-[var(--color-coyote)]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pack">Pack</SelectItem>
                              <SelectItem value="carton">Carton</SelectItem>
                              <SelectItem value="box">Box</SelectItem>
                              <SelectItem value="bundle">Bundle</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Units Contained</Label>
                          <Input
                            type="number"
                            value={variant.units_contained}
                            onChange={(e) => updateVariant(index, { units_contained: parseInt(e.target.value) || 0 })}
                            className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Unit</Label>
                          <Select value={variant.unit} onValueChange={(value) => updateVariant(index, { unit: value })}>
                            <SelectTrigger className="bg-[var(--color-creme)] border-[var(--color-coyote)]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sticks">Sticks</SelectItem>
                              <SelectItem value="packs">Packs</SelectItem>
                              <SelectItem value="pieces">Pieces</SelectItem>
                              <SelectItem value="grams">Grams</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Selling Price *</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-dark)]/50">₹</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={variant.price}
                              onChange={(e) => updateVariant(index, { price: parseFloat(e.target.value) || 0 })}
                              placeholder="0.00"
                              className="pl-8 bg-[var(--color-creme)] border-[var(--color-coyote)]"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Compare at Price</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-dark)]/50">₹</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={variant.compare_at_price || ''}
                              onChange={(e) => updateVariant(index, { compare_at_price: parseFloat(e.target.value) || 0 })}
                              placeholder="0.00"
                              className="pl-8 bg-[var(--color-creme)] border-[var(--color-coyote)]"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Cost Price</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-dark)]/50">₹</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={variant.cost_price || ''}
                              onChange={(e) => updateVariant(index, { cost_price: parseFloat(e.target.value) || 0 })}
                              placeholder="0.00"
                              className="pl-8 bg-[var(--color-creme)] border-[var(--color-coyote)]"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Stock</Label>
                          <Input
                            type="number"
                            value={variant.stock}
                            onChange={(e) => updateVariant(index, { stock: parseInt(e.target.value) || 0 })}
                            className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={variant.track_inventory}
                            onCheckedChange={(checked) => updateVariant(index, { track_inventory: checked })}
                          />
                          <Label>Track Inventory</Label>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Images</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setImageSearchVariantIndex(index);
                              setImageSearchOpen(true);
                            }}
                            className="h-7 text-xs border-[var(--color-coyote)] hover:bg-[var(--color-creme)] text-[var(--color-dark)]"
                          >
                            <Search className="w-3 h-3 mr-1" />
                            Search Images
                          </Button>
                        </div>
                        <MultipleImagePicker
                          value={variant.images}
                          onChange={(imageUrls: string[]) => updateVariant(index, { images: imageUrls })}
                          maxImages={10}
                          searchHint={`${formData.name} cigarette pack`}
                        />
                      </div>
                    </AdminCardContent>
                  </AdminCard>
                ))}
            </AdminCardContent>
          </AdminCard>

          {/* SEO */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>SEO Settings</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <div className="space-y-2">
                <Label htmlFor="meta_title">Meta Title</Label>
                <Input
                  id="meta_title"
                  value={formData.meta_title}
                  onChange={(e) => handleChange({ meta_title: e.target.value })}
                  placeholder="SEO title (defaults to product name)"
                  className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meta_description">Meta Description</Label>
                <Textarea
                  id="meta_description"
                  value={formData.meta_description}
                  onChange={(e) => handleChange({ meta_description: e.target.value })}
                  placeholder="SEO description"
                  rows={3}
                  className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="canonical_url">Canonical URL</Label>
                <Input
                  id="canonical_url"
                  value={formData.canonical_url}
                  onChange={(e) => handleChange({ canonical_url: e.target.value })}
                  placeholder="https://example.com/product"
                  className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
                />
              </div>
            </AdminCardContent>
          </AdminCard>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* Status */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Status</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              <Select
                value={formData.is_active ? 'active' : 'draft'}
                onValueChange={(value: string) => handleChange({ is_active: value === 'active' })}
              >
                <SelectTrigger className="w-full bg-[var(--color-creme)] border-[var(--color-coyote)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      Active
                    </div>
                  </SelectItem>
                  <SelectItem value="draft">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-gray-400" />
                      Draft
                    </div>
                  </SelectItem>
                  <SelectItem value="archived">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-400" />
                      Archived
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </AdminCardContent>
          </AdminCard>

          {/* Pricing */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Pricing</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>

              {!defaultVariant ? (
                <Alert className="bg-amber-50 border-amber-200 text-amber-800">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Add a default variant to set pricing information. All pricing is now managed through variants.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {/* Default Variant Price */}
                  <div className="space-y-2">
                    <Label className="text-xs text-[var(--color-dark)]/60">
                      Default Variant Price <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-dark)]/50">₹</span>
                      <Input
                        type="number"
                        value={defaultVariant.price}
                        onChange={(e) => {
                          const newVariants = [...formData.variants];
                          const index = newVariants.findIndex(v => v.is_default);
                          if (index >= 0) {
                            newVariants[index] = { ...newVariants[index], price: parseFloat(e.target.value) };
                            handleChange({ variants: newVariants });
                          }
                        }}
                        className="pl-8 bg-[var(--color-creme)] border-[var(--color-coyote)]"
                      />
                    </div>
                  </div>

                  {/* Compare At */}
                  <div className="space-y-2">
                    <Label className="text-xs text-[var(--color-dark)]/60">Compare at price</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-dark)]/50">₹</span>
                      <Input
                        type="number"
                        value={defaultVariant.compare_at_price || ''}
                        onChange={(e) => {
                          const newVariants = [...formData.variants];
                          const index = newVariants.findIndex(v => v.is_default);
                          if (index >= 0) {
                            newVariants[index] = { ...newVariants[index], compare_at_price: parseFloat(e.target.value) };
                            handleChange({ variants: newVariants });
                          }
                        }}
                        className="pl-8 bg-[var(--color-creme)] border-[var(--color-coyote)]"
                      />
                    </div>
                  </div>

                  {/* Cost Price & Margin */}
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label className="text-xs text-[var(--color-dark)]/60">Cost per item</Label>
                      {margin !== 0 && (
                        <span className={`text-xs font-medium ${margin > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {margin}% Margin
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-dark)]/50">₹</span>
                      <Input
                        type="number"
                        value={defaultVariant.cost_price || ''}
                        onChange={(e) => {
                          const newVariants = [...formData.variants];
                          const index = newVariants.findIndex(v => v.is_default);
                          if (index >= 0) {
                            newVariants[index] = { ...newVariants[index], cost_price: parseFloat(e.target.value) };
                            handleChange({ variants: newVariants });
                          }
                        }}
                        className="pl-8 bg-[var(--color-creme)] border-[var(--color-coyote)]"
                      />
                    </div>
                  </div>
                </>
              )}
            </AdminCardContent>
          </AdminCard>

          {/* Pricing Summary */}
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Pricing Summary</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent>
              {formData.variants.map((variant, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {variant.is_default && <Badge variant="default">Default</Badge>}
                    <span className="text-sm">{variant.variant_name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatINR(variant.price)}</div>
                    {variant.compare_at_price && variant.compare_at_price > variant.price && (
                      <div className="text-sm text-gray-500 line-through">
                        {formatINR(variant.compare_at_price)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </AdminCardContent>
          </AdminCard>
        </div>
      </div>

      {/* Image Search Modal */}
      <ProductImageSearchModal
        open={imageSearchOpen}
        onClose={() => {
          setImageSearchOpen(false);
          setImageSearchVariantIndex(null);
        }}
        product={formData.name ? {
          id: id || 'new',
          name: formData.name,
          slug: formData.slug,
          brand: brands.find(b => b.id === formData.brand_id)?.name,
          gallery_images: imageSearchVariantIndex !== null
            ? formData.variants[imageSearchVariantIndex]?.images
            : [],
        } : undefined}
        onImagesAdded={(_, urls) => {
          if (imageSearchVariantIndex !== null) {
            const currentImages = formData.variants[imageSearchVariantIndex]?.images || [];
            updateVariant(imageSearchVariantIndex, { images: [...currentImages, ...urls] });
          }
        }}
        mode="single"
      />
    </div>
  );
}
