import { useCallback, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, ChevronLeft, ChevronRight, Minus } from 'lucide-react';
import { cn } from '../../components/ui/utils';
import { Button } from './Button';
import { SkeletonTable } from './Feedback';

/** Admin checkbox with an indeterminate state (header "select all"). */
export function Checkbox({
  checked,
  onCheckedChange,
  label,
  disabled,
}: {
  checked: boolean | 'indeterminate';
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <CheckboxPrimitive.Root
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onCheckedChange={(v) => onCheckedChange(v === true)}
      onClick={(e) => e.stopPropagation()}
      className="flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-[var(--admin-border-strong)] bg-[var(--admin-surface)] text-white transition-colors data-[state=checked]:border-[var(--admin-primary)] data-[state=checked]:bg-[var(--admin-primary)] data-[state=indeterminate]:border-[var(--admin-primary)] data-[state=indeterminate]:bg-[var(--admin-primary)] disabled:opacity-50"
    >
      <CheckboxPrimitive.Indicator>
        {checked === 'indeterminate' ? <Minus className="size-3" strokeWidth={3} /> : <Check className="size-3" strokeWidth={3} />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

/** Row selection state for DataTable + BulkActionBar. */
export function useRowSelection() {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const clear = useCallback(() => setSelected(new Set()), []);
  return useMemo(
    () => ({
      selected,
      setSelected,
      toggle,
      clear,
      count: selected.size,
      isSelected: (id: string) => selected.has(id),
      ids: Array.from(selected),
    }),
    [selected, toggle, clear],
  );
}

export interface Column<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  /** Tailwind width class, e.g. 'w-32'. */
  width?: string;
  /** Hide on narrow screens: 'sm' hides below 640px, 'md' below 768px, 'lg' below 1024px. */
  hideBelow?: 'sm' | 'md' | 'lg';
  className?: string;
}

const HIDE: Record<NonNullable<Column<unknown>['hideBelow']>, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
};

/**
 * Simple data table. Put it inside <Card padding="none"> under a FilterBar.
 * - onRowClick: whole row is clickable + keyboard (Enter/Space). Inner buttons should stopPropagation.
 * - selection: pass the object from useRowSelection() to get a checkbox column.
 * - loading: renders SkeletonTable with the same row height (no flicker).
 * - empty: rendered when rows is empty and not loading (use <EmptyState/>).
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  onRowClick,
  rowLabel,
  selection,
  loading,
  empty,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Accessible label for a clickable row, e.g. (o) => `Open order ${o.number}`. */
  rowLabel?: (row: T) => string;
  selection?: ReturnType<typeof useRowSelection>;
  loading?: boolean;
  empty?: ReactNode;
}) {
  if (loading || rows === undefined) return <SkeletonTable columns={Math.min(columns.length, 5)} />;
  if (rows.length === 0) return <>{empty ?? null}</>;

  const ids = rows.map(getRowId);
  const selectedHere = selection ? ids.filter((id) => selection.selected.has(id)).length : 0;
  const headerChecked: boolean | 'indeterminate' =
    selectedHere === 0 ? false : selectedHere === ids.length ? true : 'indeterminate';

  const align = (a?: Column<T>['align']) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');

  const onKey = (e: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (!onRowClick || e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onRowClick(row);
    }
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-subtle)]">
            {selection && (
              <th className="w-10 py-2 pl-4 pr-0">
                <Checkbox
                  label="Select all"
                  checked={headerChecked}
                  onCheckedChange={(on) =>
                    selection.setSelected((prev) => {
                      const next = new Set(prev);
                      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
                      return next;
                    })
                  }
                />
              </th>
            )}
            {columns.map((c) => (
              <th
                key={c.id}
                scope="col"
                className={cn(
                  'h-9 whitespace-nowrap px-4 text-xs font-medium text-[var(--admin-text-muted)]',
                  align(c.align),
                  c.width,
                  c.hideBelow && HIDE[c.hideBelow],
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = getRowId(row);
            const isSel = selection?.selected.has(id) ?? false;
            return (
              <tr
                key={id}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? 'link' : undefined}
                aria-label={onRowClick && rowLabel ? rowLabel(row) : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={(e) => onKey(e, row)}
                className={cn(
                  'h-12 border-b border-[var(--admin-border)] last:border-b-0',
                  onRowClick && 'cursor-pointer transition-colors duration-150 hover:bg-[var(--admin-surface-hover)] focus-visible:bg-[var(--admin-surface-hover)] focus-visible:outline-none motion-reduce:transition-none',
                  isSel && 'bg-[var(--admin-surface-selected)] hover:bg-[var(--admin-surface-selected)]',
                )}
              >
                {selection && (
                  <td className="w-10 py-2 pl-4 pr-0" onClick={(e) => e.stopPropagation()}>
                    <Checkbox label="Select row" checked={isSel} onCheckedChange={() => selection.toggle(id)} />
                  </td>
                )}
                {columns.map((c) => (
                  <td
                    key={c.id}
                    className={cn('px-4 py-2 align-middle text-[var(--admin-text)]', align(c.align), c.hideBelow && HIDE[c.hideBelow], c.className)}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Prev/next pagination for cursor or page lists. Shows "Page x of y" when
 * pageCount is known, otherwise just the arrows (hasNext decides).
 */
export function Pagination({
  page,
  pageCount,
  hasNext,
  onPageChange,
  summary,
}: {
  /** 1-based. */
  page: number;
  pageCount?: number;
  hasNext?: boolean;
  onPageChange: (page: number) => void;
  /** Optional left text, e.g. "1–50 of 312". */
  summary?: ReactNode;
}) {
  const canNext = pageCount !== undefined ? page < pageCount : !!hasNext;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[var(--admin-border)] px-4 py-2.5 text-sm text-[var(--admin-text-muted)]">
      <span className="tabular-nums">{summary ?? (pageCount ? `Page ${page} of ${pageCount}` : `Page ${page}`)}</span>
      <div className="flex items-center gap-1">
        <Button variant="secondary" size="icon" className="size-8" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft aria-hidden />
        </Button>
        <Button variant="secondary" size="icon" className="size-8" aria-label="Next page" disabled={!canNext} onClick={() => onPageChange(page + 1)}>
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}

/** Client-side paging helper: slice `items` into pages of `pageSize`. */
export function paginate<T>(items: T[], page: number, pageSize = 50): { pageItems: T[]; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const p = Math.min(Math.max(1, page), pageCount);
  return { pageItems: items.slice((p - 1) * pageSize, p * pageSize), pageCount };
}
