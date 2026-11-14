import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { FileText } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { ORG_SLUG } from '../../lib/convex/org';
import { builtInStorePage } from '../../lib/content/builtinPages';
import { customPagePath, STORE_PAGES } from '../../lib/storePages/catalog';
import {
  Badge,
  BulkActionBar,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorBanner,
  FilterBar,
  FilterSelect,
  Page,
  useButtonFeedback,
  useRowSelection,
  type BadgeTone,
  type Column,
} from '../ui';

// live: published. default: built-in page with no saved version (storefront shows
// the default text). draft: saved built-in version not published (default still live).
// hidden: custom page not published (404 on the storefront).
type PageState = 'live' | 'default' | 'draft' | 'hidden';

interface PageRow {
  slug: string;
  title: string;
  path: string;
  state: PageState;
  /** Custom pages exist only as rows; built-in pages fall back to default text. */
  custom: boolean;
  hasRow: boolean;
  updatedAt: number | null;
}

const STATE_TONE: Record<PageState, BadgeTone> = {
  live: 'success',
  default: 'neutral',
  draft: 'warning',
  hidden: 'neutral',
};

const STATE_LABEL: Record<PageState, string> = {
  live: 'Live',
  default: 'Live (default content)',
  draft: 'Draft (unpublished changes)',
  hidden: 'Hidden',
};

const STATE_FILTERS = [
  { value: 'all', label: 'All pages' },
  { value: 'live', label: 'Live' },
  { value: 'default', label: 'Live (default content)' },
  { value: 'draft', label: 'Draft' },
  { value: 'hidden', label: 'Hidden' },
];

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Store pages: the built-in pages (About, Contact, policies) plus custom pages.
 * "Live (default content)" means a built-in page has no saved version, so the storefront
 * renders the default content.
 */
export function StorePagesPage() {
  const navigate = useNavigate();
  const rows = useQuery(api.storePages.listStorePagesForAdmin, { orgSlug: ORG_SLUG });
  const setPublished = useMutation(api.storePages.setStorePagesPublished);
  const deletePage = useMutation(api.storePages.deleteStorePage);

  const sel = useRowSelection();
  const [query, setQuery] = useState('');
  const [state, setState] = useState('all');
  const [confirm, setConfirm] = useState<null | 'reset' | 'delete'>(null);
  const publish = useButtonFeedback();
  const unpublish = useButtonFeedback();

  const pages: PageRow[] | undefined = useMemo(() => {
    if (rows === undefined) return undefined;
    const builtIn = STORE_PAGES.map((def): PageRow => {
      const row = rows.find((r) => r.slug === def.slug);
      const pageState: PageState = !row ? 'default' : row.published ? 'live' : 'draft';
      return {
        slug: def.slug,
        title: row?.title ?? builtInStorePage(def.slug)?.title ?? def.slug,
        path: def.path,
        state: pageState,
        custom: false,
        hasRow: !!row,
        updatedAt: row?.updatedAt ?? null,
      };
    });
    const custom = rows
      .filter((r) => !STORE_PAGES.some((def) => def.slug === r.slug))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((r): PageRow => ({
        slug: r.slug,
        title: r.title,
        path: customPagePath(r.slug),
        state: r.published ? 'live' : 'hidden',
        custom: true,
        hasRow: true,
        updatedAt: r.updatedAt,
      }));
    return [...builtIn, ...custom];
  }, [rows]);

  const visible = useMemo(() => {
    if (!pages) return undefined;
    const q = query.trim().toLowerCase();
    return pages.filter(
      (p) => (state === 'all' || p.state === state) && (!q || `${p.title} ${p.path}`.toLowerCase().includes(q)),
    );
  }, [pages, query, state]);

  useEffect(() => {
    sel.clear();
  }, [query, state]);

  const selected = (pages ?? []).filter((p) => sel.isSelected(p.slug));
  const selectedWithRows = selected.filter((p) => p.hasRow).map((p) => p.slug);
  const resetTargets = selected.filter((p) => p.hasRow && !p.custom);
  const deleteTargets = selected.filter((p) => p.custom);

  const setBulkPublished = (fb: ReturnType<typeof useButtonFeedback>, published: boolean) =>
    fb.run(async () => {
      if (selectedWithRows.length === 0) {
        throw { message: 'Open a built-in page and save it before publishing.' };
      }
      await setPublished({ orgSlug: ORG_SLUG, slugs: selectedWithRows, published });
      sel.clear();
    });

  const columns: Column<PageRow>[] = [
    {
      id: 'page',
      header: 'Page',
      cell: (p) => (
        <div className="flex min-w-0 items-center gap-3">
          <FileText className="size-4 flex-none text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{p.title}</p>
            <p className="truncate text-xs text-muted-foreground">{p.path}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (p) => <Badge tone={STATE_TONE[p.state]}>{STATE_LABEL[p.state]}</Badge>,
    },
    {
      id: 'updated',
      header: 'Last edited',
      hideBelow: 'sm',
      cell: (p) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {p.updatedAt ? formatDate(p.updatedAt) : '—'}
        </span>
      ),
    },
  ];

  const bulkError = publish.error || unpublish.error;
  const confirmTargets = confirm === 'delete' ? deleteTargets : resetTargets;

  return (
    <Page
      title="Pages"
      titleMeta={<span className="text-sm font-normal text-muted-foreground">Store pages</span>}
      primaryAction={{ label: 'New page', to: '/pages/new' }}
    >
      <ErrorBanner error={bulkError} />
      <Card padding="none">
        <FilterBar search={{ value: query, onChange: setQuery, placeholder: 'Search pages' }}>
          <FilterSelect label="State" value={state} options={STATE_FILTERS} onChange={setState} />
        </FilterBar>
        <DataTable
          columns={columns}
          rows={visible}
          getRowId={(p) => p.slug}
          selection={sel}
          onRowClick={(p) => navigate(`/pages/${p.slug}`)}
          rowLabel={(p) => `Edit ${p.title}`}
          empty={
            <EmptyState
              icon={<FileText />}
              title="No pages match these filters"
              description="Clear the search or state filter."
              action={<Button variant="secondary" onClick={() => { setQuery(''); setState('all'); }}>Clear filters</Button>}
            />
          }
        />
      </Card>

      <BulkActionBar
        count={sel.count}
        onClear={sel.clear}
        actions={
          <>
            <Button size="sm" variant="secondary" state={publish.state} onClick={() => setBulkPublished(publish, true)}>
              Publish
            </Button>
            <Button size="sm" variant="secondary" state={unpublish.state} onClick={() => setBulkPublished(unpublish, false)}>
              Unpublish
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setConfirm('reset')} disabled={resetTargets.length === 0}>
              Reset to default
            </Button>
            <Button size="sm" variant="critical" onClick={() => setConfirm('delete')} disabled={deleteTargets.length === 0}>
              Delete
            </Button>
          </>
        }
      />

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm === 'delete'
            ? `Delete ${confirmTargets.length} page(s)?`
            : `Reset ${confirmTargets.length} page(s) to default?`
        }
        description={
          confirm === 'delete'
            ? 'Deleted pages return 404 on the storefront. This cannot be undone.'
            : 'The saved version is deleted and the storefront shows the default content again. This cannot be undone.'
        }
        confirmLabel={confirm === 'delete' ? 'Delete pages' : 'Reset to default'}
        critical
        onConfirm={async () => {
          for (const p of confirmTargets) {
            await deletePage({ orgSlug: ORG_SLUG, slug: p.slug });
          }
          sel.clear();
        }}
      />
    </Page>
  );
}
