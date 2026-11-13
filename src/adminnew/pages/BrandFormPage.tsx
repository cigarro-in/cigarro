import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { ORG_SLUG } from '../../lib/convex/org';
import { generateSlug } from '../../types/product';
import { SingleImagePicker } from '../components/shared/ImagePicker';
import { BrandProductList, useCatalogProducts } from '../features/catalog/ProductMembers';
import {
  CatalogThumb,
  DisclosureCard,
  Field,
  SaveBar,
  catalogError,
  useFormBaseline,
} from '../features/catalog/catalogShared';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Input,
  Label,
  Page,
  PageLayout,
  Skeleton,
  SkeletonText,
  Switch,
  Textarea,
  useButtonFeedback,
} from '../ui';

const LIST = '/brands';

interface BrandForm {
  name: string;
  slug: string;
  description: string;
  logo: string | null;
  websiteUrl: string;
  countryOfOrigin: string;
  isActive: boolean;
  seoTitle: string;
  seoDescription: string;
}

export function BrandFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const rows = useQuery(api.adminCatalog.listBrandsForAdmin, { orgSlug: ORG_SLUG });
  const createBrand = useMutation(api.adminCatalog.createBrand);
  const updateBrand = useMutation(api.adminCatalog.updateBrand);
  const removeBrand = useMutation(api.adminCatalog.deleteBrand);
  const products = useCatalogProducts();

  const source: any = isEdit ? rows?.find((b: any) => b.supabaseId === id) : undefined;
  const notFound = isEdit && rows !== undefined && !source;
  const ready = rows !== undefined && !notFound;

  const [form, setForm] = useState<BrandForm | null>(null);
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [attempted, setAttempted] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const save = useButtonFeedback();
  const { base, dirty, rebaseline } = useFormBaseline(form);

  useEffect(() => {
    if (!ready || form) return;
    if (source) {
      setForm({
        name: source.name || '',
        slug: source.slug || '',
        description: source.description || '',
        logo: source.logoUrl || null,
        websiteUrl: source.websiteUrl || '',
        countryOfOrigin: source.countryOfOrigin || '',
        isActive: source.isActive !== false,
        seoTitle: source.metaTitle || '',
        seoDescription: source.metaDescription || '',
      });
    } else {
      setForm({
        name: '',
        slug: '',
        description: '',
        logo: null,
        websiteUrl: '',
        countryOfOrigin: '',
        isActive: true,
        seoTitle: '',
        seoDescription: '',
      });
    }
  }, [ready, form, source]);

  const patch = (p: Partial<BrandForm>) => setForm((f) => (f ? { ...f, ...p } : f));

  const onName = (name: string) => patch({ name, ...(slugTouched ? {} : { slug: generateSlug(name) }) });
  const onSlug = (value: string) => {
    setSlugTouched(true);
    patch({ slug: generateSlug(value) });
  };

  const onSave = async () => {
    if (!form) return;
    setAttempted(true);
    if (!form.name.trim() || !form.slug.trim()) return;
    const submitted = form;
    const args = {
      name: submitted.name.trim(),
      slug: submitted.slug.trim(),
      description: submitted.description.trim() || undefined,
      logoUrl: submitted.logo || undefined,
      websiteUrl: submitted.websiteUrl.trim() || undefined,
      countryOfOrigin: submitted.countryOfOrigin.trim() || undefined,
      isActive: submitted.isActive,
      metaTitle: submitted.seoTitle.trim() || submitted.name.trim(),
      metaDescription: submitted.seoDescription.trim() || undefined,
    };
    const result = await save.run(async () => {
      if (isEdit) await updateBrand({ supabaseId: id!, patch: args, orgSlug: ORG_SLUG });
      else await createBrand({ ...args, orgSlug: ORG_SLUG });
      return true;
    });
    if (!result) return;
    if (isEdit) rebaseline(submitted);
    else window.setTimeout(() => navigate(LIST), 700);
  };

  const onDelete = async () => {
    try {
      await removeBrand({ supabaseId: id!, orgSlug: ORG_SLUG });
    } catch (err) {
      throw new Error(catalogError(err, 'Could not delete this brand.').message);
    }
    navigate(LIST);
  };

  if (notFound) {
    return (
      <Page title="Not found" backTo={LIST}>
        <Card>
          <EmptyState
            title="This brand no longer exists"
            action={<Button onClick={() => navigate(LIST)}>Back to brands</Button>}
          />
        </Card>
      </Page>
    );
  }

  if (!form) {
    return (
      <Page title={<Skeleton className="h-6 w-48" />} backTo={LIST}>
        <PageLayout main={<Card><SkeletonText lines={4} /></Card>} aside={<Card><SkeletonText lines={2} /></Card>} />
      </Page>
    );
  }

  const titleText = form.name.trim() || (isEdit ? 'Untitled brand' : 'New brand');
  const nameMissing = attempted && !form.name.trim();
  const slugMissing = attempted && !form.slug.trim();
  const productCount: number = source?.product_count ?? 0;

  return (
    <>
      <Page
        title={titleText}
        backTo={LIST}
        secondaryActions={isEdit ? [{ label: 'Delete', critical: true, onClick: () => setDeleteOpen(true) }] : undefined}
      >
        {save.error && <ErrorBanner error={save.error} />}
        <PageLayout
          main={
            <>
              <Card title="Details">
                <div className="flex flex-col gap-4">
                  <Field label="Name" htmlFor="brand-name" required error={nameMissing ? 'Enter a brand name.' : undefined}>
                    <Input
                      id="brand-name"
                      value={form.name}
                      onChange={(e) => onName(e.target.value)}
                      placeholder="e.g. Marlboro"
                      aria-invalid={nameMissing}
                    />
                  </Field>
                  <Field label="Description" htmlFor="brand-description">
                    <Textarea
                      id="brand-description"
                      rows={3}
                      value={form.description}
                      onChange={(e) => patch({ description: e.target.value })}
                      placeholder="Describe the brand"
                    />
                  </Field>
                  <Field label="Logo">
                    <SingleImagePicker
                      value={form.logo}
                      onChange={(url) => patch({ logo: url || null })}
                      searchHint={form.name ? `${form.name} brand logo` : undefined}
                    />
                  </Field>
                </div>
              </Card>

              <Card
                title="Products"
                actions={<span className="text-xs text-[var(--admin-text-muted)]">{productCount} in this brand</span>}
              >
                {isEdit ? (
                  <BrandProductList products={products} brandId={id} />
                ) : (
                  <EmptyState
                    icon={<Building2 />}
                    title="Save the brand first"
                    description="Products are assigned to a brand from the product editor."
                    className="py-6"
                  />
                )}
              </Card>

              <DisclosureCard title="Slug, details and SEO" summary={`/brands/${form.slug || '…'}`} forceOpen={slugMissing}>
                <Field label="URL slug" htmlFor="brand-slug" required error={slugMissing ? 'Slug is required.' : undefined} hint="Created from the name. Edit to override.">
                  <Input
                    id="brand-slug"
                    value={form.slug}
                    onChange={(e) => onSlug(e.target.value)}
                    placeholder="brand-slug"
                    aria-invalid={slugMissing}
                  />
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Website" htmlFor="brand-website">
                    <Input
                      id="brand-website"
                      value={form.websiteUrl}
                      onChange={(e) => patch({ websiteUrl: e.target.value })}
                      placeholder="https://example.com"
                    />
                  </Field>
                  <Field label="Country of origin" htmlFor="brand-country">
                    <Input
                      id="brand-country"
                      value={form.countryOfOrigin}
                      onChange={(e) => patch({ countryOfOrigin: e.target.value })}
                      placeholder="e.g. USA"
                    />
                  </Field>
                </div>
                <Field label="Meta title" htmlFor="brand-meta-title" hint="Defaults to the brand name.">
                  <Input id="brand-meta-title" value={form.seoTitle} onChange={(e) => patch({ seoTitle: e.target.value })} />
                </Field>
                <Field label="Meta description" htmlFor="brand-meta-description">
                  <Textarea
                    id="brand-meta-description"
                    rows={2}
                    value={form.seoDescription}
                    onChange={(e) => patch({ seoDescription: e.target.value })}
                  />
                </Field>
              </DisclosureCard>
            </>
          }
          aside={
            <>
              <Card title="Visibility">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Label htmlFor="brand-active">Active</Label>
                    <p className="text-xs text-[var(--admin-text-muted)]">Shown to customers on the store.</p>
                  </div>
                  <Switch id="brand-active" checked={form.isActive} onCheckedChange={(isActive) => patch({ isActive })} />
                </div>
              </Card>

              <Card title="Preview">
                <div className="flex items-center gap-3">
                  <CatalogThumb src={form.logo} icon={<Building2 />} alt="" className="size-12" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-[var(--admin-text)]">{titleText}</div>
                    <div className="line-clamp-2 text-xs text-[var(--admin-text-muted)]">
                      {form.description || 'No description yet'}
                    </div>
                    {form.countryOfOrigin && (
                      <div className="text-xs text-[var(--admin-text-muted)]">Origin: {form.countryOfOrigin}</div>
                    )}
                  </div>
                </div>
              </Card>
            </>
          }
        />
      </Page>

      <SaveBar
        visible={dirty || save.state !== 'idle'}
        state={save.state}
        onSave={() => void onSave()}
        onDiscard={() => {
          if (base) setForm(base);
          setAttempted(false);
        }}
      />

      {isEdit && (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          critical
          title="Delete this brand?"
          description="Brands with products cannot be deleted. This cannot be undone."
          confirmLabel="Delete brand"
          onConfirm={onDelete}
        />
      )}
    </>
  );
}
