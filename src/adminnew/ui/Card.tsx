import type { ReactNode } from 'react';
import { cn } from '../../components/ui/utils';

/**
 * Flat white container with a hairline border. Optional header row with a
 * title on the left and `actions` on the right. `padding="none"` for tables
 * and lists that run edge to edge.
 */
export function Card({
  title,
  actions,
  children,
  footer,
  padding = 'default',
  className,
  id,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  padding?: 'default' | 'none';
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        'min-w-0 overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)]',
        className,
      )}
    >
      {(title || actions) && (
        <header
          className={cn(
            'flex min-h-12 items-center justify-between gap-3 px-4 py-3',
            padding === 'none' && 'border-b border-[var(--admin-border)]',
          )}
        >
          {title && <h2 className="min-w-0 truncate text-sm font-semibold text-[var(--admin-text)]">{title}</h2>}
          {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {children !== undefined && children !== null && (
        <div className={cn(padding === 'default' && 'px-4 pb-4', padding === 'default' && !(title || actions) && 'pt-4')}>
          {children}
        </div>
      )}
      {footer && (
        <footer className="flex items-center justify-end gap-2 border-t border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-4 py-3">
          {footer}
        </footer>
      )}
    </section>
  );
}

/** Divided block inside a Card (e.g. a second group of fields). */
export function CardSection({ title, children, className }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('border-t border-[var(--admin-border)] px-4 py-4 first:border-t-0', className)}>
      {title && <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">{title}</h3>}
      {children}
    </div>
  );
}
