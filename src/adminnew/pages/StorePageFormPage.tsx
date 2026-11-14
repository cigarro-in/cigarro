import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { ORG_SLUG } from '../../lib/convex/org';
import { builtInStorePage } from '../../lib/content/builtinPages';
import { customPagePath, CUSTOM_PAGE_SLUG_PATTERN, storePageBySlug } from '../../lib/storePages/catalog';
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
import { slugify, snapshot } from '../features/content/contentForm';

interface PageForm {
  title: string;
  slug: string;
  body: string;
  status: string;
  metaTitle: string;
  metaDescription: string;
}

const SLUG_MESSAGES: Record<string, string> = {
  SLUG_TAKEN: 'Another page in this store already uses that URL. Choose a different one.',
  SLUG_RESERVED: 'That URL is reserved by the store. Choose a different one.',
  SLUG_INVALID: 'Use lowercase letters, numbers and single hyphens only.',
  TITLE_REQUIRED: 'Add a title before saving.',
};

const NEW_SLUG = 'new';
const BLANK: PageForm = { title: '', slug: '', body: '', status: 'draft', metaTitle: '', metaDescription: '' };

const DEFAULT_TOKEN_NOTE =
  'Words in double braces, such as {{storeName}}, are filled in from Store settings on the storefront.';

/**
 * Edit one store page. Built-in pages (About, Contact, policies) keep their URL
 * and open with their live text, so the editor always starts from what is shown.
 * Custom pages are created at /pages/new and live at /pages/<slug>.
 */
