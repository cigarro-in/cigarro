import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

/**
 * Sticky bar pinned to the bottom of the viewport while rows are selected.
 * Renders nothing when count is 0. Put Buttons (size="sm") in `actions`;
 * show results by button state, errors in a Banner above the table.
 *
 *   <BulkActionBar count={sel.count} onClear={sel.clear} actions={<Button size="sm" ...>Mark as shipped</Button>} />
 */
export function BulkActionBar({
  count,
  onClear,
  actions,
  noun = 'selected',
}: {
  count: number;
  onClear: () => void;
  actions: ReactNode;
  noun?: string;
}) {
  if (count <= 0) return null;
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="admin-bulk-bar fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-[720px] -translate-x-1/2 items-center gap-2 rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 shadow-[var(--admin-shadow-bar)] md:left-[calc(50%+8rem)] md:w-auto md:min-w-[420px] pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <Button variant="plain" size="icon" className="size-8" aria-label="Clear selection" onClick={onClear}>
        <X aria-hidden />
      </Button>
      <span className="whitespace-nowrap text-sm font-medium tabular-nums text-[var(--admin-text)]">
        {count} {noun}
      </span>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{actions}</div>
    </div>
  );
}
