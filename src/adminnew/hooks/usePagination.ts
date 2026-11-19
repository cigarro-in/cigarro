import { useCallback, useMemo, useState } from 'react';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../ui/DataTable';

const isOption = (n: number): boolean => (PAGE_SIZE_OPTIONS as readonly number[]).includes(n);

function readStoredPageSize(listKey: string): number {
  try {
    const raw = window.localStorage.getItem(`cigarro.admin.pageSize.${listKey}`);
    if (raw !== null) {
      const n = Number(raw);
      if (isOption(n)) return n;
    }
  } catch {
    // Storage blocked or unavailable: use the default.
  }
  return DEFAULT_PAGE_SIZE;
}

/**
 * Rows-per-page for a list, persisted per list in localStorage
 * (`cigarro.admin.pageSize.<listKey>`). Only PAGE_SIZE_OPTIONS are accepted.
 */
export function usePageSize(listKey: string): [number, (n: number) => void] {
  const [state, setState] = useState(() => ({ key: listKey, size: readStoredPageSize(listKey) }));
  if (state.key !== listKey) {
    // Key changed: re-read the stored value during render (no stale flash).
    setState({ key: listKey, size: readStoredPageSize(listKey) });
  }
  const size = state.key === listKey ? state.size : readStoredPageSize(listKey);

  const setPageSize = useCallback(
    (n: number) => {
      if (!isOption(n)) return;
      setState({ key: listKey, size: n });
      try {
        window.localStorage.setItem(`cigarro.admin.pageSize.${listKey}`, String(n));
      } catch {
        // Ignore: the in-memory value still applies for this session.
      }
    },
    [listKey],
  );

  return [size, setPageSize];
}

/**
 * Cursor paging for server lists. The stack holds one cursor per page; the
 * first entry is null (page 1). Resets to page 1 whenever resetKey changes
 * (pass JSON of filters + pageSize).
 */
export function useCursorPages(resetKey: string): {
  cursor: string | null;
  page: number;
  next: (continueCursor: string) => void;
  prev: () => void;
  reset: () => void;
} {
  const [state, setState] = useState<{ key: string; stack: (string | null)[] }>(() => ({
    key: resetKey,
    stack: [null],
  }));
  if (state.key !== resetKey) {
    setState({ key: resetKey, stack: [null] });
  }
  const stack = state.key === resetKey ? state.stack : [null];

  const next = useCallback(
    (continueCursor: string) => {
      setState((prev) => ({
        key: resetKey,
        stack: [...(prev.key === resetKey ? prev.stack : [null]), continueCursor],
      }));
    },
    [resetKey],
  );

  const prev = useCallback(() => {
    setState((p) => {
      const base = p.key === resetKey ? p.stack : [null];
      return { key: resetKey, stack: base.length > 1 ? base.slice(0, -1) : base };
    });
  }, [resetKey]);

  const reset = useCallback(() => setState({ key: resetKey, stack: [null] }), [resetKey]);

  return {
    cursor: stack[stack.length - 1] ?? null,
    page: stack.length,
    next,
    prev,
    reset,
  };
}

/**
 * Client-side paging for small lists. Page size is persisted via usePageSize.
 * The page resets to 1 when resetKey or the page size changes. pageItems is
 * undefined while items is loading, so DataTable can show its skeleton.
 */
export function useClientPages<T>(
  items: T[] | undefined,
  listKey: string,
  resetKey: string,
): {
  pageItems: T[] | undefined;
  page: number;
  pageCount: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (n: number) => void;
  total: number;
  summary: string;
} {
  const [pageSize, setPageSize] = usePageSize(listKey);
  const scopeKey = JSON.stringify([resetKey, pageSize]);
  const [state, setState] = useState<{ key: string; page: number }>(() => ({ key: scopeKey, page: 1 }));
  if (state.key !== scopeKey) {
    setState({ key: scopeKey, page: 1 });
  }
  const requestedPage = state.key === scopeKey ? state.page : 1;

  const total = items?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, requestedPage), pageCount);

  const pageItems = useMemo(
    () => (items ? items.slice((page - 1) * pageSize, page * pageSize) : undefined),
    [items, page, pageSize],
  );

  const setPage = useCallback(
    (p: number) => setState({ key: scopeKey, page: p }),
    [scopeKey],
  );

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const summary = total === 0 ? '0 of 0' : `${start}–${end} of ${total}`;

  return { pageItems, page, pageCount, pageSize, setPage, setPageSize, total, summary };
}
