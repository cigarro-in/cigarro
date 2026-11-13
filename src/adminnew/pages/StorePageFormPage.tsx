import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { ORG_SLUG } from '../../lib/convex/org';
import { storePageBySlug } from '../../lib/storePages/catalog';
import {
  Badge,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Page,
  PageLayout,
  Skeleton,
  toActionError,
  useButtonFeedback,
} from '../ui';
import { ContentWritingEditor } from '../features/content/ContentWritingEditor';
import { ContentSidebar } from '../features/content/ContentSidebar';
import { snapshot } from '../features/content/contentForm';

interface PageForm {
  title: string;
  body: string;
  status: string;
  metaTitle: string;
  metaDescription: string;
}

const STATUS_OPTIONS = [
  { value: 'published', label: 'Published (replaces the built-in page)' },
  { value: 'draft', label: 'Unpublished (built-in page stays live)' },
];

/** Edit one store page (About, Contact, policies) with the same writing column as blog posts. */
export function StorePageFormPage() {
  const navigate = useNavigate();
  const { slug = '' } = useParams();
  const def = storePageBySlug(slug);

  const rows = useQuery(api.storePages.listStorePagesForAdmin, { orgSlug: ORG_SLUG });
  const savePage = useMutation(api.storePages.saveStorePage);
  const deletePage = useMutation(api.storePages.deleteStorePage);

  const [form, setForm] = useState<PageForm>({ title: '', body: '', status: 'draft', metaTitle: '', metaDescription: '' });
  const [saved, setSaved] = useState('');
  const [hasRow, setHasRow] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showTitleError, setShowTitleError] = useState(false);
  const [revertOpen, setRevertOpen] = useState(false);
  const save = useButtonFeedback();

  useEffect(() => {
    if (!def || loaded || rows === undefined) return;
    const row = rows.find((r) => r.slug === slug);
    const next: PageForm = row
      ? {
          title: row.title,
          body: row.body,
          status: row.published ? 'published' : 'draft',
          metaTitle: row.metaTitle ?? '',
          metaDescription: row.metaDescription ?? '',
        }
      : { title: def.title, body: '', status: 'draft', metaTitle: '', metaDescription: '' };
    setForm(next);
    setSaved(snapshot(next));
    setHasRow(!!row);
    setLoaded(true);
  }, [rows, loaded, def, slug]);

  if (!def) {
    return (
      <Page title="Page not found" backTo="/pages">
        <Card>
          <EmptyState
            title="Unknown store page"
            description="Only the storefront's built-in pages can be edited here."
            action={<Button variant="secondary" onClick={() => navigate('/pages')}>Back to pages</Button>}
          />
        </Card>
      </Page>
    );
  }

  if (!loaded) {
    return (
      <Page title="Loading page" backTo="/pages">
        <div className="space-y-3">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-96 w-full" />
        </div>
      </Page>
    );
  }

  const dirty = saved !== snapshot(form);
  const update = <K extends keyof PageForm>(key: K, value: PageForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const published = form.status === 'published';

  const onSave = () => {
    if (!form.title.trim()) {
      setShowTitleError(true);
      return;
    }
    const current = form;
    save.run(async () => {
      try {
        await savePage({
          orgSlug: ORG_SLUG,
          slug,
          page: {
            title: current.title.trim(),
            body: current.body,
            published: current.status === 'published',
            metaTitle: current.metaTitle.trim() || undefined,
            metaDescription: current.metaDescription.trim() || undefined,
          },
        });
      } catch (err) {
        throw toActionError(err, 'Could not save the page. Try again.');
      }
      setSaved(snapshot(current));
      setHasRow(true);
    });
  };

  const titleError = showTitleError && !form.title.trim() ? 'Add a title before saving.' : null;

  return (
    <Page
      title={def.title}
      backTo="/pages"
      titleMeta={
        <div className="flex items-center gap-2">
          <Badge tone={published ? 'success' : hasRow ? 'warning' : 'neutral'}>
            {published ? 'Published' : hasRow ? 'Unpublished' : 'Built-in'}
          </Badge>
          {dirty && <Badge tone="attention">Unsaved changes</Badge>}
        </div>
      }
      primaryAction={{ label: 'Save', onClick: onSave, state: save.state }}
      secondaryActions={hasRow ? [{ label: 'Revert to built-in', critical: true, onClick: () => setRevertOpen(true) }] : []}
    >
      <ErrorBanner error={save.error} />
      {!hasRow && (
        <Banner tone="info" title="The built-in page is live">
          Write a custom version here and publish it to replace the default content. Until then, nothing changes on the storefront.
        </Banner>
      )}
      <PageLayout
        main={
          <ContentWritingEditor
            title={form.title}
            onTitleChange={(v) => update('title', v)}
            titleError={titleError}
            titlePlaceholder="Page title"
            body={form.body}
            onBodyChange={(v) => update('body', v)}
            showCover={false}
            bodyPlaceholder="Write the page. Use headings, bold, links and lists from the toolbar."
          />
        }
        aside={
          <ContentSidebar
            status={form.status}
            onStatusChange={(v) => update('status', v)}
            statusOptions={STATUS_OPTIONS}
            statusHint={`Live at ${def.path}`}
            slug={slug}
            onSlugChange={() => undefined}
            slugPrefix="/"
            slugReadOnly
            metaTitle={form.metaTitle}
            onMetaTitleChange={(v) => update('metaTitle', v)}
            metaTitlePlaceholder={form.title || def.title}
            metaDescription={form.metaDescription}
            onMetaDescriptionChange={(v) => update('metaDescription', v)}
            metaDescriptionPlaceholder="Short summary for search results"
          />
        }
      />

      <ConfirmDialog
        open={revertOpen}
        onOpenChange={setRevertOpen}
        title={`Revert ${def.title} to the built-in page?`}
        description="Your custom text is deleted. The storefront shows the default page again. This cannot be undone."
        confirmLabel="Revert and delete"
        critical
        onConfirm={async () => {
          await deletePage({ orgSlug: ORG_SLUG, slug });
          navigate('/pages', { replace: true });
        }}
      />
    </Page>
  );
}
