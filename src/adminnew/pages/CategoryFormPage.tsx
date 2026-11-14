import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FolderTree } from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { ORG_SLUG } from '../../lib/convex/org';
import { generateSlug } from '../../types/product';
import { SingleImagePicker } from '../components/shared/ImagePicker';
import { ProductMembers, useCatalogProducts } from '../features/catalog/ProductMembers';
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
import { LazyRichTextEditor } from '../ui/LazyRichTextEditor';

const LIST = '/categories';

interface CategoryForm {
  name: string;
  slug: string;
  description: string;
  image: string | null;
  isActive: boolean;
  seoTitle: string;
  seoDescription: string;
  productIds: string[];
}

export function CategoryFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const rows = useQuery(api.adminCatalog.listCategoriesForAdmin, { orgSlug: ORG_SLUG });
  const createCategory = useMutation(api.adminCatalog.createCategory);
  const updateCategory = useMutation(api.adminCatalog.updateCategory);
  const removeCategory = useMutation(api.adminCatalog.deleteCategory);
  const linkProducts = useMutation(api.adminCatalog.setCategoryProducts);
  const setActive = useMutation(api.adminCatalog.setCategoriesActive);
  const products = useCatalogProducts();

  const source: any = isEdit ? rows?.find((c: any) => c.supabaseId === id) : undefined;
  const notFound = isEdit && rows !== undefined && !source;
  const ready = rows !== undefined && !notFound;

  const [form, setForm] = useState<CategoryForm | null>(null);
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
        image: source.image || null,
        isActive: source.isActive !== false,
        seoTitle: source.metaTitle || '',
        seoDescription: source.metaDescription || '',
        productIds: source.productSupabaseIds || [],
      });
    } else {
      setForm({
        name: '',
        slug: '',
        description: '',
        image: null,
        isActive: true,
        seoTitle: '',
        seoDescription: '',
        productIds: [],
      });
    }
  }, [ready, form, source]);

  const patch = (p: Partial<CategoryForm>) => setForm((f) => (f ? { ...f, ...p } : f));

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
      image: submitted.image || undefined,
      metaTitle: submitted.seoTitle.trim() || submitted.name.trim(),
      metaDescription: submitted.seoDescription.trim() || undefined,
    };
    const result = await save.run(async () => {
      let categoryId = id;
      if (isEdit) {
        await updateCategory({ supabaseId: id!, patch: args, orgSlug: ORG_SLUG });
      } else {
        const created = await createCategory({ ...args, orgSlug: ORG_SLUG });
        categoryId = created.supabaseId;
      }
      // Replace-set semantics: the picker list is the full membership.
      await linkProducts({ supabaseId: categoryId!, productSupabaseIds: submitted.productIds, orgSlug: ORG_SLUG });
      // Visibility lives on the category row but is not part of categoryV, so it is set separately.
      const wasActive = source ? source.isActive !== false : true;
      if (submitted.isActive !== wasActive) {
        await setActive({ supabaseIds: [categoryId!], isActive: submitted.isActive, orgSlug: ORG_SLUG });
      }
      return categoryId;
    });
    if (!result) return;
    if (isEdit) rebaseline(submitted);
    else window.setTimeout(() => navigate(LIST), 700);
  };

  const onDelete = async () => {
    try {
      await removeCategory({ supabaseId: id!, orgSlug: ORG_SLUG });
    } catch (err) {
      throw new Error(catalogError(err, 'Could not delete this category.').message);
    }
    navigate(LIST);
  };

  if (notFound) {
    return (
      <Page title="Not found" backTo={LIST}>
        <Card>
          <EmptyState
            title="This category no longer exists"
            action={<Button onClick={() => navigate(LIST)}>Back to categories</Button>}
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

  const titleText = form.name.trim() || (isEdit ? 'Untitled category' : 'New category');
  const nameMissing = attempted && !form.name.trim();
  const slugMissing = attempted && !form.slug.trim();

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
                  <Field label="Name" htmlFor="category-name" required error={nameMissing ? 'Enter a category name.' : undefined}>
                    <Input
                      id="category-name"
                      value={form.name}
                      onChange={(e) => onName(e.target.value)}
                      placeholder="e.g. Premium Cigarettes"
                      aria-invalid={nameMissing}
                    />
                  </Field>
                  <Field label="Description" htmlFor="category-description">
                    <LazyRichTextEditor
                      id="category-description"
                      variant="compact"
                      ariaLabel="Description"
                      minHeight={128}
                      value={form.description}
                      onChange={(description) => patch({ description })}
                      placeholder="Describe the category"
                    />
                  </Field>
                  <Field label="Image">
                    <SingleImagePicker
                      value={form.image}
                      onChange={(url) => patch({ image: url || null })}
                      searchHint={form.name ? `${form.name} category` : undefined}
                    />
                  </Field>
                </div>
              </Card>

              <Card
                title="Products"
                actions={<span className="text-xs text-[var(--admin-text-muted)]">{form.productIds.length} in this category</span>}
              >
                <ProductMembers
                  selectedIds={form.productIds}
                  products={products}
                  onChange={(productIds) => patch({ productIds })}
                />
              </Card>

              <DisclosureCard title="Slug and SEO" summary={`/categories/${form.slug || '…'}`} forceOpen={slugMissing}>
                <Field label="URL slug" htmlFor="category-slug" required error={slugMissing ? 'Slug is required.' : undefined} hint="Created from the name. Edit to override.">
                  <Input
                    id="category-slug"
                    value={form.slug}
                    onChange={(e) => onSlug(e.target.value)}
                    placeholder="category-slug"
                    aria-invalid={slugMissing}
                  />
                </Field>
                <Field label="Meta title" htmlFor="category-meta-title" hint="Defaults to the category name.">
                  <Input
                    id="category-meta-title"
                    value={form.seoTitle}
                    onChange={(e) => patch({ seoTitle: e.target.value })}
                  />
                </Field>
                <Field label="Meta description" htmlFor="category-meta-description">
                  <Textarea
                    id="category-meta-description"
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
                    <Label htmlFor="category-active">Active</Label>
                    <p className="text-xs text-[var(--admin-text-muted)]">Shown to customers on the store.</p>
                  </div>
                  <Switch
                    id="category-active"
                    checked={form.isActive}
                    onCheckedChange={(isActive) => patch({ isActive })}
                  />
                </div>
              </Card>

              <Card title="Preview">
                <div className="flex items-center gap-3">
                  <CatalogThumb src={form.image} icon={<FolderTree />} alt="" className="size-12" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-[var(--admin-text)]">{titleText}</div>
                    <div className="line-clamp-2 text-xs text-[var(--admin-text-muted)]">
                      {form.description || 'No description yet'}
                    </div>
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
          title="Delete this category?"
          description="Products are not deleted. This cannot be undone."
          confirmLabel="Delete category"
          onConfirm={onDelete}
        />
      )}
    </>
  );
}