export function StorePageFormPage() {
  const navigate = useNavigate();
  const { slug = '' } = useParams();
  const isNew = slug === NEW_SLUG;
  const builtIn = isNew ? null : storePageBySlug(slug);
  const builtInDef = builtIn ? builtInStorePage(builtIn.slug) : null;

  const rows = useQuery(api.storePages.listStorePagesForAdmin, { orgSlug: ORG_SLUG });
  const savePage = useMutation(api.storePages.saveStorePage);
  const createPage = useMutation(api.storePages.createStorePage);
  const deletePage = useMutation(api.storePages.deleteStorePage);

  const [form, setForm] = useState<PageForm>(BLANK);
  const [saved, setSaved] = useState('');
  const [hasRow, setHasRow] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [showTitleError, setShowTitleError] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const save = useButtonFeedback();

  useEffect(() => {
    if (loaded || rows === undefined) return;
    if (isNew) {
      setForm(BLANK);
      setSaved(snapshot(BLANK));
      setLoaded(true);
      return;
    }
    const row = rows.find((r) => r.slug === slug);
    if (!builtIn && !row) return; // Not found: rendered below.
    // A built-in page with no saved version starts from its live default text.
    const next: PageForm = row
      ? {
          title: row.title,
          slug,
          body: row.body,
          status: row.published ? 'published' : 'draft',
          metaTitle: row.metaTitle ?? '',
          metaDescription: row.metaDescription ?? '',
        }
      : {
          title: builtInDef?.title ?? '',
          slug,
          body: builtInDef?.html ?? '',
          status: 'draft',
          metaTitle: '',
          metaDescription: '',
        };
    setForm(next);
    setSaved(snapshot(next));
    setHasRow(!!row);
    setLoaded(true);
  }, [rows, loaded, builtIn, builtInDef, slug, isNew]);

  const notFound = !isNew && rows !== undefined && !builtIn && !rows.some((r) => r.slug === slug);

  if (notFound) {
    return (
      <Page title="Page not found" backTo="/pages">
        <Card>
          <EmptyState
            title="Unknown store page"
            description="This page does not exist in the store."
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
  const isCustom = !builtIn;
  const path = builtIn?.path ?? customPagePath(isNew ? slugify(form.slug || form.title) || 'new-page' : slug);
  const statusOptions = [
    { value: 'published', label: 'Live' },
    { value: 'draft', label: isCustom ? 'Hidden' : 'Draft (unpublished changes)' },
  ];

  const onSave = () => {
    if (!form.title.trim()) {
      setShowTitleError(true);
      return;
    }
    const current = form;
    const currentSlug = isNew ? slugify(current.slug || current.title) : slug;
    const pageArgs = {
      title: current.title.trim(),
      body: current.body,
      published: current.status === 'published',
      metaTitle: current.metaTitle.trim() || undefined,
      metaDescription: current.metaDescription.trim() || undefined,
    };
    save.run(async () => {
      if (isNew && !CUSTOM_PAGE_SLUG_PATTERN.test(currentSlug)) {
        throw { message: SLUG_MESSAGES.SLUG_INVALID, code: 'SLUG_INVALID' };
      }
      try {
        if (isNew) {
          await createPage({ orgSlug: ORG_SLUG, slug: currentSlug, page: pageArgs });
        } else {
          await savePage({ orgSlug: ORG_SLUG, slug, page: pageArgs });
        }
      } catch (err) {
        const e = toActionError(err, 'Could not save the page. Try again.');
        throw { message: (e.code && SLUG_MESSAGES[e.code]) || e.message, code: e.code };
      }
      if (isNew) {
        navigate(customPagePath(currentSlug), { replace: true });
        return;
      }
      setSaved(snapshot(current));
      setHasRow(true);
    });
  };

  const titleError = showTitleError && !form.title.trim() ? SLUG_MESSAGES.TITLE_REQUIRED : null;

  return (
    <Page
      title={builtInDef?.title ?? (form.title.trim() || 'New page')}
      backTo="/pages"
      titleMeta={
        <div className="flex items-center gap-2">
          {isCustom ? (
            <Badge tone={isNew ? 'neutral' : published ? 'success' : 'neutral'}>
              {isNew ? 'New' : published ? 'Live' : 'Hidden'}
            </Badge>
          ) : (
            <Badge tone={published ? 'success' : hasRow ? 'warning' : 'neutral'}>
              {published ? 'Live' : hasRow ? 'Draft (unpublished changes)' : 'Live (default content)'}
            </Badge>
          )}
          {dirty && <Badge tone="attention">Unsaved changes</Badge>}
        </div>
      }
      primaryAction={{ label: isNew ? 'Create page' : 'Save', onClick: onSave, state: save.state }}
      secondaryActions={
        isNew || !hasRow
          ? []
          : [{ label: isCustom ? 'Delete page' : 'Reset to default', critical: true, onClick: () => setResetOpen(true) }]
      }
    >
      <ErrorBanner error={save.error} />
      {builtIn && (
        <Banner
          tone="info"
          title={hasRow ? 'Saved version of this page' : 'Editing the live default page'}
        >
          {hasRow
            ? 'The storefront shows this version once it is Live. Until then the default content stays up. '
            : 'Your edits start from the live text. Nothing changes on the storefront until you save with status Live. '}
          {DEFAULT_TOKEN_NOTE}
        </Banner>
      )}
      <PageLayout
        main={
          <ContentWritingEditor
            title={form.title}
            onTitleChange={(v) =>
              setForm((prev) => ({ ...prev, title: v, slug: isNew && !slugTouched ? slugify(v) : prev.slug }))
            }
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
            statusOptions={statusOptions}
            statusHint={
              published
                ? `Live at ${path}${builtIn ? ', replacing the default content' : ''}.`
                : isCustom
                  ? 'Hidden. Only live pages appear on the storefront.'
                  : 'Saved but not live. The storefront keeps showing the default content.'
            }
            slug={isNew ? form.slug : slug}
            onSlugChange={(v) => {
              setSlugTouched(true);
              update('slug', slugify(v));
            }}
            slugPrefix="/pages/"
            slugReadOnly={!isNew}
            metaTitle={form.metaTitle}
            onMetaTitleChange={(v) => update('metaTitle', v)}
            metaTitlePlaceholder={form.title || builtInDef?.title || ''}
            metaDescription={form.metaDescription}
            onMetaDescriptionChange={(v) => update('metaDescription', v)}
            metaDescriptionPlaceholder="Short summary for search results"
          />
        }
      />

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={isCustom ? `Delete ${form.title || 'this page'}?` : `Reset ${builtInDef?.title} to default?`}
        description={
          isCustom
            ? `The page is removed and ${path} returns 404. This cannot be undone.`
            : 'Your saved version is deleted. The storefront shows the default content again. This cannot be undone.'
        }
        confirmLabel={isCustom ? 'Delete page' : 'Reset to default'}
        critical
        onConfirm={async () => {
          await deletePage({ orgSlug: ORG_SLUG, slug });
          navigate('/pages', { replace: true });
        }}
      />
    </Page>
  );
}
