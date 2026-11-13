import type { ReactNode } from 'react';
import { cn } from '../../components/ui/utils';

export interface TabItem<V extends string = string> {
  id: V;
  label: ReactNode;
  /** Optional count shown after the label (e.g. orders to prepare). */
  count?: number;
}

/**
 * Underlined view tabs (status views on list pages, sections on detail pages).
 * Controlled: keep `value` in state or the URL (?view=) so reloads keep the tab.
 * Scrolls horizontally on narrow screens instead of wrapping.
 */
export function Tabs<V extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: TabItem<V>[];
  value: V;
  onChange: (value: V) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'scrollbar-hide -mb-px flex gap-1 overflow-x-auto border-b border-[var(--admin-border)] px-2',
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative flex h-10 shrink-0 items-center gap-1.5 rounded-t-[var(--admin-radius-sm)] px-2.5 text-sm transition-colors',
              active
                ? 'font-semibold text-[var(--admin-text)] after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[var(--admin-primary)]'
                : 'text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]',
            )}
          >
            {tab.label}
            {typeof tab.count === 'number' && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-xs tabular-nums',
                  active ? 'bg-[var(--admin-primary-soft)] text-[var(--admin-primary)]' : 'bg-[var(--admin-neutral-soft)]',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
