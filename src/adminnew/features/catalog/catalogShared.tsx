import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, Save } from 'lucide-react';
import { ImageWithFallback } from '../../../components/ui/ImageWithFallback';
import { cn } from '../../../components/ui/utils';
import {
  Badge,
  Button,
  Label,
  toActionError,
  type ActionError,
  type ButtonState,
} from '../../ui';

/** Readable copy for Convex error codes raised by convex/adminCatalog.ts. */
const CATALOG_ERROR_MESSAGES: Record<string, string> = {
  NOT_CATALOG_ADMIN: 'Admin access required.',
  SLUG_TAKEN: 'That slug is already used by another item.',
  BRAND_IN_USE: 'This brand has products and cannot be deleted.',
  NOT_FOUND: 'This item no longer exists. Reload the page.',
};

/** Convex error to ActionError. Keeps the Convex code, maps known codes to copy. */
export function catalogError(err: unknown, fallback: string): ActionError {
  const base = toActionError(err, fallback);
  const mapped = base.code ? CATALOG_ERROR_MESSAGES[base.code] : undefined;
  return { message: mapped ?? (base.code ? fallback : base.message), code: base.code };
}

/** Square image or icon tile used in lists, cards and previews. */
export function CatalogThumb({
  src,
  icon,
  alt,
  className,
}: {
  src: string | null | undefined;
  icon: ReactNode;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[var(--admin-radius-sm)] border border-[var(--admin-border)] bg-[var(--admin-neutral-soft)]',
        className,
      )}
    >
      {src ? (
        <ImageWithFallback src={src} alt={alt} className="size-full object-cover" />
      ) : (
        <span className="text-[var(--admin-text-muted)] [&_svg]:size-4" aria-hidden>
          {icon}
        </span>
      )}
    </div>
  );
}

export function CatalogStatus({ active }: { active: boolean }) {
  return active ? (
    <Badge tone="success" dot>
      Active
    </Badge>
  ) : (
    <Badge tone="neutral">Inactive</Badge>
  );
}

/**
 * Tracks the saved snapshot of a form. `dirty` is true once the current value
 * differs from the first snapshot (or from the last `rebaseline` after save).
 */
export function useFormBaseline<T>(value: T | null) {
  const [base, setBase] = useState<T | null>(null);
  useEffect(() => {
    if (value !== null && base === null) setBase(value);
  }, [value, base]);
  const dirty = base !== null && value !== null && JSON.stringify(value) !== JSON.stringify(base);
  return { base, dirty, rebaseline: setBase };
}

/** Sticky bottom bar shown while the form has unsaved changes (or a save is settling). */
export function SaveBar({
  visible,
  state,
  onSave,
  onDiscard,
}: {
  visible: boolean;
  state: ButtonState;
  onSave: () => void;
  onDiscard: () => void;
}) {
  if (!visible) return null;
  return (
    <div
      role="region"
      aria-label="Save changes"
      className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-[720px] -translate-x-1/2 items-center gap-2 rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[var(--admin-shadow-bar)] md:left-[calc(50%+8rem)] md:w-auto md:min-w-[420px]"
    >
      <span className="min-w-0 flex-1 truncate text-sm text-[var(--admin-text-muted)]">
        {state === 'success' ? 'All changes saved' : 'Unsaved changes'}
      </span>
      <Button variant="plain" size="sm" onClick={onDiscard} disabled={state === 'loading'}>
        Discard
      </Button>
      <Button variant="primary" size="sm" icon={<Save />} state={state} onClick={onSave}>
        Save
      </Button>
    </div>
  );
}

/** Labelled form row. Pass `htmlFor` matching the input id. */
export function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-[var(--admin-text)]">
        {label}
        {required && <span className="text-[var(--admin-critical)]"> *</span>}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-[var(--admin-critical)]">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-[var(--admin-text-muted)]">{hint}</p>
      )}
    </div>
  );
}

/**
 * Collapsed section for rarely used fields (slug, SEO, extras). Stays closed
 * until opened, or until `forceOpen` (e.g. a required field in it is invalid).
 */
export function DisclosureCard({
  title,
  summary,
  forceOpen,
  children,
}: {
  title: string;
  summary?: ReactNode;
  forceOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const isOpen = open || !!forceOpen;
  return (
    <section className="min-w-0 overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setOpen(!isOpen)}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--admin-surface-hover)]"
      >
        <span className="text-sm font-semibold text-[var(--admin-text)]">{title}</span>
        <span className="flex min-w-0 items-center gap-2 text-xs text-[var(--admin-text-muted)]">
          {!isOpen && summary && <span className="truncate">{summary}</span>}
          <ChevronDown className={cn('size-4 shrink-0 transition-transform', isOpen && 'rotate-180')} aria-hidden />
        </span>
      </button>
      {isOpen && <div className="flex flex-col gap-4 border-t border-[var(--admin-border)] px-4 py-4">{children}</div>}
    </section>
  );
}
