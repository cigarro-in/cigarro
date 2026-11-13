import { Star } from 'lucide-react';
import { cn } from '../../../components/ui/utils';

/** Read-only rating: five stars, filled up to `value`. */
export function Stars({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          aria-hidden
          className={cn(
            'size-3.5',
            i < value ? 'fill-[var(--admin-warning)] text-[var(--admin-warning)]' : 'text-[var(--admin-border-strong)]',
          )}
        />
      ))}
    </span>
  );
}

/** Editable rating: one button per star. */
export function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
          aria-pressed={value === n}
          onClick={() => onChange(n)}
          className="rounded p-0.5 hover:bg-[var(--admin-surface-hover)]"
        >
          <Star
            aria-hidden
            className={cn(
              'size-6',
              n <= value ? 'fill-[var(--admin-warning)] text-[var(--admin-warning)]' : 'text-[var(--admin-border-strong)]',
            )}
          />
        </button>
      ))}
    </div>
  );
}
