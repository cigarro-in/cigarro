import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Check, ChevronsUpDown, Loader2, Plus, Search, X } from 'lucide-react';
import { cn } from '../../../components/ui/utils';
import { toActionError, type ActionError } from '../../ui';
import type { TaxonomyOption } from './useCatalogTaxonomy';

type Common = {
  /** undefined while loading. */
  options: TaxonomyOption[] | undefined;
  /** Accessible name and placeholder noun, e.g. "brand". */
  noun: string;
  placeholder?: string;
  /** Create an entity from the typed text, resolve to its id. Omit to hide "Create". */
  onCreate?: (text: string) => Promise<string>;
  disabled?: boolean;
  id?: string;
};

type SingleProps = Common & { multiple?: false; value: string; onChange: (id: string) => void };
type MultiProps = Common & { multiple: true; value: string[]; onChange: (ids: string[]) => void };

const CREATE = '__create__';

/**
 * Searchable picker for brands, categories and collections. Typing a name
 * that does not exist offers "Create '<text>'", which creates the entity in
 * place and selects it (no navigation). Single mode shows the choice in the
 * trigger; multi mode shows removable chips under it.
 */
export function EntityCombobox(props: SingleProps | MultiProps) {
  const { options, noun, placeholder, onCreate, disabled } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<ActionError | null>(null);
  // Names for ids created here, until the reactive list catches up.
  const [pendingLabels, setPendingLabels] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected = props.multiple ? props.value : props.value ? [props.value] : [];
  const labelOf = (id: string) => options?.find((o) => o.id === id)?.label ?? pendingLabels[id] ?? 'Unknown';

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (options ?? []).filter((o) => !q || o.label.toLowerCase().includes(q)),
    [options, q],
  );
  const exact = (options ?? []).some((o) => o.label.trim().toLowerCase() === q);
  const canCreate = !!onCreate && q.length > 0 && !exact;
  const rows: string[] = [...filtered.map((o) => o.id), ...(canCreate ? [CREATE] : [])];

  useEffect(() => setActive(0), [q, open]);
  useEffect(() => {
    if (!open) {
      setQuery('');
      setError(null);
    }
  }, [open]);

  const toggle = (id: string) => {
    if (props.multiple) {
      props.onChange(props.value.includes(id) ? props.value.filter((v) => v !== id) : [...props.value, id]);
    } else {
      props.onChange(props.value === id ? '' : id);
      setOpen(false);
    }
  };

  const create = async () => {
    if (!onCreate || creating) return;
    const text = query.trim();
    setCreating(true);
    setError(null);
    try {
      const id = await onCreate(text);
      setPendingLabels((p) => ({ ...p, [id]: text }));
      if (props.multiple) props.onChange([...props.value, id]);
      else props.onChange(id);
      setQuery('');
      if (!props.multiple) setOpen(false);
    } catch (err) {
      setError(toActionError(err, `Could not create ${noun}.`));
    } finally {
      setCreating(false);
    }
  };

  const choose = (row: string | undefined) => {
    if (!row) return;
    if (row === CREATE) void create();
    else toggle(row);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(rows.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(rows[active]);
    }
  };

  const triggerText = props.multiple
    ? placeholder ?? `Search or create ${noun}`
    : props.value
      ? labelOf(props.value)
      : placeholder ?? `Select ${noun}`;

  return (
    <div className="flex flex-col gap-2">
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Trigger asChild disabled={disabled}>
          <button
            type="button"
            id={props.id}
            aria-haspopup="listbox"
            aria-expanded={open}
            className={cn(
              'flex h-9 w-full items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border-strong)] bg-[var(--admin-surface)] px-3 text-left text-sm',
              'hover:bg-[var(--admin-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:opacity-50',
            )}
          >
            {props.multiple && <Search className="size-4 shrink-0 text-[var(--admin-text-subtle)]" aria-hidden />}
            <span
              className={cn(
                'min-w-0 flex-1 truncate',
                (props.multiple || !props.value) && 'text-[var(--admin-text-subtle)]',
              )}
            >
              {triggerText}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-[var(--admin-text-subtle)]" aria-hidden />
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="start"
            sideOffset={4}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              inputRef.current?.focus();
            }}
            className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[240px] overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text)] shadow-[var(--admin-shadow-popover)]"
          >
            <div className="flex items-center gap-2 border-b border-[var(--admin-border)] px-3">
              <Search className="size-4 shrink-0 text-[var(--admin-text-subtle)]" aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={onCreate ? `Search or create ${noun}` : `Search ${noun}`}
                aria-label={`Search ${noun}`}
                aria-controls={listId}
                aria-activedescendant={rows[active] ? `${listId}-${active}` : undefined}
                className="h-10 w-full bg-transparent text-base outline-none placeholder:text-[var(--admin-text-subtle)] md:text-sm"
              />
            </div>
            <ul id={listId} role="listbox" aria-multiselectable={props.multiple || undefined} className="max-h-64 overflow-y-auto p-1">
              {options === undefined && <li className="px-2 py-2 text-sm text-[var(--admin-text-muted)]">Loading…</li>}
              {options !== undefined && rows.length === 0 && (
                <li className="px-2 py-2 text-sm text-[var(--admin-text-muted)]">No {noun} found</li>
              )}
              {rows.map((row, i) => {
                if (row === CREATE) {
                  return (
                    <li
                      key={CREATE}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={false}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => void create()}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-[var(--admin-radius-sm)] px-2 py-2 text-sm font-medium text-[var(--admin-primary)]',
                        i === active && 'bg-[var(--admin-surface-hover)]',
                      )}
                    >
                      {creating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                      <span className="truncate">Create “{query.trim()}”</span>
                    </li>
                  );
                }
                const opt = filtered.find((o) => o.id === row)!;
                const isSel = selected.includes(row);
                return (
                  <li
                    key={row}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={isSel}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => toggle(row)}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-[var(--admin-radius-sm)] px-2 py-2 text-sm',
                      i === active && 'bg-[var(--admin-surface-hover)]',
                    )}
                  >
                    <Check className={cn('size-4 shrink-0 text-[var(--admin-primary)]', !isSel && 'invisible')} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                    {!opt.active && <span className="text-xs text-[var(--admin-text-subtle)]">Hidden</span>}
                  </li>
                );
              })}
            </ul>
            {error && (
              <p role="alert" className="border-t border-[var(--admin-border)] px-3 py-2 text-xs text-[var(--admin-critical)]">
                {error.message}
                {error.code ? ` (${error.code})` : ''}
              </p>
            )}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>

      {props.multiple && selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={`Selected ${noun}`}>
          {selected.map((id) => (
            <li
              key={id}
              className="inline-flex h-7 max-w-full items-center gap-1 rounded-full bg-[var(--admin-neutral-soft)] pl-2.5 pr-1 text-[13px] text-[var(--admin-text)]"
            >
              <span className="truncate">{labelOf(id)}</span>
              <button
                type="button"
                aria-label={`Remove ${labelOf(id)}`}
                onClick={() => toggle(id)}
                disabled={disabled}
                className="rounded-full p-0.5 text-[var(--admin-text-muted)] hover:bg-[var(--admin-surface-hover)] hover:text-[var(--admin-text)]"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
