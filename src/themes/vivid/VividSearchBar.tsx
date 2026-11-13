import { useEffect, useRef, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Search row under the header. Submitting goes to the product listing with the query. */
export function VividSearchBar({ open, onClose }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get('q')?.toString().trim();
    if (!q) return;
    onClose();
    navigate(`/products?search=${encodeURIComponent(q)}`);
  };

  return (
    <div
      id="vv-search-bar"
      hidden={!open}
      className="border-b border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--vv-shadow-sm)]"
    >
      <form onSubmit={onSubmit} className="max-w-[1280px] mx-auto px-2 sm:px-4 py-2 flex items-center gap-1">
        <label className="relative flex-1 min-w-0">
          <span className="sr-only">Search products</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)]" />
          <input
            ref={inputRef}
            name="q"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Search for products"
            className="w-full h-11 bg-[var(--color-surface-2)] border border-transparent rounded-[var(--vv-radius-md)] pl-10 pr-3 text-base sm:text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] focus:outline-none focus:bg-[var(--color-surface)] focus:border-[var(--color-primary)]"
          />
        </label>
        <button type="submit" className="vv-btn-primary px-4" aria-label="Search">
          <span className="hidden sm:inline">Search</span>
          <Search className="w-4 h-4 sm:hidden" />
        </button>
        <button type="button" onClick={onClose} className="vv-icon-btn" aria-label="Close search">
          <X className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
