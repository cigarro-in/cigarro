import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Button, Dialog, ErrorBanner, Input, Label, Textarea, useButtonFeedback, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui';
import { StarPicker } from './Stars';

export interface ProductOption {
  supabaseId: string;
  name: string;
}

const EMPTY = { productId: '', rating: 5, userName: '', title: '', comment: '' };

/**
 * Admin-written review. It goes live straight away: the author is the
 * moderator. Attribute honestly; the backend defaults the name to "Cigarro Team".
 */
export function AddReviewDialog({
  open,
  onOpenChange,
  orgSlug,
  products,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  products: ProductOption[];
}) {
  const [form, setForm] = useState(EMPTY);
  const [attempted, setAttempted] = useState(false);
  const addReview = useMutation(api.reviews.createReview);
  const fb = useButtonFeedback();
  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }));

  const close = (next: boolean) => {
    if (!next) {
      setForm(EMPTY);
      setAttempted(false);
      fb.reset();
    }
    onOpenChange(next);
  };

  const submit = async () => {
    setAttempted(true);
    if (!form.productId) return;
    const ok = await fb.run(async () => {
      await addReview({
        orgSlug,
        productSupabaseId: form.productId,
        rating: form.rating,
        userName: form.userName.trim() || undefined,
        title: form.title.trim() || undefined,
        comment: form.comment.trim() || undefined,
      });
      return true;
    });
    if (ok) close(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="Add a review"
      description="Use this for feedback you received by phone or chat. It appears on the product straight away."
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)} disabled={fb.busy}>
            Cancel
          </Button>
          <Button variant="primary" state={fb.state} onClick={() => void submit()}>
            Publish review
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-1.5">
          <Label>Product</Label>
          <Select value={form.productId} onValueChange={(productId) => set({ productId })}>
            <SelectTrigger aria-invalid={attempted && !form.productId}>
              <SelectValue placeholder="Choose a product" />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.supabaseId} value={p.supabaseId}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {attempted && !form.productId && (
            <p className="text-xs text-[var(--admin-critical)]">Choose the product this review is for.</p>
          )}
        </div>

        <div className="grid gap-1.5">
          <Label>Rating</Label>
          <StarPicker value={form.rating} onChange={(rating) => set({ rating })} />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="rev-name">Reviewer name (optional)</Label>
          <Input
            id="rev-name"
            value={form.userName}
            onChange={(e) => set({ userName: e.target.value })}
            placeholder="Leave empty to show Cigarro Team"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="rev-title">Headline (optional)</Label>
          <Input id="rev-title" value={form.title} onChange={(e) => set({ title: e.target.value })} />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="rev-comment">Review (optional)</Label>
          <Textarea
            id="rev-comment"
            rows={4}
            value={form.comment}
            onChange={(e) => set({ comment: e.target.value })}
          />
        </div>

        <ErrorBanner error={fb.error} />
      </div>
    </Dialog>
  );
}
