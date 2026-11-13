import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../../components/ui/utils';

/**
 * Collapsed block for advanced options. Opens by itself when `defaultOpen`
 * (e.g. the section already holds a value), so nothing set is ever hidden.
 */
export function CollapsibleSection({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-t border-[var(--admin-border)] first:border-t-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--admin-surface-hover)]"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-[var(--admin-text)]">{title}</span>
          {hint && <span className="block truncate text-xs text-[var(--admin-text-muted)]">{hint}</span>}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-[var(--admin-text-muted)] transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && <div className="flex flex-col gap-4 px-4 pb-4">{children}</div>}
    </section>
  );
}
