import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../../components/ui/utils';
import { Button, type ButtonState } from '../../ui';

/**
 * Sticky save bar pinned to the bottom of the viewport while a form has
 * unsaved changes. Same footprint as BulkActionBar.
 */
export function SaveBar({
  visible,
  message = 'Unsaved changes',
  onSave,
  onDiscard,
  saveState,
  saveLabel = 'Save',
  discardLabel = 'Discard',
  saveDisabled,
}: {
  visible: boolean;
  message?: string;
  onSave: () => void;
  onDiscard?: () => void;
  saveState?: ButtonState;
  saveLabel?: string;
  discardLabel?: string;
  saveDisabled?: boolean;
}) {
  if (!visible) return null;
  return (
    <div
      role="region"
      aria-label="Save changes"
      className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-[720px] -translate-x-1/2 items-center gap-2 rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[var(--admin-shadow-bar)] md:left-[calc(50%+8rem)] md:w-auto md:min-w-[460px]"
    >
      <span className="flex items-center gap-2 text-sm font-medium text-[var(--admin-text)]">
        <span className="size-2 rounded-full bg-[var(--admin-warning)]" aria-hidden />
        {message}
      </span>
      <div className="ml-auto flex items-center gap-2">
        {onDiscard && (
          <Button variant="secondary" size="sm" onClick={onDiscard} disabled={saveState === 'loading'}>
            {discardLabel}
          </Button>
        )}
        <Button variant="primary" size="sm" state={saveState} onClick={onSave} disabled={saveDisabled}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}

/**
 * Card whose body is collapsed by default, for rarely used fields. The
 * header shows a one-line summary of the current values while collapsed.
 */
export function CollapsibleCard({
  title,
  summary,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  children,
}: {
  title: ReactNode;
  summary?: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  const open = controlledOpen ?? innerOpen;
  const setOpen = (o: boolean) => {
    setInnerOpen(o);
    onOpenChange?.(o);
  };
  const bodyId = useId();
  return (
    <section className="min-w-0 overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen(!open)}
        className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--admin-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--admin-focus)]"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[var(--admin-text)]">{title}</span>
          {!open && summary && <span className="mt-0.5 block truncate text-xs text-[var(--admin-text-muted)]">{summary}</span>}
        </span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-[var(--admin-text-muted)] transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open && (
        <div id={bodyId} className="px-4 pb-4">
          {children}
        </div>
      )}
    </section>
  );
}

/** Label + control + optional help/error, the admin form field stack. */
export function Field({
  label,
  htmlFor,
  help,
  error,
  required,
  children,
  aside,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  help?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  /** Right side of the label row (e.g. margin, a link). */
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-[var(--admin-text)]">
          {label}
          {required && <span className="text-[var(--admin-critical)]" aria-hidden> *</span>}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-[var(--admin-critical)]">{error}</p>
      ) : help ? (
        <p className="text-xs text-[var(--admin-text-muted)]">{help}</p>
      ) : null}
    </div>
  );
}

/** Rupee-prefixed number input. Empty string means "not set". */
export function MoneyInput({
  id,
  value,
  onChange,
  invalid,
  placeholder = '0.00',
}: {
  id?: string;
  value: number | undefined;
  onChange: (value: number) => void;
  invalid?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--admin-text-muted)]">₹</span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step="0.01"
        min={0}
        value={value === undefined || value === 0 || Number.isNaN(value) ? '' : value}
        onChange={(e) => onChange(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        className={cn(
          'h-9 w-full rounded-[var(--admin-radius)] border bg-[var(--admin-surface)] pl-7 pr-3 text-base tabular-nums text-[var(--admin-text)] placeholder:text-[var(--admin-text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-focus)]/20 md:text-sm',
          invalid ? 'border-[var(--admin-critical)]' : 'border-[var(--admin-border-strong)] focus:border-[var(--admin-focus)]',
        )}
      />
    </div>
  );
}
