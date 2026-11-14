import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { Box, ChevronDown, ExternalLink, ImageIcon, Plus, Search, Star, Trash2 } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { useOrgInfo } from '../../lib/org/OrgContext';
import { useOrg } from '../../lib/convex/useOrg';
import { formatINR } from '../../utils/currency';
import { cn } from '../../components/ui/utils';
import { ProductImageSearchModal } from '../components/shared/ProductImageSearchModal';
import {
  ProductFormData,
  VariantFormData,
  generateSlug,
  calculateProfitMargin,
} from '../../types/product';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Input,
  Page,
  PageLayout,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  SkeletonText,
  Switch,
  Textarea,
  useButtonFeedback,
  type ActionError,
} from '../ui';
import { LazyRichTextEditor } from '../ui/LazyRichTextEditor';
import {
  BrandPicker,
  CategoryPicker,
  CollapsibleCard,
  CollectionPicker,
  Field,
  MoneyInput,
  ProductMediaGrid,
  SaveBar,
  useCatalogTaxonomy,
  useUnsavedChangesGuard,
} from '../features/products';

const CANONICAL_ERROR_MESSAGES: Record<string, string> = {
  NOT_ABSOLUTE_HTTPS: 'Canonical URL must be an absolute https:// URL.',
  UNROUTABLE: 'On this store, a canonical URL must point to a product or blog page (/product/slug or /blog/slug).',
  TARGET_NOT_ACTIVE: 'Canonical URL points to a product or blog post that does not exist or is not active.',
};

const VARIANT_TYPES = [
  { value: 'pack', label: 'Pack' },
  { value: 'carton', label: 'Carton' },
  { value: 'box', label: 'Box' },
  { value: 'bundle', label: 'Bundle' },
];
const UNITS = [
  { value: 'sticks', label: 'Sticks' },
  { value: 'packs', label: 'Packs' },
  { value: 'pieces', label: 'Pieces' },
  { value: 'grams', label: 'Grams' },
];

const newDefaultVariant = (): VariantFormData => ({
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
  cost_price: 0,
});

const emptyForm = (): ProductFormData => ({
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
  variants: [newDefaultVariant()],
  meta_title: '',
  meta_description: '',
  canonical_url: '',
  rating_value: null,
  review_count: 0,
});

/** Convex edit payload → form shape (snake_case, rupees). */
function toForm(editData: any): ProductFormData {
  const data: any = editData.product;
  return {
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
    variants: editData.variants?.length
      ? editData.variants.map((v: any) => ({
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
          is_active: v.isActive,
        }))
      : [newDefaultVariant()],
    meta_title: data.metaTitle || '',
    meta_description: data.metaDescription || '',
    canonical_url: data.canonicalUrl || '',
    rating_value: data.ratingValue ?? null,
    review_count: data.reviewCount ?? 0,
  };
}

