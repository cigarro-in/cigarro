import type { ReactNode } from 'react';
import { cn } from '../../components/ui/utils';

/** Shimmer block. Size it with className (h-4 w-32 ...). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('admin-skeleton h-4 rounded-[var(--admin-radius-sm)]', className)} />;
}

/** N lines of text placeholder; the last line is shorter. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

/** Table-shaped placeholder that matches DataTable row height (no layout jump). */
export function SkeletonTable({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div role="status" aria-label="Loading" className="divide-y divide-[var(--admin-border)]">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex h-12 items-center gap-4 px-4">
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className={cn('h-3.5', c === 0 ? 'w-24' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Centered empty state for lists and cards. Keep the title short; one action at most. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-12 text-center', className)}>
      {icon && (
        <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-[var(--admin-neutral-soft)] text-[var(--admin-text-muted)] [&_svg]:size-5">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-[var(--admin-text)]">{title}</p>
      {description && <p className="max-w-sm text-sm text-[var(--admin-text-muted)]">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
