import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
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
  SkeletonText,
  Switch,
  Textarea,
  Skeleton,
  useButtonFeedback,
} from '../ui';
import { LazyRichTextEditor } from '../ui/LazyRichTextEditor';

const LIST = '/collections';

interface CollectionForm {
  title: string;
  slug: string;
  description: string;
  image: string | null;
  isActive: boolean;
  sortOrder: number;
  seoTitle: string;
  seoDescription: string;
  productIds: string[];
}

export function CollectionFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const rows = useQuery(api.adminCatalog.listCollectionsForAdmin, { orgSlug: ORG_SLUG });
  const saveCollection = useMutation(api.adminCatalog.saveCollection);
  const removeCollection = useMutation(api.adminCatalog.deleteCollection);
  const products = useCatalogProducts();

  const source: any = isEdit ? rows?.find((c: any) => c.supabaseId === id) : undefined;
  const notFound = isEdit && rows !== undefined && !source;
  const ready = rows !== undefined && !notFound;

  const [form, setForm] = useState<CollectionForm | null>(null);
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [attempted, setAttempted] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const save = useButtonFeedback();
  const { base, dirty, rebaseline } = useFormBaseline(form);

  // Seed the form once: from the saved row when editing, defaults when creating
  // (display order = next after the highest existing one).
  useEffect(() => {
    if (!ready || form) return;
    if (source) {
      setForm({
        title: source.title || '',
        slug: source.slug || '',
        description: source.description || '',
        image: source.imageUrl || null,
        isActive: source.isActive !== false,
        sortOrder: source.sortOrder || 1,
        seoTitle: source.seoTitle || '',
        seoDescription: source.seoDescription || '',
        productIds: source.productSupabaseIds || [],
      });
    } else {
      const next = Math.max(0, ...(rows ?? []).map((c: any) => c.sortOrder ?? 0)) + 1;
      setForm({
        title: '',
        slug: '',
        description: '',
        image: null,
        isActive: true,
        sortOrder: next,
        seoTitle: '',
        seoDescription: '',
        productIds: [],
      });
    }
  }, [ready, form, source, rows]);

  const patch = (p: Partial<CollectionForm>) => setForm((f) => (f ? { ...f, ...p } : f));

  const onTitle = (title: string) => patch({ title, ...(slugTouched ? {} : { slug: generateSlug(title) }) });
  const onSlug = (value: string) => {
    setSlugTouched(true);
    patch({ slug: generateSlug(value) });
  };

  const onSave = async () => {
    if (!form) return;
    setAttempted(true);
    if (!form.title.trim() || !form.slug.trim()) return;
    const submitted = form;
    const result = await save.run(() =>
      saveCollection({
        orgSlug: ORG_SLUG,
        supabaseId: id,
        collection: {
          title: submitted.title.trim(),
          slug: submitted.slug.trim(),
          description: submitted.description.trim() || undefined,
          imageUrl: submitted.image || undefined,
          isActive: submitted.isActive,
          sortOrder: submitted.sortOrder,
          seoTitle: submitted.seoTitle.trim() || submitted.title.trim(),
          seoDescription: submitted.seoDescription.trim() || undefined,
        },
        productSupabaseIds: submitted.productIds,
      }),
    );
    if (!result) return;
    if (isEdit) rebaseline(submitted);
    else window.setTimeout(() => navigate(LIST), 700);
  };

  const onDelete = async () => {
    try {
      await removeCollection({ supabaseId: id!, orgSlug: ORG_SLUG });
    } catch (err) {
      throw new Error(catalogError(err, 'Could not delete this collection.').message);
    }
    navigate(LIST);
  };

  if (notFound) {
    return (
      <Page title="Not found" backTo={LIST}>
        <Card>
          <EmptyState
            title="This collection no longer exists"
            action={<Button onClick={() => navigate(LIST)}>Back to collections</Button>}
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

  const titleText = form.title.trim() || (isEdit ? 'Untitled collection' : 'New collection');
  const titleMissing = attempted && !form.title.trim();
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
                  <Field
                    label="Name"
                    htmlFor="collection-name"
                    required
                    error={titleMissing ? 'Enter a collection name.' : undefined}
                  >
                    <Input
                      id="collection-name"
                      value={form.title}
                      onChange={(e) => onTitle(e.target.value)}
                      placeholder="e.g. Premium Selection"
                      aria-invalid={titleMissing}
                    />
                  </Field>
                  <Field label="Description" htmlFor="collection-description">
                    <LazyRichTextEditor
                      id="collection-description"
                      variant="compact"
                      ariaLabel="Description"
                      minHeight={128}
                      value={form.description}
                      onChange={(description) => patch({ description })}
                      placeholder="Describe the collection"
                    />
                  </Field>
                  <Field label="Image">
                    <SingleImagePicker
                      value={form.image}
                      onChange={(url) => patch({ image: url || null })}
                      searchHint={form.title ? `${form.title} collection` : undefined}
                    />
                  </Field>
                </div>
              </Card>

              <Card
                title="Products"
                actions={<span className="text-xs text-[var(--admin-text-muted)]">{form.productIds.length} in this collection</span>}
              >
                <ProductMembers
                  selectedIds={form.productIds}
                  products={products}
                  onChange={(productIds) => patch({ productIds })}
                />
              </Card>

              <DisclosureCard
                title="Slug, order and SEO"
                summary={`/collections/${form.slug || '…'}`}
                forceOpen={slugMissing}
              >
                <Field label="URL slug" htmlFor="collection-slug" required error={slugMissing ? 'Slug is required.' : undefined} hint="Created from the name. Edit to override.">
                  <Input
                    id="collection-slug"
                    value={form.slug}
                    onChange={(e) => onSlug(e.target.value)}
                    placeholder="collection-slug"
                    aria-invalid={slugMissing}
                  />
                </Field>
                <Field label="Display order" htmlFor="collection-order" hint="Lower numbers show first.">
                  <Input
                    id="collection-order"
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => patch({ sortOrder: parseInt(e.target.value) || 1 })}
                  />
                </Field>
                <Field label="Meta title" htmlFor="collection-meta-title" hint="Defaults to the collection name.">
                  <Input
                    id="collection-meta-title"
                    value={form.seoTitle}
                    onChange={(e) => patch({ seoTitle: e.target.value })}
                  />
                </Field>
                <Field label="Meta description" htmlFor="collection-meta-description">
                  <Textarea
                    id="collection-meta-description"
                    rows={3}
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
                    <Label htmlFor="collection-active">Active</Label>
                    <p className="text-xs text-[var(--admin-text-muted)]">Shown to customers on the store.</p>
                  </div>
                  <Switch
                    id="collection-active"
                    checked={form.isActive}
                    onCheckedChange={(isActive) => patch({ isActive })}
                  />
                </div>
              </Card>

              <Card title="Preview">
                <div className="flex items-center gap-3">
                  <CatalogThumb src={form.image} icon={<LayoutGrid />} alt="" className="size-12" />
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
          title="Delete this collection?"
          description="Products are not deleted. This cannot be undone."
          confirmLabel="Delete collection"
          onConfirm={onDelete}
        />
      )}
    </>
  );
}