/** Plain-text excerpt used as the derived SEO description. */
function excerpt(text: string, max = 160) {
  const t = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 80 ? cut.lastIndexOf(' ') : max)}…`;
}

/** Friendly messages for known Convex codes; the code stays attached. */
function saveError(err: any): unknown {
  const code = err?.data?.code;
  const message =
    code === 'SLUG_TAKEN'
      ? 'This URL handle is already used by another product. Change it under Search engine listing.'
      : code === 'INVALID_CANONICAL'
        ? CANONICAL_ERROR_MESSAGES[err?.data?.reason] ?? 'Canonical URL is invalid.'
        : code === 'NOT_CATALOG_ADMIN' || code === 'NOT_ORG_ADMIN'
          ? 'Admin access required.'
          : code === 'DEFAULT_VARIANT_REQUIRED'
            ? 'Mark one option as the default.'
            : undefined;
  return message ? { data: { code, message } } : err;
}

const unitsText = (v: VariantFormData) => (v.units_contained ? `${v.units_contained} ${v.unit}` : '');

export function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;
  const { slug: orgSlug, primaryHost } = useOrgInfo();
  const org = useOrg();

  const taxonomy = useCatalogTaxonomy(orgSlug);
  const saveProduct = useMutation(api.adminCatalog.saveProduct);
  const removeProduct = useMutation(api.adminCatalog.deleteProduct);
  const editData = useQuery(
    api.adminCatalog.getProductForEdit,
    isEditMode && id ? { supabaseId: id, orgSlug } : 'skip',
  );
  const inventoryRows = useQuery(api.inventory.list, isEditMode && org ? { orgId: org._id, orgSlug } : 'skip');

  const [form, setForm] = useState<ProductFormData>(emptyForm);
  const [baseline, setBaseline] = useState(() => JSON.stringify(emptyForm()));
  const [deletedVariantIds, setDeletedVariantIds] = useState<string[]>([]);
  const [slugManual, setSlugManual] = useState(isEditMode);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [validationError, setValidationError] = useState<ActionError | null>(null);
  const [expandedVariant, setExpandedVariant] = useState<number | null>(null);
  const [imageSearchIndex, setImageSearchIndex] = useState<number | null>(null);
  const [seoOpen, setSeoOpen] = useState(false);
  const [confirmNoImages, setConfirmNoImages] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [resync, setResync] = useState(0);
  const populatedFor = useRef<string | null>(null);

  const save = useButtonFeedback();

  // Populate once per product (and again after a save, so new variant ids
  // land in the form). Never clobbers edits otherwise.
  useEffect(() => {
    if (!isEditMode || !editData || !id) return;
    const key = `${id}:${resync}`;
    if (populatedFor.current === key) return;
    populatedFor.current = key;
    const mapped = toForm(editData);
    setForm(mapped);
    setBaseline(JSON.stringify(mapped));
    setDeletedVariantIds([]);
    setSlugManual(true);
  }, [isEditMode, editData, id, resync]);

  const dirty = JSON.stringify(form) !== baseline || deletedVariantIds.length > 0;
  const guard = useUnsavedChangesGuard(dirty);

  // ---------- form updates ----------
  const patch = useCallback((updates: Partial<ProductFormData>) => setForm((prev) => ({ ...prev, ...updates })), []);

  const setName = (name: string) =>
    setForm((prev) => ({ ...prev, name, slug: slugManual ? prev.slug : generateSlug(name) }));

  const updateVariant = useCallback((index: number, updates: Partial<VariantFormData>) => {
    setForm((prev) => {
      const variants = prev.variants.map((v, i) => {
        if (i === index) return { ...v, ...updates };
        if (updates.is_default === true && v.is_default) return { ...v, is_default: false };
        return v;
      });
      return { ...prev, variants };
    });
  }, []);

  const defaultIndex = form.variants.findIndex((v) => v.is_default);
  const defaultVariant = defaultIndex >= 0 ? form.variants[defaultIndex] : undefined;
  const updateDefault = (updates: Partial<VariantFormData>) => {
    if (defaultIndex >= 0) updateVariant(defaultIndex, updates);
  };

  const addVariant = (type: 'carton' | 'custom') => {
    const basePrice = defaultVariant?.price || 0;
    const base: VariantFormData = {
      variant_name: 'Custom',
      variant_type: 'pack',
      units_contained: 20,
      unit: 'sticks',
      price: basePrice,
      stock: 0,
      track_inventory: false,
      is_active: true,
      is_default: form.variants.length === 0,
      images: [],
      compare_at_price: 0,
      cost_price: 0,
    };
    const variant: VariantFormData =
      type === 'carton'
        ? {
            ...base,
            variant_name: 'Carton',
            variant_type: 'carton',
            units_contained: 10,
            unit: 'packs',
            price: basePrice * 10 * 0.95,
            compare_at_price: basePrice * 10,
          }
        : base;
    setForm((prev) => ({ ...prev, variants: [...prev.variants, variant] }));
    setExpandedVariant(form.variants.length);
  };

  const removeVariant = (index: number) => {
    const removed = form.variants[index];
    if (removed.id) setDeletedVariantIds((prev) => [...prev, removed.id!]);
    setForm((prev) => {
      const variants = prev.variants.filter((_, i) => i !== index);
      if (removed.is_default && variants.length > 0) variants[0] = { ...variants[0], is_default: true };
      return { ...prev, variants };
    });
    setExpandedVariant(null);
  };

  const discard = () => {
    if (isEditMode && editData) {
      const mapped = toForm(editData);
      setForm(mapped);
      setBaseline(JSON.stringify(mapped));
    } else {
      const fresh = emptyForm();
      setForm(fresh);
      setBaseline(JSON.stringify(fresh));
      setSlugManual(false);
    }
    setDeletedVariantIds([]);
    setSaveAttempted(false);
    setValidationError(null);
    save.reset();
  };

  // ---------- save ----------
  const persist = async () => {
    const ratingValue =
      form.rating_value == null || Number.isNaN(Number(form.rating_value))
        ? undefined
        : Math.min(5, Math.max(0, Number(form.rating_value)));
    const reviewCount =
      form.review_count == null || Number.isNaN(Number(form.review_count))
        ? undefined
        : Math.max(0, Math.floor(Number(form.review_count)));
    const name = form.name.trim();
    const slug = form.slug.trim() || generateSlug(name);
    let res: { supabaseId: string };
    try {
      res = await saveProduct({
        orgSlug,
        supabaseId: isEditMode ? id : undefined,
        product: {
          name,
          slug,
          brandSupabaseId: form.brand_id || undefined,
          description: form.description.trim(),
          shortDescription: form.short_description?.trim() || undefined,
          isActive: form.is_active,
          origin: form.origin?.trim() || undefined,
          specifications: form.specifications.reduce(
            (acc, spec) => {
              if (spec.key && spec.value) acc[spec.key] = spec.value;
              return acc;
            },
            {} as Record<string, string>,
          ),
          metaTitle: form.meta_title?.trim() || name,
          metaDescription: form.meta_description?.trim() || undefined,
          canonicalUrl: form.canonical_url?.trim() || undefined,
          ratingValue,
          reviewCount,
        },
        variants: form.variants.map((variant) => ({
          supabaseId: variant.id,
          variantName: variant.variant_name,
          variantSlug: variant.variant_slug,
          variantType: variant.variant_type,
          isDefault: variant.is_default,
          unitsContained: variant.units_contained,
          unit: variant.unit,
          images: variant.images,
          // Rich alt by default ("Camel Yellow Packet"); explicit text wins.
          imageAltText: variant.image_alt_text?.trim() || `${name} ${variant.variant_name}`.trim() || undefined,
          priceRupees: variant.price,
          compareAtPriceRupees: variant.compare_at_price,
          costPriceRupees: variant.cost_price,
          stock: variant.stock,
          trackInventory: variant.track_inventory,
          isActive: variant.is_active,
        })),
        deletedVariantSupabaseIds: deletedVariantIds,
        categorySupabaseIds: form.categories,
        collectionSupabaseIds: form.collections,
      });
    } catch (err: any) {
      if (err?.data?.code === 'SLUG_TAKEN' || err?.data?.code === 'INVALID_CANONICAL') setSeoOpen(true);
      throw saveError(err);
    }
    if (isEditMode) {
      setResync((n) => n + 1);
    } else {
      setBaseline(JSON.stringify(form));
      navigate(`/products/${res.supabaseId}`, { replace: true });
    }
  };

  const handleSave = () => {
    setSaveAttempted(true);
    setValidationError(null);
    const problems: string[] = [];
    if (!form.name.trim()) problems.push('Add a title.');
    if (!defaultVariant) problems.push('Mark one option as the default.');
    else if (!(defaultVariant.price > 0)) problems.push('Set a price above ₹0.');
    if (problems.length) {
      setValidationError({ message: `Fix before saving: ${problems.join(' ')}` });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!defaultVariant!.images?.length) {
      setConfirmNoImages(true);
      return;
    }
    void save.run(persist);
  };

  // ---------- derived ----------
  const margin = defaultVariant ? calculateProfitMargin(defaultVariant.price, defaultVariant.cost_price) : 0;
  const profit = defaultVariant && defaultVariant.cost_price ? defaultVariant.price - defaultVariant.cost_price : null;
  const derivedSlug = form.slug || generateSlug(form.name);
  const seoTitle = form.meta_title?.trim() || form.name.trim() || 'Product title';
  const seoDescription =
    form.meta_description?.trim() || excerpt(form.short_description || form.description || '') || '';
  const productUrl = `${primaryHost || 'your-store'}/product/${derivedSlug || 'product-handle'}`;
  const stockByVariant = useMemo(
    () => new Map((inventoryRows ?? []).map((r: any) => [r.variantSupabaseId, r])),
    [inventoryRows],
  );
  const nameMissing = saveAttempted && !form.name.trim();
  const priceMissing = saveAttempted && !!defaultVariant && !(defaultVariant.price > 0);

  // ---------- states ----------
  if (isEditMode && editData === undefined) {
    return (
      <Page title="Product" backTo="/products">
        <PageLayout
          main={
            <>
              <Card>
                <SkeletonText lines={4} />
              </Card>
              <Card title="Media">
                <div className="grid grid-cols-4 gap-2">
                  <Skeleton className="col-span-2 row-span-2 aspect-square h-auto" />
                  <Skeleton className="aspect-square h-auto" />
                  <Skeleton className="aspect-square h-auto" />
                </div>
              </Card>
            </>
          }
          aside={
            <>
              <Card title="Status">
                <Skeleton className="h-9 w-full" />
              </Card>
              <Card title="Pricing">
                <SkeletonText lines={3} />
              </Card>
            </>
          }
        />
      </Page>
    );
  }
  if (isEditMode && editData === null) {
    return (
      <Page title="Product not found" backTo="/products">
        <Card>
          <EmptyState
            title="This product does not exist in this store"
            description="It may have been deleted."
            action={
              <Button asChild variant="secondary">
                <Link to="/products">Back to products</Link>
              </Button>
            }
          />
        </Card>
      </Page>
    );
  }

  const variantOrder = form.variants
    .map((variant, index) => ({ variant, index }))
    .sort((a, b) => Number(!!b.variant.is_default) - Number(!!a.variant.is_default));

  const webSearchButton = (index: number) => (
    <Button
      variant="plain"
      size="sm"
      icon={<Search aria-hidden />}
      disabled={!form.name.trim()}
      title={form.name.trim() ? undefined : 'Add a title first'}
      onClick={() => setImageSearchIndex(index)}
    >
      Search the web
    </Button>
  );

  return (
    <Page
      title={isEditMode ? form.name || 'Untitled product' : 'Add product'}
      backTo="/products"
      titleMeta={
        isEditMode ? (
          <Badge tone={form.is_active ? 'success' : 'neutral'}>{form.is_active ? 'Active' : 'Draft'}</Badge>
        ) : undefined
      }
      secondaryActions={
        isEditMode
          ? [
              {
                label: 'View on store',
                icon: <ExternalLink aria-hidden />,
                disabled: !form.is_active || !primaryHost,
                onClick: () => window.open(`https://${primaryHost}/product/${form.slug}`, '_blank', 'noopener'),
              },
              { label: 'Delete', critical: true, icon: <Trash2 aria-hidden />, onClick: () => setConfirmDelete(true) },
            ]
          : undefined
      }
    >
      <ErrorBanner error={validationError ?? save.error} onDismiss={validationError ? () => setValidationError(null) : undefined} />

      <PageLayout
        main={
          <>
            {/* Title + description */}
            <Card>
              <div className="flex flex-col gap-4">
                <Field label="Title" htmlFor="p-title" required error={nameMissing ? 'Add a title' : undefined}>
                  <Input
                    id="p-title"
                    value={form.name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Marlboro Red (Imported)"
                    aria-invalid={nameMissing || undefined}
                    autoFocus={!isEditMode}
                  />
                </Field>
                <Field label="Description" htmlFor="p-desc">
                  <LazyRichTextEditor
                    id="p-desc"
                    variant="compact"
                    ariaLabel="Description"
                    minHeight={192}
                    value={form.description}
                    onChange={(description) => patch({ description })}
                    placeholder="Describe the product: taste, strength, pack details…"
                  />
                </Field>
                <Field
                  label="Summary"
                  htmlFor="p-short"
                  help="One line for collection pages and the search result description."
                >
                  <Input
                    id="p-short"
                    value={form.short_description || ''}
                    onChange={(e) => patch({ short_description: e.target.value })}
                    placeholder="Brief summary"
                  />
                </Field>
              </div>
            </Card>

            {/* Media (default option's images) */}
            <Card title="Media">
              {defaultVariant ? (
                <ProductMediaGrid
                  images={defaultVariant.images}
                  onChange={(images) => updateDefault({ images })}
                  uploadSlug={form.name.trim() || undefined}
                  extraActions={webSearchButton(defaultIndex)}
                />
              ) : (
                <p className="text-sm text-[var(--admin-text-muted)]">Mark an option as default to add media.</p>
              )}
            </Card>

            {/* Variants */}
            <Card
              title="Options"
              padding="none"
              actions={
                <>
                  <Button variant="plain" size="sm" icon={<Box aria-hidden />} onClick={() => addVariant('carton')}>
                    Add carton
                  </Button>
                  <Button variant="plain" size="sm" icon={<Plus aria-hidden />} onClick={() => addVariant('custom')}>
                    Add option
                  </Button>
                </>
              }
            >
              {saveAttempted && !defaultVariant && (
                <p role="alert" className="px-4 pt-3 text-xs text-[var(--admin-critical)]">
                  Mark one option as default. Saving is blocked without it.
                </p>
              )}
              <ul className="divide-y divide-[var(--admin-border)]">
                {variantOrder.map(({ variant, index }) => {
                  const open = expandedVariant === index;
                  const thumb = variant.images[0] || defaultVariant?.images[0];
                  const live = variant.id ? stockByVariant.get(variant.id) : undefined;
                  const stockLabel = !variant.track_inventory
                    ? '-'
                    : live
                      ? `${live.available} available`
                      : `${variant.stock} in stock`;
                  return (
                    <li key={variant.id ?? `new-${index}`}>
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setExpandedVariant(open ? null : index)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--admin-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--admin-focus)]"
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[var(--admin-radius-sm)] border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)]">
                          {thumb ? (
                            <img src={thumb} alt="" className="size-full object-cover" loading="lazy" />
                          ) : (
                            <ImageIcon className="size-4 text-[var(--admin-text-subtle)]" aria-hidden />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium text-[var(--admin-text)]">
                              {variant.variant_name || 'Untitled option'}
                            </span>
                            {variant.is_default && <Badge tone="info">Default</Badge>}
                            {!variant.is_active && <Badge>Inactive</Badge>}
                          </span>
                          <span className="block truncate text-xs text-[var(--admin-text-muted)]">
                            {[unitsText(variant), `Stock ${stockLabel}`].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="block text-sm font-medium tabular-nums text-[var(--admin-text)]">
                            {formatINR(variant.price || 0)}
                          </span>
                          {!!variant.compare_at_price && variant.compare_at_price > variant.price && (
                            <span className="block text-xs tabular-nums text-[var(--admin-text-muted)] line-through">
                              {formatINR(variant.compare_at_price)}
                            </span>
                          )}
                        </span>
                        <ChevronDown
                          className={cn('size-4 shrink-0 text-[var(--admin-text-muted)] transition-transform', open && 'rotate-180')}
                          aria-hidden
                        />
                      </button>
                      {open && (
                        <VariantEditor
                          variant={variant}
                          index={index}
                          canRemove={form.variants.length > 1}
                          productName={form.name}
                          onChange={(u) => updateVariant(index, u)}
                          onRemove={() => removeVariant(index)}
                          webSearch={webSearchButton(index)}
                          liveAvailable={live?.available}
                          saveAttempted={saveAttempted}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>

            {/* Rarely used */}
            <CollapsibleCard
              title="Search engine listing"
              open={seoOpen}
              onOpenChange={setSeoOpen}
              summary={`${productUrl} · ${seoTitle}`}
            >
              <div className="flex flex-col gap-4">
                <div className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-3">
                  <p className="truncate text-xs text-[var(--admin-text-muted)]">{productUrl}</p>
                  <p className="truncate text-[15px] font-medium text-[var(--admin-info)]">{seoTitle}</p>
                  <p className="line-clamp-2 text-xs text-[var(--admin-text-muted)]">
                    {seoDescription || 'Add a description or summary to fill this in.'}
                  </p>
                </div>
                <Field label="Page title" htmlFor="p-meta-title" help="Defaults to the product title.">
                  <Input
                    id="p-meta-title"
                    value={form.meta_title}
                    onChange={(e) => patch({ meta_title: e.target.value })}
                    placeholder={form.name || 'Product title'}
                  />
                </Field>
                <Field label="Meta description" htmlFor="p-meta-desc" help="Defaults to the summary, then the description.">
                  <Textarea
                    id="p-meta-desc"
                    value={form.meta_description}
                    onChange={(e) => patch({ meta_description: e.target.value })}
                    placeholder={seoDescription || 'Search result description'}
                    rows={3}
                  />
                </Field>
                <Field
                  label="URL handle"
                  htmlFor="p-slug"
                  help={slugManual ? 'Changing the handle of a live product creates a redirect from the old URL.' : 'Follows the title until you edit it.'}
                  aside={
                    slugManual && !isEditMode ? (
                      <button
                        type="button"
                        className="text-xs font-medium text-[var(--admin-primary)] hover:underline"
                        onClick={() => {
                          setSlugManual(false);
                          patch({ slug: generateSlug(form.name) });
                        }}
                      >
                        Reset to title
                      </button>
                    ) : undefined
                  }
                >
                  <Input
                    id="p-slug"
                    value={form.slug}
                    onChange={(e) => {
                      setSlugManual(true);
                      patch({ slug: generateSlug(e.target.value) });
                    }}
                    placeholder={generateSlug(form.name) || 'product-handle'}
                  />
                </Field>
                <Field label="Canonical URL" htmlFor="p-canonical" help="Leave empty to use this page's own URL.">
                  <Input
                    id="p-canonical"
                    value={form.canonical_url}
                    onChange={(e) => patch({ canonical_url: e.target.value })}
                    placeholder="https://example.com/product"
                  />
                </Field>
              </div>
            </CollapsibleCard>

            <CollapsibleCard
              title="Specifications"
              summary={form.specifications.length ? `${form.specifications.length} specifications` : 'None'}
            >
              <div className="flex flex-col gap-2">
                {form.specifications.map((spec, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      aria-label="Specification name"
                      placeholder="Name (e.g. Tar)"
                      value={spec.key}
                      onChange={(e) =>
                        patch({ specifications: form.specifications.map((s, j) => (j === i ? { ...s, key: e.target.value } : s)) })
                      }
                    />
                    <Input
                      aria-label="Specification value"
                      placeholder="Value (e.g. 10 mg)"
                      value={spec.value}
                      onChange={(e) =>
                        patch({ specifications: form.specifications.map((s, j) => (j === i ? { ...s, value: e.target.value } : s)) })
                      }
                    />
                    <Button
                      variant="plain"
                      size="icon"
                      aria-label="Remove specification"
                      onClick={() => patch({ specifications: form.specifications.filter((_, j) => j !== i) })}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                ))}
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Plus aria-hidden />}
                    onClick={() => patch({ specifications: [...form.specifications, { key: '', value: '' }] })}
                  >
                    Add specification
                  </Button>
                </div>
              </div>
            </CollapsibleCard>

            <CollapsibleCard
              title="Rating"
              summary={form.review_count ? `${form.rating_value ?? '-'} from ${form.review_count} reviews` : 'Hidden until there are reviews'}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Rating (0 to 5)" htmlFor="p-rating">
                  <Input
                    id="p-rating"
                    type="number"
                    min={0}
                    max={5}
                    step={0.1}
                    value={form.rating_value ?? ''}
                    onChange={(e) => patch({ rating_value: e.target.value === '' ? null : Number(e.target.value) })}
                    placeholder="e.g. 4.5"
                  />
                </Field>
                <Field label="Review count" htmlFor="p-reviews">
                  <Input
                    id="p-reviews"
                    type="number"
                    min={0}
                    step={1}
                    value={form.review_count ?? 0}
                    onChange={(e) => patch({ review_count: e.target.value === '' ? 0 : Number(e.target.value) })}
                  />
                </Field>
              </div>
              <p className="mt-2 text-xs text-[var(--admin-text-muted)]">
                Stars show on the product page only once the review count is above 0.
              </p>
            </CollapsibleCard>

            <CollapsibleCard title="Advanced" summary="IDs and option handles">
              <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
                <dt className="text-[var(--admin-text-muted)]">Product ID</dt>
                <dd className="break-all font-mono text-xs">{id ?? 'Assigned when saved'}</dd>
                {form.variants.map((v, i) => (
                  <div key={v.id ?? i} className="contents">
                    <dt className="text-[var(--admin-text-muted)]">{v.variant_name || 'Option'}</dt>
                    <dd className="break-all font-mono text-xs">
                      {v.id ? `${v.id}${v.variant_slug ? ` · ${v.variant_slug}` : ''}` : 'Assigned when saved'}
                    </dd>
                  </div>
                ))}
              </dl>
            </CollapsibleCard>
          </>
        }
        aside={
          <>
            <Card title="Status">
              <Select value={form.is_active ? 'active' : 'draft'} onValueChange={(v: string) => patch({ is_active: v === 'active' })}>
                <SelectTrigger aria-label="Status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs text-[var(--admin-text-muted)]">
                {form.is_active ? 'Visible on the store.' : 'Hidden from the store until set to Active.'}
              </p>
            </Card>

            <Card title="Pricing">
              {form.variants.length > 1 ? (
                // Several options: every price is edited here, one row per option.
                <div className="flex flex-col gap-4">
                  {variantOrder.map(({ variant, index }) => {
                    const p = `pr${index}`;
                    const isDefaultRow = index === defaultIndex;
                    return (
                      <div key={variant.id ?? `new-${index}`} className="flex flex-col gap-2 border-t border-[var(--admin-border)] pt-3 first:border-t-0 first:pt-0">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-[13px] font-medium text-[var(--admin-text)]">
                            {variant.variant_name || 'Untitled option'}
                          </span>
                          {variant.is_default && <Badge tone="info">Default</Badge>}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Field label="Price" htmlFor={`${p}-price`}>
                            <MoneyInput
                              id={`${p}-price`}
                              value={variant.price}
                              onChange={(price) => updateVariant(index, { price })}
                              invalid={isDefaultRow && priceMissing}
                            />
                          </Field>
                          <Field label="Compare-at" htmlFor={`${p}-compare`}>
                            <MoneyInput
                              id={`${p}-compare`}
                              value={variant.compare_at_price}
                              onChange={(compare_at_price) => updateVariant(index, { compare_at_price })}
                            />
                          </Field>
                          <Field label="Cost" htmlFor={`${p}-cost`}>
                            <MoneyInput
                              id={`${p}-cost`}
                              value={variant.cost_price}
                              onChange={(cost_price) => updateVariant(index, { cost_price })}
                            />
                          </Field>
                        </div>
                        {isDefaultRow && priceMissing && (
                          <p role="alert" className="text-xs text-[var(--admin-critical)]">Set a price above ₹0</p>
                        )}
                      </div>
                    );
                  })}
                  <p className="text-xs text-[var(--admin-text-muted)]">
                    Compare-at shows struck through when higher than the price. Cost is never shown to customers.
                  </p>
                </div>
              ) : defaultVariant ? (
                <div className="flex flex-col gap-3">
                  <Field label="Price" htmlFor="p-price" required error={priceMissing ? 'Set a price above ₹0' : undefined}>
                    <MoneyInput id="p-price" value={defaultVariant.price} onChange={(price) => updateDefault({ price })} invalid={priceMissing} />
                  </Field>
                  <Field label="Compare-at price" htmlFor="p-compare" help="Shown struck through when higher than the price.">
                    <MoneyInput
                      id="p-compare"
                      value={defaultVariant.compare_at_price}
                      onChange={(compare_at_price) => updateDefault({ compare_at_price })}
                    />
                  </Field>
                  <Field
                    label="Cost per item"
                    htmlFor="p-cost"
                    help="Customers won't see this."
                    aside={
                      margin !== 0 ? (
                        <span className={cn('text-xs font-medium tabular-nums', margin > 0 ? 'text-[var(--admin-success)]' : 'text-[var(--admin-critical)]')}>
                          {margin}% margin{profit !== null ? ` · ${formatINR(profit)}` : ''}
                        </span>
                      ) : undefined
                    }
                  >
                    <MoneyInput id="p-cost" value={defaultVariant.cost_price} onChange={(cost_price) => updateDefault({ cost_price })} />
                  </Field>
                </div>
              ) : (
                <p className="text-sm text-[var(--admin-text-muted)]">Mark an option as default to set pricing.</p>
              )}
            </Card>

            <Card title="Organization">
              <div className="flex flex-col gap-3">
                <Field label="Brand" htmlFor="p-brand">
                  <BrandPicker id="p-brand" taxonomy={taxonomy} value={form.brand_id || ''} onChange={(brand_id) => patch({ brand_id })} />
                </Field>
                <Field label="Categories" htmlFor="p-categories">
                  <CategoryPicker id="p-categories" taxonomy={taxonomy} value={form.categories} onChange={(categories) => patch({ categories })} />
                </Field>
                <Field label="Collections" htmlFor="p-collections">
                  <CollectionPicker id="p-collections" taxonomy={taxonomy} value={form.collections} onChange={(collections) => patch({ collections })} />
                </Field>
                <Field label="Origin" htmlFor="p-origin">
                  <Input id="p-origin" value={form.origin} onChange={(e) => patch({ origin: e.target.value })} placeholder="Country of origin" />
                </Field>
              </div>
            </Card>

            <Card title="Inventory">
              {defaultVariant ? (
                <InventoryFields
                  variant={defaultVariant}
                  onChange={updateDefault}
                  liveAvailable={defaultVariant.id ? stockByVariant.get(defaultVariant.id)?.available : undefined}
                />
              ) : (
                <p className="text-sm text-[var(--admin-text-muted)]">Mark an option as default to track stock.</p>
              )}
            </Card>
          </>
        }
      />

      <SaveBar
        visible={dirty || !isEditMode}
        message={dirty ? 'Unsaved changes' : 'New product'}
        onSave={handleSave}
        onDiscard={dirty ? discard : undefined}
        saveState={save.state}
        saveLabel={isEditMode ? 'Save' : 'Save product'}
      />

      {guard.dialog}

      <ConfirmDialog
        open={confirmNoImages}
        onOpenChange={setConfirmNoImages}
        title="Save without images?"
        description="Product pages without photos rank poorly. You can add images later."
        confirmLabel="Save anyway"
        onConfirm={() => save.run(persist)}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this product?"
        description={`${form.name || 'This product'} and its options will be removed from the store. This cannot be undone.`}
        confirmLabel="Delete product"
        critical
        onConfirm={async () => {
          try {
            await removeProduct({ supabaseId: id!, orgSlug });
          } catch (err) {
            throw saveError(err);
          }
          setBaseline(JSON.stringify(form));
          setDeletedVariantIds([]);
          navigate('/products');
        }}
      />

      <ProductImageSearchModal
        open={imageSearchIndex !== null}
        onClose={() => setImageSearchIndex(null)}
        product={
          form.name
            ? {
                id: id || 'new',
                name: form.name,
                slug: form.slug,
                brand: taxonomy.brands?.find((b) => b.id === form.brand_id)?.label,
                gallery_images: imageSearchIndex !== null ? form.variants[imageSearchIndex]?.images : [],
              }
            : undefined
        }
        onImagesAdded={(_, urls) => {
          if (imageSearchIndex === null) return;
          const current = form.variants[imageSearchIndex]?.images || [];
          updateVariant(imageSearchIndex, { images: [...current, ...urls] });
        }}
        mode="single"
      />
    </Page>
  );
}

function InventoryFields({
  variant,
  onChange,
  liveAvailable,
  idPrefix = 'p',
}: {
  variant: VariantFormData;
  onChange: (u: Partial<VariantFormData>) => void;
  liveAvailable?: number;
  idPrefix?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center justify-between gap-3 text-[13px] font-medium text-[var(--admin-text)]">
        Track quantity
        <Switch checked={variant.track_inventory} onCheckedChange={(track_inventory) => onChange({ track_inventory })} />
      </label>
      {variant.track_inventory &&
        (variant.id ? (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-[var(--admin-text-muted)]">Available</span>
            <span className="font-medium tabular-nums text-[var(--admin-text)]">{liveAvailable ?? variant.stock}</span>
          </div>
        ) : (
          <Field label="Opening stock" htmlFor={`${idPrefix}-stock`}>
            <Input
              id={`${idPrefix}-stock`}
              type="number"
              inputMode="numeric"
              min={0}
              value={variant.stock}
              onChange={(e) => onChange({ stock: parseInt(e.target.value) || 0 })}
            />
          </Field>
        ))}
      {variant.id && variant.track_inventory && (
        <Link to="/inventory" className="text-xs font-medium text-[var(--admin-primary)] hover:underline">
          Adjust stock in Inventory
        </Link>
      )}
      {!variant.track_inventory && (
        <p className="text-xs text-[var(--admin-text-muted)]">Stock is not tracked; the option is always available.</p>
      )}
    </div>
  );
}

function VariantEditor({
  variant,
  index,
  canRemove,
  productName,
  onChange,
  onRemove,
  webSearch,
  liveAvailable,
  saveAttempted,
}: {
  variant: VariantFormData;
  index: number;
  canRemove: boolean;
  productName: string;
  onChange: (u: Partial<VariantFormData>) => void;
  onRemove: () => void;
  webSearch: ReactNode;
  liveAvailable?: number;
  saveAttempted: boolean;
}) {
  const p = `v${index}`;
  const isDefault = !!variant.is_default;
  return (
    <div className="flex flex-col gap-4 border-t border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-4 py-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Option name" htmlFor={`${p}-name`}>
          <Input
            id={`${p}-name`}
            value={variant.variant_name}
            onChange={(e) => onChange({ variant_name: e.target.value })}
            placeholder="e.g. Packet, Carton"
          />
        </Field>
        <Field label="Type" htmlFor={`${p}-type`}>
          <Select value={variant.variant_type} onValueChange={(variant_type: string) => onChange({ variant_type })}>
            <SelectTrigger id={`${p}-type`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VARIANT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Contains" htmlFor={`${p}-units`}>
          <Input
            id={`${p}-units`}
            type="number"
            inputMode="numeric"
            min={0}
            value={variant.units_contained}
            onChange={(e) => onChange({ units_contained: parseInt(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Unit" htmlFor={`${p}-unit`}>
          <Select value={variant.unit} onValueChange={(unit: string) => onChange({ unit })}>
            <SelectTrigger id={`${p}-unit`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map((u) => (
                <SelectItem key={u.value} value={u.value}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {!isDefault && (
        <>
          <div className="max-w-sm">
            <InventoryFields variant={variant} onChange={onChange} liveAvailable={liveAvailable} idPrefix={p} />
          </div>
          <Field label="Images">
            <ProductMediaGrid
              compact
              label={`${variant.variant_name || 'Option'} images`}
              images={variant.images}
              onChange={(images) => onChange({ images })}
              uploadSlug={`${productName} ${variant.variant_name}`.trim() || undefined}
              extraActions={webSearch}
            />
          </Field>
        </>
      )}
      {isDefault && (
        <p className="text-xs text-[var(--admin-text-muted)]">
          Inventory and media of the default option are set in Inventory and Media. Prices are set in Pricing.
        </p>
      )}

      <Field label="Image alt text" htmlFor={`${p}-alt`} help="Filled in from the title and option name when left empty.">
        <Input
          id={`${p}-alt`}
          value={variant.image_alt_text || ''}
          onChange={(e) => onChange({ image_alt_text: e.target.value })}
          placeholder={`${productName} ${variant.variant_name}`.trim() || 'Image alt text'}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <label className="flex items-center gap-2 text-[13px] font-medium text-[var(--admin-text)]">
          <Switch checked={variant.is_active} onCheckedChange={(is_active) => onChange({ is_active })} />
          Available for sale
        </label>
        {!isDefault && (
          <Button variant="secondary" size="sm" icon={<Star aria-hidden />} onClick={() => onChange({ is_default: true })}>
            Make default
          </Button>
        )}
        {canRemove && (
          <Button variant="plain" size="sm" icon={<Trash2 aria-hidden />} className="ml-auto text-[var(--admin-critical)]" onClick={onRemove}>
            Remove option
          </Button>
        )}
      </div>
      {saveAttempted && isDefault && !(variant.price > 0) && (
        <p role="alert" className="text-xs text-[var(--admin-critical)]">Set a price above ₹0 in Pricing.</p>
      )}
    </div>
  );
}
