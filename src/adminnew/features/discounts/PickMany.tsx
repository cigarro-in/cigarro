import { useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { cn } from '../../../components/ui/utils';
import { Input } from '../../ui';

export interface PickItem {
  id: string;
  label: string;
  /** Secondary text shown under the label (phone, price, ...). */
  sub?: string;
}

/**
 * Search-and-select list for many items (customers, products). Selected items
 * show as removable chips above the search. Filtering is client-side and
 * capped, so long catalogues stay responsive.
 */
export function PickMany({
  items,
  value,
  onChange,
  searchPlaceholder,
  emptyText,
  loading,
  max = 8,
}: {
  items: PickItem[] | undefined;
  value: string[];
  onChange: (ids: string[]) => void;
  searchPlaceholder: string;
  emptyText: string;
  loading?: boolean;
  max?: number;
}) {
  const [q, setQ] = useState('');
  const selected = useMemo(() => new Set(value), [value]);
  const byId = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = (items ?? []).filter((i) => !selected.has(i.id));
    const hit = needle
      ? list.filter((i) => `${i.label} ${i.sub ?? ''}`.toLowerCase().includes(needle))
      : list;
    return hit.slice(0, max);
  }, [items, q, selected, max]);

  const toggle = (id: string) =>
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Selected">
          {value.map((id) => (
            <li key={id}>
              <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--admin-primary)] bg-[var(--admin-primary-soft)] py-0.5 pl-2.5 pr-1 text-[13px] text-[var(--admin-primary)]">
                <span className="truncate">{byId.get(id)?.label ?? 'Removed item'}</span>
                <button
                  type="button"
                  aria-label={`Remove ${byId.get(id)?.label ?? 'item'}`}
                  onClick={() => toggle(id)}
                  className="rounded-full p-0.5 hover:bg-black/5"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-text-subtle)]" aria-hidden />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="pl-8"
        />
      </div>
      <div className="max-h-56 overflow-y-auto rounded-[var(--admin-radius)] border border-[var(--admin-border)]">
        {loading || items === undefined ? (
          <p className="px-3 py-3 text-sm text-[var(--admin-text-muted)]">Loading...</p>
        ) : matches.length === 0 ? (
          <p className="px-3 py-3 text-sm text-[var(--admin-text-muted)]">{q ? 'No matches.' : emptyText}</p>
        ) : (
          <ul>
            {matches.map((i) => (
              <li key={i.id} className="border-b border-[var(--admin-border)] last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggle(i.id)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[var(--admin-surface-hover)]',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[var(--admin-text)]">{i.label}</span>
                    {i.sub && <span className="block truncate text-xs text-[var(--admin-text-muted)]">{i.sub}</span>}
                  </span>
                  <Check className="size-4 shrink-0 text-transparent" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {items && !q && (items.length - selected.size) > max && (
        <p className="text-xs text-[var(--admin-text-muted)]">Type to find more.</p>
      )}
    </div>
  );
}
