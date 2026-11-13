import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '../../components/ui/utils';

/**
 * Filter row at the top of a list (inside the list Card, above the table).
 * Search on the left, filter slots (FilterChip, FilterSelect, DateRangePresets)
 * after it, optional `end` content (sort, export) on the right.
 * Wraps on mobile: search takes the full first row.
 */
export function FilterBar({
  search,
  children,
  end,
  className,
}: {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    /** Debounce in ms before onChange fires (default 0 = immediate). */
    debounceMs?: number;
  };
  children?: ReactNode;
  end?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2 px-3 py-2.5', className)}>
      {search && <SearchField {...search} />}
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      {end && <div className="ml-auto flex items-center gap-2">{end}</div>}
    </div>
  );
}

function SearchField({
  value,
  onChange,
  placeholder = 'Search',
  debounceMs = 0,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  useEffect(() => {
    if (!debounceMs || local === value) return;
    const t = setTimeout(() => onChange(local), debounceMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, debounceMs]);

  const update = (next: string) => {
    setLocal(next);
    if (!debounceMs) onChange(next);
  };

  return (
    <div className="relative w-full min-w-0 sm:w-auto sm:min-w-[240px] sm:flex-1 lg:max-w-sm">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-text-subtle)]" aria-hidden />
      <input
        type="search"
        value={local}
        onChange={(e) => update(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full rounded-[var(--admin-radius)] border border-[var(--admin-border-strong)] bg-[var(--admin-surface)] pl-8 pr-8 text-base text-[var(--admin-text)] placeholder:text-[var(--admin-text-subtle)] focus:border-[var(--admin-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-focus)]/20 md:text-sm [&::-webkit-search-cancel-button]:hidden"
      />
      {local && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => update('')}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--admin-text-subtle)] hover:text-[var(--admin-text)]"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** Toggle chip for a quick filter (e.g. "Unpaid", "Low stock"). */
export function FilterChip({
  label,
  active,
  onClick,
  count,
}: {
  label: ReactNode;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors',
        active
          ? 'border-[var(--admin-primary)] bg-[var(--admin-primary-soft)] text-[var(--admin-primary)]'
          : 'border-[var(--admin-border-strong)] bg-[var(--admin-surface)] text-[var(--admin-text)] hover:bg-[var(--admin-surface-hover)]',
      )}
    >
      {label}
      {typeof count === 'number' && <span className="tabular-nums opacity-70">{count}</span>}
    </button>
  );
}

export interface FilterOption<V extends string = string> {
  value: V;
  label: string;
}

/** Compact native select styled as a chip: "Status: All". Native = good on mobile. */
export function FilterSelect<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: V;
  options: FilterOption<V>[];
  onChange: (value: V) => void;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <label className="relative inline-flex h-8 cursor-pointer items-center gap-1 rounded-full border border-[var(--admin-border-strong)] bg-[var(--admin-surface)] pl-3 pr-7 text-[13px] font-medium text-[var(--admin-text)] hover:bg-[var(--admin-surface-hover)] focus-within:ring-2 focus-within:ring-[var(--admin-focus)]/30">
      <span className="text-[var(--admin-text-muted)]">{label}:</span>
      <span>{current?.label ?? value}</span>
      <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-[var(--admin-text-muted)]" aria-hidden />
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as V)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
