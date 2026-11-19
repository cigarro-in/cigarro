import { useState, type ReactNode } from 'react';
import { AlertCircle, Check, X } from 'lucide-react';
import { cn } from '../../../../components/ui/utils';
import { STAGE_LABEL, type UploadItem, type UploadStage } from './useImageUploads';

/** Image that fades in once decoded, over a quiet placeholder (no flash of broken image). */
export function Thumb({
  src,
  alt = '',
  className,
  fit = 'cover',
  referrerPolicy,
  fallback,
}: {
  src: string;
  alt?: string;
  className?: string;
  fit?: 'cover' | 'contain';
  referrerPolicy?: 'no-referrer';
  fallback?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [current, setCurrent] = useState(src);
  const [failed, setFailed] = useState(false);
  if (current !== src && current !== fallback) {
    setCurrent(src);
    setLoaded(false);
    setFailed(false);
  }
  return (
    <span className={cn('relative block size-full overflow-hidden bg-[var(--admin-surface-subtle)]', className)}>
      {!failed && (
        <img
          src={current}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          referrerPolicy={referrerPolicy}
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (fallback && current !== fallback) setCurrent(fallback);
            else setFailed(true);
          }}
          className={cn(
            'size-full transition-opacity duration-150 motion-reduce:transition-none',
            fit === 'cover' ? 'object-cover' : 'object-contain',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
      {!loaded && !failed && <span aria-hidden className="admin-skeleton absolute inset-0 rounded-none" />}
      {failed && (
        <span className="absolute inset-0 flex items-center justify-center text-xs text-[var(--admin-text-subtle)]">No preview</span>
      )}
    </span>
  );
}

const STAGE_WIDTH: Record<UploadStage, string> = {
  queued: 'w-[8%]',
  fetching: 'w-1/4',
  converting: 'w-1/2',
  uploading: 'w-3/4',
  done: 'w-full',
  error: 'w-full',
};

/** Progress strip at the bottom of a tile. */
export function StageBar({ stage }: { stage: UploadStage }) {
  return (
    <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-[var(--admin-surface)]/70">
      <span
        className={cn(
          'block h-full transition-[width] duration-150 ease-out motion-reduce:transition-none',
          STAGE_WIDTH[stage],
          stage === 'error' ? 'bg-[var(--admin-critical)]' : stage === 'done' ? 'bg-[var(--admin-success)]' : 'bg-[var(--admin-primary)]',
        )}
      />
    </span>
  );
}

/** Overlay that says what is happening to one image, on the image itself. */
export function StageOverlay({ item, onDismiss }: { item: UploadItem; onDismiss?: () => void }) {
  const working = item.stage !== 'done' && item.stage !== 'error';
  return (
    <>
      {working && (
        <span className="absolute inset-0 flex items-end justify-start bg-[var(--admin-surface)]/40 p-1.5">
          <span className="rounded-full bg-[var(--admin-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--admin-text)] shadow-sm">
            {STAGE_LABEL[item.stage]}…
          </span>
        </span>
      )}
      {item.stage === 'done' && (
        <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-[var(--admin-success)] text-white shadow-sm">
          <Check className="size-3.5" aria-hidden />
        </span>
      )}
      {item.stage === 'error' && (
        <span role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[var(--admin-critical-soft)]/95 p-2 text-center">
          <AlertCircle className="size-4 text-[var(--admin-critical)]" aria-hidden />
          <span className="line-clamp-3 text-[11px] font-medium leading-tight text-[var(--admin-critical)]">{item.error || 'Failed'}</span>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="mt-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium text-[var(--admin-text)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]"
            >
              Dismiss
            </button>
          )}
        </span>
      )}
      <StageBar stage={item.stage} />
    </>
  );
}

/** A file being uploaded, shown in the grid where it will land. */
export function UploadTile({ item, onDismiss, className }: { item: UploadItem; onDismiss?: () => void; className?: string }) {
  return (
    <div
      className={cn('relative aspect-square overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-border)]', className)}
      aria-label={`${item.name}: ${STAGE_LABEL[item.stage]}`}
    >
      {item.preview ? <Thumb src={item.preview} /> : <span className="block size-full bg-[var(--admin-surface-subtle)]" />}
      <StageOverlay item={item} onDismiss={onDismiss} />
    </div>
  );
}

/** Round selection marker in a tile corner: a number (multi) or a tick (single). */
export function SelectMark({ order, multiple, visible }: { order: number; multiple: boolean; visible: boolean }) {
  const on = order >= 0;
  return (
    <span
      aria-hidden
      className={cn(
        'absolute left-1.5 top-1.5 flex size-6 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition-[opacity,background-color] duration-150',
        on
          ? 'border-[var(--admin-primary)] bg-[var(--admin-primary)] text-[var(--admin-text-on-primary)] opacity-100'
          : 'border-[var(--admin-border-strong)] bg-[var(--admin-surface)]/90 group-hover:opacity-100',
        !on && !visible && 'opacity-0',
      )}
    >
      {on ? multiple ? order + 1 : <Check className="size-3.5" /> : null}
    </span>
  );
}

export function SmallBadge({ children }: { children: ReactNode }) {
  return (
    <span className="absolute bottom-1.5 left-1.5 rounded-full bg-[var(--admin-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--admin-text-muted)] shadow-sm">
      {children}
    </span>
  );
}

export function DismissButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-6 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)]/95 text-[var(--admin-text)] shadow-sm hover:bg-[var(--admin-surface-hover)]"
    >
      <X className="size-3.5" aria-hidden />
    </button>
  );
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "camel-yellow-pack.webp" → "Camel yellow pack". */
export function displayName(name: string): string {
  const base = name.replace(/\.[a-z0-9]+$/i, '').replace(/^\d{10,}[-_]/, '');
  const words = base.replace(/[-_]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : name;
}
