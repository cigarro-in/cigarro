import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { BookOpen, Plus } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { ORG_SLUG } from '../../lib/convex/org';
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
  Pagination,
  paginate,
  useButtonFeedback,
  useRowSelection,
  type BadgeTone,
  type Column,
} from '../ui';

type PostStatus = 'draft' | 'published' | 'archived';

interface BlogRow {
  id: string;
  title: string;
  excerpt: string;
  featuredImage: string | null;
  status: PostStatus;
  isFeatured: boolean;
  isPinned: boolean;
  categoryName: string | null;
  viewCount: number;
  date: number;
  searchText: string;
}

const PAGE_SIZE = 25;

const STATUS_TONE: Record<PostStatus, BadgeTone> = {
  published: 'success',
  draft: 'warning',
  archived: 'neutral',
};

const STATUS_LABEL: Record<PostStatus, string> = {
  published: 'Published',
  draft: 'Draft',
  archived: 'Archived',
};

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function BlogsPage() {
  const navigate = useNavigate();
  const rows = useQuery(api.adminCatalog.listBlogPostsForAdmin, { orgSlug: ORG_SLUG });
  const setStatus = useMutation(api.adminCatalog.setBlogPostsStatus);
  const removePost = useMutation(api.adminCatalog.deleteBlogPost);

  const sel = useRowSelection();
  const [query, setQuery] = useState('');
  const [status, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const publish = useButtonFeedback();
  const draft = useButtonFeedback();
  const archive = useButtonFeedback();

  const posts: BlogRow[] | undefined = useMemo(
    () =>
      rows?.map((p) => ({
        id: p._id,
        title: p.title,
        excerpt: p.excerpt ?? '',
        featuredImage: p.featuredImage ?? null,
        status: p.status as PostStatus,
        isFeatured: p.isFeatured ?? false,
        isPinned: p.isPinned ?? false,
        categoryName: p.category?.name ?? null,
        viewCount: p.viewCount ?? 0,
        date: p.publishedAt ?? p.updatedAt ?? p._creationTime,
        searchText: `${p.title} ${p.excerpt ?? ''} ${p.slug}`.toLowerCase(),
      })),
    [rows],
  );

  const filtered = useMemo(() => {
    if (!posts) return undefined;
    const q = query.trim().toLowerCase();
    return posts.filter((p) => (status === 'all' || p.status === status) && (!q || p.searchText.includes(q)));
  }, [posts, query, status]);

  // A new view resets paging and selection, so bulk actions never touch hidden rows.
  useEffect(() => {
    setPage(1);
    sel.clear();
  }, [query, status]);

  const { pageItems, pageCount } = paginate(filtered ?? [], page, PAGE_SIZE);
  const selectedIds = sel.ids as Id<'blogPosts'>[];

  const bulkStatus = (fb: ReturnType<typeof useButtonFeedback>, next: PostStatus) =>
    fb.run(async () => {
      await setStatus({ ids: selectedIds, status: next, orgSlug: ORG_SLUG });
      sel.clear();
    });

  const columns: Column<BlogRow>[] = [
    {
      id: 'post',
      header: 'Post',
      cell: (p) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-14 flex-none items-center justify-center overflow-hidden rounded-md bg-muted">
            {p.featuredImage ? (
              <img src={p.featuredImage} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <BookOpen className="size-4 text-muted-foreground" aria-hidden />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">
              {p.title}
              {p.isPinned && <span className="ml-2 text-xs font-normal text-muted-foreground">Pinned</span>}
              {p.isFeatured && <span className="ml-2 text-xs font-normal text-muted-foreground">Featured</span>}
            </p>
            <p className="truncate text-xs text-muted-foreground">{p.excerpt || 'No excerpt'}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      hideBelow: 'md',
      cell: (p) => <span className="text-sm text-muted-foreground">{p.categoryName ?? '—'}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (p) => <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>,
    },
    {
      id: 'views',
      header: 'Views',
      align: 'right',
      hideBelow: 'lg',
      cell: (p) => <span className="tabular-nums text-muted-foreground">{p.viewCount}</span>,
    },
    {
      id: 'date',
      header: 'Date',
      hideBelow: 'sm',
      cell: (p) => <span className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(p.date)}</span>,
    },
  ];

  const bulkError = publish.error || draft.error || archive.error;
  const filtering = query.trim() !== '' || status !== 'all';

  return (
    <Page
      title="Blogs"
      titleMeta={posts ? <span className="text-sm font-normal text-muted-foreground">{posts.length} total</span> : undefined}
      primaryAction={{ label: 'New post', icon: <Plus />, onClick: () => navigate('/blogs/new') }}
    >
      <ErrorBanner error={bulkError} />
      <Card padding="none">
        <FilterBar search={{ value: query, onChange: setQuery, placeholder: 'Search posts' }}>
          <FilterSelect label="Status" value={status} options={STATUS_FILTERS} onChange={setStatusFilter} />
        </FilterBar>
        <DataTable
          columns={columns}
          rows={filtered === undefined ? undefined : pageItems}
          getRowId={(p) => p.id}
          selection={sel}
          onRowClick={(p) => navigate(`/blogs/${p.id}`)}
          rowLabel={(p) => `Edit ${p.title}`}
          empty={
            <EmptyState
              icon={<BookOpen />}
              title={filtering ? 'No posts match these filters' : 'No posts yet'}
              description={filtering ? 'Clear the search or status filter.' : 'Write the first post for your readers.'}
              action={
                filtering ? undefined : (
                  <Button variant="primary" onClick={() => navigate('/blogs/new')}>
                    New post
                  </Button>
                )
              }
            />
          }
        />
        {filtered !== undefined && pageCount > 1 && (
          <Pagination
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
            summary={`${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
          />
        )}
      </Card>

      <BulkActionBar
        count={sel.count}
        onClear={sel.clear}
        actions={
          <>
            <Button size="sm" variant="secondary" state={publish.state} onClick={() => bulkStatus(publish, 'published')}>
              Publish
            </Button>
            <Button size="sm" variant="secondary" state={draft.state} onClick={() => bulkStatus(draft, 'draft')}>
              Move to draft
            </Button>
            <Button size="sm" variant="secondary" state={archive.state} onClick={() => bulkStatus(archive, 'archived')}>
              Archive
            </Button>
            <Button size="sm" variant="critical" onClick={() => setConfirmOpen(true)}>
              Delete
            </Button>
          </>
        }
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete ${sel.count} ${sel.count === 1 ? 'post' : 'posts'}?`}
        description="Deleted posts cannot be recovered and their URLs stop working."
        confirmLabel="Delete posts"
        critical
        onConfirm={async () => {
          for (const id of selectedIds) await removePost({ id, orgSlug: ORG_SLUG });
          sel.clear();
        }}
      />
    </Page>
  );
}
