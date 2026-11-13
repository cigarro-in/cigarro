import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { Loader2, Search, X } from 'lucide-react';
import { api } from '../../../../convex/_generated/api';
import { useOrg } from '../../../lib/convex/useOrg';
import { adminPath } from '../../lib/paths';
import { useDebouncedValue } from './useDebouncedValue';
import { flatItems, groupResults, type AdminSearchData, type SearchItem } from './searchResults';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Global admin search for the current store: orders (five-digit number, customer
 * name or phone), products (title) and customers (name or phone). One Convex
 * query (adminStats:searchAdmin, requireOrgAdmin). Lives in the Page header:
 * an inline field from sm up, a search icon on phones that opens the field over
 * the island. Cmd/Ctrl+K focuses it. Arrow keys move through results, Enter
 * opens, Escape closes.
 */
export function GlobalSearch() {
  const org = useOrg();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState(0);

  const term = useDebouncedValue(text.trim(), 180);
  const data = useQuery(api.adminStats.searchAdmin, org && term ? { orgId: org._id, text: term } : 'skip') as
    | AdminSearchData
    | undefined;

  const groups = useMemo(() => groupResults(data), [data]);
  const items = useMemo(() => flatItems(groups), [groups]);
  const showPanel = open && text.trim().length > 0;
  const loading = showPanel && data === undefined;

  // Cmd/Ctrl+K anywhere on an admin page.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!(e.key === 'k' || e.key === 'K') || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      setMobileOpen(true);
      // The field may only mount after the mobile state flips; focus next frame.
      requestAnimationFrame(() => inputRef.current?.focus());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close when pressing outside the search and its results.
  useEffect(() => {
    if (!showPanel && !mobileOpen) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setMobileOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [showPanel, mobileOpen]);

  useEffect(() => setActive(0), [term]);

  const choose = (item: SearchItem) => {
    setOpen(false);
    setMobileOpen(false);
    setText('');
    inputRef.current?.blur();
    navigate(adminPath(item.to));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (items.length ? (i + 1) % items.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
    } else if (e.key === 'Enter') {
      const item = items[active];
      if (showPanel && item) {
        e.preventDefault();
        choose(item);
      }
    } else if (e.key === 'Escape') {
      if (showPanel) {
        setOpen(false);
      } else {
        setText('');
        setMobileOpen(false);
        inputRef.current?.blur();
      }
    }
  };

  const activeKey = items[active]?.key;
  const optionId = (key: string) => `${listId}-${key}`;
  const shortcut = isMac ? '⌘K' : 'Ctrl K';

  return (
    <div
      ref={rootRef}
      className={
        mobileOpen
          ? 'absolute inset-0 z-10 flex items-center gap-2 rounded-[12px] bg-[var(--admin-surface)] px-3 sm:static sm:z-auto sm:inset-auto sm:flex sm:w-56 sm:shrink-0 sm:bg-transparent sm:p-0 lg:w-72'
          : 'flex shrink-0 items-center sm:relative sm:w-56 lg:w-72'
      }
    >
      {/* Phones: a search icon until opened. */}
      {!mobileOpen && (
        <button
          type="button"
          aria-label="Search"
          onClick={() => {
            setMobileOpen(true);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          className="flex size-8 items-center justify-center rounded-[var(--admin-radius-sm)] text-[var(--admin-text-muted)] transition-[background-color,color,transform] duration-150 hover:bg-[var(--admin-surface-hover)] hover:text-[var(--admin-text)] active:scale-95 sm:hidden"
        >
          <Search className="size-4" aria-hidden />
        </button>
      )}

      <div className={mobileOpen ? 'relative flex min-w-0 flex-1 items-center sm:flex sm:w-full' : 'relative hidden w-full sm:flex sm:items-center'}>
        <Search className="pointer-events-none absolute left-2.5 size-4 text-[var(--admin-text-subtle)]" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && activeKey ? optionId(activeKey) : undefined}
          aria-label="Search orders, products and customers"
          placeholder="Search orders, products, customers"
          value={text}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="h-8 w-full min-w-0 rounded-[var(--admin-radius-sm)] border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] pl-8 pr-10 text-sm text-[var(--admin-text)] outline-none transition-[border-color,background-color] duration-150 placeholder:text-[var(--admin-text-subtle)] focus:border-[var(--admin-focus)] focus:bg-[var(--admin-surface)] [&::-webkit-search-cancel-button]:hidden"
        />
        {text ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setText('');
              inputRef.current?.focus();
            }}
            className="absolute right-1.5 flex size-6 items-center justify-center rounded text-[var(--admin-text-subtle)] transition-colors duration-150 hover:text-[var(--admin-text)]"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-2 hidden rounded border border-[var(--admin-border)] px-1.5 py-px font-sans text-[11px] text-[var(--admin-text-subtle)] lg:block">
            {shortcut}
          </kbd>
        )}
      </div>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close search"
          onClick={() => {
            setText('');
            setOpen(false);
            setMobileOpen(false);
          }}
          className="flex size-8 shrink-0 items-center justify-center rounded-[var(--admin-radius-sm)] text-[var(--admin-text-muted)] transition-colors duration-150 hover:bg-[var(--admin-surface-hover)] sm:hidden"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}

      {showPanel && (
        <div
          id={listId}
          role="listbox"
          aria-label="Search results"
          className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[min(70vh,28rem)] overflow-y-auto rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1 shadow-[var(--admin-shadow-popover)] sm:left-auto sm:right-0 sm:w-[22rem]"
        >
          {loading && (
            <div className="flex items-center gap-2 px-2.5 py-3 text-sm text-[var(--admin-text-muted)]">
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
              Searching
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="px-2.5 py-3 text-sm">
              <p className="font-medium text-[var(--admin-text)]">No matches for "{text.trim()}"</p>
              <p className="mt-0.5 text-[var(--admin-text-muted)]">Try a five-digit order number, a product name or a customer phone.</p>
            </div>
          )}
          {!loading &&
            groups.map((group) => (
              <div key={group.title} role="group" aria-label={group.title} className="py-1">
                <p className="px-2.5 pb-1 pt-1.5 text-xs font-medium text-[var(--admin-text-muted)]">{group.title}</p>
                {group.items.map((item) => {
                  const index = items.indexOf(item);
                  const selected = index === active;
                  return (
                    <div
                      key={item.key}
                      id={optionId(item.key)}
                      role="option"
                      aria-selected={selected}
                      onMouseEnter={() => setActive(index)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(item)}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-[var(--admin-radius-sm)] px-2.5 py-2 text-sm transition-colors duration-150 ${
                        selected ? 'bg-[var(--admin-surface-hover)]' : ''
                      }`}
                    >
                      <span className="min-w-0 truncate font-medium text-[var(--admin-text)]">{item.label}</span>
                      {item.sublabel && (
                        <span className="shrink-0 truncate text-xs text-[var(--admin-text-muted)]">{item.sublabel}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
