import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '../../components/ui/utils';
import type { ActionError } from './Button';

export type BannerTone = 'info' | 'success' | 'warning' | 'critical';

const TONE: Record<BannerTone, { box: string; icon: ReactNode }> = {
  info: {
    box: 'bg-[var(--admin-info-soft)] border-[var(--admin-info-border)]',
    icon: <Info className="size-4 text-[var(--admin-info)]" aria-hidden />,
  },
  success: {
    box: 'bg-[var(--admin-success-soft)] border-[var(--admin-success-border)]',
    icon: <CheckCircle2 className="size-4 text-[var(--admin-success)]" aria-hidden />,
  },
  warning: {
    box: 'bg-[var(--admin-warning-soft)] border-[var(--admin-warning-border)]',
    icon: <AlertTriangle className="size-4 text-[var(--admin-warning)]" aria-hidden />,
  },
  critical: {
    box: 'bg-[var(--admin-critical-soft)] border-[var(--admin-critical-border)]',
    icon: <XCircle className="size-4 text-[var(--admin-critical)]" aria-hidden />,
  },
};

/**
 * Inline message block (the toast replacement for messages that need words).
 * critical renders role="alert", others role="status".
 */
export function Banner({
  tone = 'info',
  title,
  children,
  action,
  onDismiss,
  className,
}: {
  tone?: BannerTone;
  title?: ReactNode;
  children?: ReactNode;
  /** Button(s) shown on the right (desktop) or below (mobile). */
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <div
      role={tone === 'critical' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-[var(--admin-radius)] border px-3 py-2.5 text-sm', t.box, className)}
    >
      <span className="mt-0.5 shrink-0">{t.icon}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-[var(--admin-text)]">
          {title && <p className="font-semibold">{title}</p>}
          {children && <div className={cn(title && 'text-[var(--admin-text-muted)]')}>{children}</div>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-m-1 shrink-0 rounded-md p-1 text-[var(--admin-text-muted)] hover:bg-black/5"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** Critical banner for a failed action, with the Convex error code when present. */
export function ErrorBanner({ error, onDismiss, className }: { error: ActionError | null | undefined; onDismiss?: () => void; className?: string }) {
  if (!error) return null;
  return (
    <Banner tone="critical" onDismiss={onDismiss} className={className}>
      {error.message}
      {error.code && <span className="ml-2 font-mono text-xs text-[var(--admin-text-muted)]">{error.code}</span>}
    </Banner>
  );
}
