import { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Eye, EyeOff, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useOrg } from '../../lib/convex/useOrg';
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
  Menu,
  Page,
  useButtonFeedback,
  useRowSelection,
  type Column,
} from '../ui';
import { Stars } from '../features/reviews/Stars';
import { AddReviewDialog } from '../features/reviews/AddReviewDialog';
import { discountError } from '../features/discounts/discountErrors';

interface ReviewRow {
  _id: Id<'productReviews'>;
  productSupabaseId: string;
  productName: string;
  userName: string;
  rating: number;
  title?: string;
  comment?: string;
  isApproved: boolean;
  createdAt: number;
}

const DATE = (ms: number) => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export function ReviewsPage() {
  const org = useOrg();
  const orgSlug = org?.slug;

  const [status, setStatus] = useState<'all' | 'published' | 'hidden'>('all');
  const [ratingFilter, setRatingFilter] = useState<'all' | '5' | '4' | '3' | '2' | '1'>('all');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null);
  const sel = useRowSelection();
  const showFb = useButtonFeedback();
  const hideFb = useButtonFeedback();
  const delFb = useButtonFeedback();

  const rows = useQuery(
    api.reviews.listReviewsForAdmin,
    orgSlug ? { orgSlug, approved: status === 'all' ? undefined : status === 'published' } : 'skip',
  ) as ReviewRow[] | undefined;
  const products = useQuery(api.adminCatalog.listProductsForAdmin, orgSlug ? { orgSlug } : 'skip');
  const setApproved = useMutation(api.reviews.setReviewApproved);
  const removeReview = useMutation(api.reviews.deleteReview);

  const filtered = useMemo(() => {
    if (!rows) return undefined;
    const needle = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (ratingFilter !== 'all' && r.rating !== Number(ratingFilter)) return false;
      if (!needle) return true;
      return `${r.productName} ${r.userName} ${r.title ?? ''} ${r.comment ?? ''}`.toLowerCase().includes(needle);
    });
  }, [rows, query, ratingFilter]);

  const setPublished = (ids: string[], isApproved: boolean, fb: typeof showFb) =>
    fb.run(async () => {
      for (const id of ids) {
        await setApproved({ orgSlug: orgSlug!, id: id as Id<'productReviews'>, isApproved });
      }
      setTimeout(() => sel.clear(), 1200);
    });

  const columns: Column<ReviewRow>[] = [
    {
      id: 'product',
      header: 'Product',
      cell: (r) => (
        <div className="min-w-[160px]">
          <div className="font-medium text-[var(--admin-text)]">{r.productName}</div>
          <div className="text-xs text-[var(--admin-text-muted)]">
            {r.userName} · {DATE(r.createdAt)}
          </div>
        </div>
      ),
    },
    {
      id: 'rating',
      header: 'Rating',
      cell: (r) => <Stars value={r.rating} />,
    },
    {
      id: 'review',
      header: 'Review',
      cell: (r) => (
        <div className="max-w-md">
          {r.title && <div className="text-sm font-medium text-[var(--admin-text)]">{r.title}</div>}
          <div className="line-clamp-2 text-sm text-[var(--admin-text-muted)]">{r.comment || 'No written review'}</div>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) =>
        r.isApproved ? (
          <Badge tone="success" dot>Shown on site</Badge>
        ) : (
          <Badge tone="neutral" dot>Hidden</Badge>
        ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      width: 'w-12',
      cell: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Menu
            trigger={
              <Button variant="plain" size="icon" className="size-8" aria-label={`Actions for review of ${r.productName}`}>
                <MoreHorizontal aria-hidden />
              </Button>
            }
            items={[
              r.isApproved
                ? { label: 'Hide from site', icon: <EyeOff />, onSelect: () => void setPublished([r._id], false, hideFb) }
                : { label: 'Show on site', icon: <Eye />, onSelect: () => void setPublished([r._id], true, showFb) },
              { label: 'Delete', icon: <Trash2 />, tone: 'critical', onSelect: () => setConfirmIds([r._id]) },
            ]}
          />
        </div>
      ),
    },
  ];

  const loading = rows === undefined;
  const hasAny = (rows?.length ?? 0) > 0;
  const error = showFb.error ?? hideFb.error ?? delFb.error;
  const productOptions = useMemo(
    () => (products ?? []).filter((p) => p.isActive).map((p) => ({ supabaseId: p.supabaseId, name: p.name })),
    [products],
  );

  return (
    <Page
      title="Reviews"
      primaryAction={{ label: 'Add review', icon: <Plus />, onClick: () => setAdding(true), disabled: !orgSlug }}
    >
      {error && <ErrorBanner error={error} />}
      <Card padding="none">
        <FilterBar search={{ value: query, onChange: setQuery, placeholder: 'Search product, name or words' }}>
          <FilterSelect
            label="Rating"
            value={ratingFilter}
            onChange={setRatingFilter}
            options={[
              { value: 'all', label: 'Any' },
              { value: '5', label: '5 stars' },
              { value: '4', label: '4 stars' },
              { value: '3', label: '3 stars' },
              { value: '2', label: '2 stars' },
              { value: '1', label: '1 star' },
            ]}
          />
          <FilterSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All' },
              { value: 'published', label: 'Shown on site' },
              { value: 'hidden', label: 'Hidden' },
            ]}
          />
        </FilterBar>
        <DataTable<ReviewRow>
          columns={columns}
          rows={filtered}
          loading={loading}
          getRowId={(r) => r._id}
          selection={sel}
          empty={
            hasAny ? (
              <EmptyState title="No reviews match these filters" />
            ) : (
              <EmptyState
                title="No reviews yet"
                description="Customer reviews appear here once they are submitted."
              />
            )
          }
        />
      </Card>

      <BulkActionBar
        count={sel.count}
        onClear={sel.clear}
        noun="selected"
        actions={
          <>
            <Button size="sm" icon={<Eye />} state={showFb.state} onClick={() => void setPublished(sel.ids, true, showFb)}>
              Show on site
            </Button>
            <Button size="sm" icon={<EyeOff />} state={hideFb.state} onClick={() => void setPublished(sel.ids, false, hideFb)}>
              Hide
            </Button>
            <Button size="sm" variant="critical" icon={<Trash2 />} onClick={() => setConfirmIds(sel.ids)}>
              Delete
            </Button>
          </>
        }
      />

      <ConfirmDialog
        open={confirmIds !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmIds(null);
        }}
        title={`Delete ${confirmIds?.length ?? 0} ${confirmIds?.length === 1 ? 'review' : 'reviews'}?`}
        description="Deleted reviews cannot be recovered. The product rating is updated."
        confirmLabel="Delete"
        critical
        onConfirm={async () => {
          const ids = confirmIds ?? [];
          try {
            for (const id of ids) await removeReview({ orgSlug: orgSlug!, id: id as Id<'productReviews'> });
            sel.clear();
          } catch (err) {
            throw discountError(err);
          }
        }}
      />

      {orgSlug && (
        <AddReviewDialog open={adding} onOpenChange={setAdding} orgSlug={orgSlug} products={productOptions} />
      )}
    </Page>
  );
}
