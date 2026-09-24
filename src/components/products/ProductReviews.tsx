import { useState } from 'react';
import { Star } from 'lucide-react';
import { useInlineStatus, InlineStatus } from '../common/InlineStatus';
import { useProductReviews } from '../../hooks/data/useProductReviews';
import { useAuth } from '../../hooks/useAuth';

// Shared PDP reviews block (both themes). Data via the theme-safe hook —
// no Convex imports here. New reviews start unapproved (service-proof).

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
        />
      ))}
    </span>
  );
}

export function ProductReviews({
  productSupabaseId,
  productName,
}: {
  productSupabaseId: string;
  productName: string;
}) {
  const { user } = useAuth();
  const { reviews, count, average, loading, submitReview } = useProductReviews(productSupabaseId);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const { status: opStatus, setError: setOpError } = useInlineStatus();

  const handleSubmit = async () => {
    if (!user) {
      setOpError('Please log in to write a review');
      return;
    }
    if (!comment.trim()) {
      setOpError('Please write a few words');
      return;
    }
    setSaving(true);
    try {
      await submitReview({ rating, title: title.trim() || undefined, comment: comment.trim() });
      setDone(true);
      setTitle('');
      setComment('');
      // No ok-status: the "Submitted — visible after moderation." line below is the confirmation.
    } catch {
      setOpError('Could not submit review');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-32 py-16 border-t border-coyote/20">
      <div className="text-center mb-10">
        <h2 className="text-2xl font-light text-dark mb-4">Customer Reviews</h2>
        {loading ? (
          <p className="text-dark/60">Loading reviews…</p>
        ) : count > 0 ? (
          <div className="flex items-center justify-center gap-2">
            <Stars value={average} size={20} />
            <span className="text-dark/70">
              {average} · {count} review{count === 1 ? '' : 's'}
            </span>
          </div>
        ) : (
          <p className="text-dark/60">No reviews yet — be the first to review {productName}.</p>
        )}
      </div>

      {reviews.slice(0, 5).map((r) => (
        <div key={r._id} className="max-w-2xl mx-auto mb-6 border-b border-coyote/10 pb-6">
          <div className="flex items-center gap-2 mb-1">
            <Stars value={r.rating} />
            <span className="font-medium text-dark text-sm">{r.title || 'Verified review'}</span>
          </div>
          <p className="text-dark/80 text-sm mb-1">{r.comment}</p>
          <p className="text-xs text-dark/50">
            {r.userName} · {new Date(r.createdAt).toLocaleDateString()}
          </p>
        </div>
      ))}

      <div className="max-w-2xl mx-auto mt-10 space-y-3">
        <h3 className="font-medium text-dark">Write a review</h3>
        <InlineStatus status={opStatus} />
        {done && (
          <p className="text-sm text-green-700">Submitted — visible after moderation.</p>
        )}
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" onClick={() => setRating(i)} aria-label={`${i} stars`}>
              <Star
                style={{ width: 24, height: 24 }}
                className={i <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
              />
            </button>
          ))}
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Headline (optional)"
          className="w-full border border-coyote/30 rounded-lg px-3 py-2 text-sm bg-white"
        />
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={`What did you think of ${productName}?`}
          rows={4}
          className="w-full border border-coyote/30 rounded-lg px-3 py-2 text-sm bg-white"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="px-6 py-2 bg-canyon text-creme rounded-full text-sm disabled:opacity-50"
        >
          {saving ? 'Submitting…' : 'Submit review'}
        </button>
      </div>
    </div>
  );
}
