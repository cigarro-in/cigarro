import { useState } from 'react';
import { Check, Trash2, Star, Plus } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { toast } from 'sonner';
import { DataTable } from '../components/shared/DataTable';
import { Req, ReqError } from '../components/shared/requiredFields';
import { PageHeader } from '../components/shared/PageHeader';

interface ReviewRow {
  _id: string;
  productSupabaseId: string;
  productName: string;
  userName: string;
  rating: number;
  title?: string;
  comment?: string;
  isApproved: boolean;
  createdAt: number;
}

export function ReviewsPage() {
  const [filter, setFilter] = useState<'pending' | 'approved' | 'all'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const rows = useQuery(
    api.reviews.listReviewsForAdmin,
    filter === 'all' ? {} : { approved: filter === 'approved' }
  );
  const setApproved = useMutation(api.reviews.setReviewApproved);
  const removeReview = useMutation(api.reviews.deleteReview);
  const addReview = useMutation(api.reviews.createReview);
  const loading = rows === undefined;

  const products = useQuery(api.adminCatalog.listProductsForAdmin, {});
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ productId: '', rating: 5, userName: '', title: '', comment: '' });
  const [saveAttempted, setSaveAttempted] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const submit = () =>
    act(async () => {
      setSaveAttempted(true);
      if (!form.productId) throw new Error('Pick a product');
      await addReview({
        productSupabaseId: form.productId,
        rating: form.rating,
        userName: form.userName || undefined,
        title: form.title || undefined,
        comment: form.comment || undefined,
      });
      setForm({ productId: '', rating: 5, userName: '', title: '', comment: '' });
      setSaveAttempted(false);
      setShowForm(false);
    }, 'Review added', 'Failed to add review');

  const act = async (fn: () => Promise<unknown>, ok: string, fail: string) => {
    try {
      await fn();
      toast.success(ok);
      setSelected([]);
    } catch (error: any) {
      toast.error(
        error?.data?.code === 'NOT_REVIEWS_ADMIN' ? 'Admin access required' : fail
      );
    }
  };

  const columns = [
    {
      key: 'productName',
      label: 'Product',
      render: (_: any, r: ReviewRow) => (
        <div>
          <div className="font-medium text-gray-900">{r.productName}</div>
          <div className="text-xs text-gray-500">
            {r.userName} · {new Date(r.createdAt).toLocaleDateString()}
          </div>
        </div>
      )
    },
    {
      key: 'rating',
      label: 'Rating',
      sortable: true,
      render: (rating: number) => (
        <span className="inline-flex items-center gap-1">
          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          {rating}
        </span>
      )
    },
    {
      key: 'comment',
      label: 'Review',
      render: (_: any, r: ReviewRow) => (
        <div className="max-w-md">
          {r.title && <div className="font-medium text-sm">{r.title}</div>}
          <div className="text-sm text-gray-600 line-clamp-3">{r.comment || '—'}</div>
        </div>
      )
    },
    {
      key: 'isApproved',
      label: 'Status',
      render: (approved: boolean) => (
        <Badge className={approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
          {approved ? 'Approved' : 'Pending'}
        </Badge>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-[var(--color-creme)]">
      <PageHeader
        title="Reviews"
        description="Moderate customer reviews"
        search={{ value: searchTerm, onChange: setSearchTerm, placeholder: 'Search reviews...' }}
      >
        <div className="flex gap-2">
          {(['pending', 'approved', 'all'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f}
            </Button>
          ))}
        </div>
      </PageHeader>

      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <div>
          <Button size="sm" onClick={() => { setSaveAttempted(false); setShowForm((s) => !s); }}>
            <Plus className="w-4 h-4 mr-1" /> Add review
          </Button>
          {showForm && (
            <div className="mt-3 max-w-xl space-y-3 rounded-lg border border-[var(--color-coyote)]/30 bg-[var(--color-creme-light)] p-4">
              <div>
                <p className="text-xs font-medium mb-1">Product <Req /></p>
                <Select value={form.productId} onValueChange={(v) => set({ productId: v })}>
                  <SelectTrigger aria-invalid={saveAttempted && !form.productId}>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {((products || []) as any[]).filter((p) => p.isActive).map((p) => (
                      <SelectItem key={p.supabaseId} value={p.supabaseId}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ReqError show={saveAttempted && !form.productId}>
                  Pick a product for this review
                </ReqError>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => set({ rating: n })} aria-label={`${n} stars`}>
                    <Star className={`w-6 h-6 ${n <= form.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                  </button>
                ))}
              </div>
              <Input placeholder="Name (blank = Cigarro Team)" value={form.userName} onChange={(e) => set({ userName: e.target.value })} />
              <Input placeholder="Title (optional)" value={form.title} onChange={(e) => set({ title: e.target.value })} />
              <Textarea placeholder="Review (optional)" value={form.comment} onChange={(e) => set({ comment: e.target.value })} />
              <div className="flex gap-2">
                <Button size="sm" onClick={submit}>Save review</Button>
                <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
        <DataTable
          data={(rows || []) as ReviewRow[]}
          columns={columns}
          loading={loading}
          selectedItems={selected}
          onSelectionChange={setSelected}
          bulkActions={[
            {
              label: 'Approve Selected',
              icon: Check,
              onClick: (ids: string[]) =>
                act(
                  () => Promise.all(ids.map((id) => setApproved({ id: id as any, isApproved: true }))).then(() => {}),
                  `${ids.length} reviews approved`,
                  'Failed to approve'
                )
            },
            {
              label: 'Delete Selected',
              icon: Trash2,
              variant: 'destructive' as const,
              onClick: (ids: string[]) => {
                if (!confirm(`Delete ${ids.length} reviews?`)) return Promise.resolve();
                return act(
                  () => Promise.all(ids.map((id) => removeReview({ id: id as any }))).then(() => {}),
                  `${ids.length} reviews deleted`,
                  'Failed to delete'
                );
              }
            }
          ]}
          searchTerm={searchTerm}
          hideToolbar={true}
        />
      </div>
    </div>
  );
}
