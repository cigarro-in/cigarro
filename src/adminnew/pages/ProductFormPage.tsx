import { useState, useEffect, useRef } from 'react';
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
import { Req, ReqError, isBlank } from '../components/shared/requiredFields';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { toast } from 'sonner';
import { formatINR } from '../../utils/currency';
import { ProductFormData, VariantFormData, Brand, Category, generateSlug, calculateProfitMargin } from '../../types/product';

interface ProductFormPageProps { }

export function ProductFormPage({ }: ProductFormPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [deletedVariantIds, setDeletedVariantIds] = useState<string[]>([]);
  const [imageSearchOpen, setImageSearchOpen] = useState(false);
  const [imageSearchVariantIndex, setImageSearchVariantIndex] = useState<number | null>(null);

  // Reference lists (public catalog reads) mapped to the {id, name} shapes
  // the dropdowns already expect — supabaseIds flow straight back on save.
  const brandRows = useQuery(api.catalog.listBrands, { activeOnly: false });
  const categoryRows = useQuery(api.catalog.listCategories, {});
  const collectionRows = useQuery(api.catalog.listCollections, {});
  const brands = (brandRows || []).map((b: any) => ({ id: b.supabaseId, name: b.name })) as Brand[];
  const categories = (categoryRows || []).map((c: any) => ({ id: c.supabaseId, name: c.name })) as Category[];
  const collections = (collectionRows || []).map((c: any) => ({ id: c.supabaseId, title: c.title }));
  const saveProduct = useMutation(api.adminCatalog.saveProduct);
  const removeProduct = useMutation(api.adminCatalog.deleteProduct);
  const populatedRef = useRef(false);

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
    canonical_url: '',
    rating_value: null,
    review_count: 0
  });

  // Edit loader: one Convex query (product + variants + join ids).
  const editData = useQuery(
    api.adminCatalog.getProductForEdit,
    isEditMode && id ? { supabaseId: id } : 'skip'
  );
  const loading = isEditMode && editData === undefined;

  useEffect(() => {
    if (isEditMode) setIsSlugManuallyEdited(true);
  }, [id]);

  useEffect(() => {
    setIsDirty(true);
  }, [formData]);

  useEffect(() => {
    setIsDirty(false);
  }, []);

  // Populate once when the edit query resolves (never clobber dirty edits).
  useEffect(() => {
    if (!isEditMode || !editData || populatedRef.current) return;
    populatedRef.current = true;
    if (!editData) {
      toast.error('Product not found');
      navigate('/admin/products');
      return;
    }
    const data: any = editData.product;
    const mappedData: ProductFormData = {
      name: data.name || '',
      slug: data.slug || '',
      brand_id: data.brandSupabaseId || '',
      description: data.description || '',
      short_description: data.shortDescription || '',
      is_active: data.isActive !== false,
      collections: editData.collectionSupabaseIds || [],
      categories: editData.categorySupabaseIds || [],
      origin: data.origin || '',
      specifications: data.specifications
        ? Object.entries(data.specifications).map(([key, value]) => ({ key, value: String(value) }))
        : [],
      variants: editData.variants?.map((v: any) => ({
        id: v.supabaseId,
        variant_name: v.variantName,
        variant_slug: v.variantSlug,
        variant_type: v.variantType || 'pack',
        is_default: v.isDefault || false,
        units_contained: v.unitsContained || 20,
        unit: v.unit || 'sticks',
        images: v.images || [],
        image_alt_text: v.imageAltText || '',
        price: v.priceRupees,
        compare_at_price: v.compareAtPriceRupees,
        cost_price: v.costPriceRupees,
        stock: v.stock || 0,
        track_inventory: v.trackInventory ?? true,
        is_active: v.isActive
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
      meta_title: data.metaTitle || '',
      meta_description: data.metaDescription || '',
      canonical_url: data.canonicalUrl || '',
      rating_value: data.ratingValue ?? null,
      review_count: data.reviewCount ?? 0
    };
    setFormData(mappedData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editData]);

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
    setSaveAttempted(true);
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
      // Imageless products are valid (photos get added later) — confirm instead of blocking,
      // otherwise products created without images can never be saved at all.
      const proceed = window.confirm(
        'Default variant has no images. Product pages without photos rank poorly. Save anyway?'
      );
      if (!proceed) return;
    }

    setSaving(true);
    try {
      // Boundary mapping: form snake_case → Convex camelCase. Ratings ride
      // along (Convex columns exist — no soft-fail dance needed).
      const ratingValue =
        formData.rating_value == null || Number.isNaN(Number(formData.rating_value))
          ? undefined
          : Math.min(5, Math.max(0, Number(formData.rating_value)));
      const reviewCount =
        formData.review_count == null || Number.isNaN(Number(formData.review_count))
          ? undefined
          : Math.max(0, Math.floor(Number(formData.review_count)));

      await saveProduct({
        supabaseId: isEditMode ? id : undefined,
        product: {
          name: formData.name.trim(),
          slug: formData.slug.trim(),
          brandSupabaseId: formData.brand_id || undefined,
          description: formData.description.trim(),
          shortDescription: formData.short_description?.trim() || undefined,
          isActive: formData.is_active,
          origin: formData.origin?.trim() || undefined,
          specifications: formData.specifications.reduce((acc, spec) => {
            if (spec.key && spec.value) acc[spec.key] = spec.value;
            return acc;
          }, {} as Record<string, string>),
          metaTitle: formData.meta_title?.trim() || formData.name.trim(),
          metaDescription: formData.meta_description?.trim() || undefined,
          canonicalUrl: formData.canonical_url?.trim() || undefined,
          ratingValue,
          reviewCount,
        },
        variants: formData.variants.map((variant) => ({
          supabaseId: variant.id,
          variantName: variant.variant_name,
          variantSlug: variant.variant_slug,
          variantType: variant.variant_type,
          isDefault: variant.is_default,
          unitsContained: variant.units_contained,
          unit: variant.unit,
          images: variant.images,
          // Rich alt by default ("Camel Yellow Packet"); explicit text wins.
          imageAltText: variant.image_alt_text?.trim() ||
            `${formData.name.trim()} ${variant.variant_name}`.trim() || undefined,
          priceRupees: variant.price,
          compareAtPriceRupees: variant.compare_at_price,
          costPriceRupees: variant.cost_price,
          stock: variant.stock,
          trackInventory: variant.track_inventory,
          isActive: variant.is_active,
        })),
        deletedVariantSupabaseIds: deletedVariantIds,
        categorySupabaseIds: formData.categories,
        collectionSupabaseIds: formData.collections,
      });

      toast.success(isEditMode ? 'Product updated successfully' : 'Product created successfully');

      navigate('/admin/products');
    } catch (error: any) {
      console.error('Error saving product:', error);
      const code = error?.data?.code;
      toast.error(
        code === 'SLUG_TAKEN'
          ? 'Slug is taken by another product'
          : code === 'NOT_CATALOG_ADMIN'
            ? 'Admin access required'
            : error.message || 'Failed to save product'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    setSaving(true);
    try {
      await removeProduct({ supabaseId: id! });
      toast.success('Product deleted successfully');
      navigate('/admin/products');
    } catch (error: any) {
      console.error('Error deleting product:', error);
      toast.error(error?.data?.code === 'NOT_CATALOG_ADMIN' ? 'Admin access required' : 'Failed to delete product');
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
                  Title <Req />
                </Label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Marlboro Red (Imported)"
                  className="bg-[var(--color-creme)] border-[var(--color-coyote)] focus:ring-[var(--color-canyon)] text-lg py-6"
                  aria-invalid={saveAttempted && isBlank(formData.name)}
                />
                <ReqError show={saveAttempted && isBlank(formData.name)} />
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
              <div className={`grid grid-cols-[auto_1fr] gap-2 items-center text-sm text-[var(--color-dark)]/60 bg-[var(--color-creme)]/50 p-3 rounded-md border border-[var(--color-coyote)]/30${saveAttempted && isBlank(formData.slug) ? ' border-red-500' : ''}`}>
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
              <ReqError
                show={saveAttempted && !formData.variants.some((v) => v.is_default)}
              >
                Mark one variant as Default — saving is blocked without it.
              </ReqError>
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
                          <Label>Selling Price {variant.is_default ? <Req /> : null}</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-dark)]/50">₹</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={variant.price}
                              onChange={(e) => updateVariant(index, { price: parseFloat(e.target.value) || 0 })}
                              placeholder="0.00"
                              className="pl-8 bg-[var(--color-creme)] border-[var(--color-coyote)]"
                              aria-invalid={saveAttempted && !!variant.is_default && !(variant.price > 0)}
                            />
                          </div>
                          <ReqError show={saveAttempted && !!variant.is_default && !(variant.price > 0)}>
                            Default variant price must be greater than 0
                          </ReqError>
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
                        <Input
                          value={variant.image_alt_text || ''}
                          onChange={(e) => updateVariant(index, { image_alt_text: e.target.value })}
                          placeholder={`${formData.name} ${variant.variant_name}`.trim() || 'Image alt text (auto-filled on save)'}
                          className="bg-[var(--color-creme)] border-[var(--color-coyote)] text-sm"
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rating_value">Rating (0–5)</Label>
                  <Input
                    id="rating_value"
                    type="number"
                    min={0}
                    max={5}
                    step={0.1}
                    value={formData.rating_value ?? ''}
                    onChange={(e) => handleChange({ rating_value: e.target.value === '' ? null : Number(e.target.value) })}
                    placeholder="e.g. 4.5"
                    className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="review_count">Review count</Label>
                  <Input
                    id="review_count"
                    type="number"
                    min={0}
                    step={1}
                    value={formData.review_count ?? 0}
                    onChange={(e) => handleChange({ review_count: e.target.value === '' ? 0 : Number(e.target.value) })}
                    placeholder="0"
                    className="bg-[var(--color-creme)] border-[var(--color-coyote)]"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Shows as stars on the product page only once review count is above 0. Leave at 0 until the reviews pipeline is live.
              </p>
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
