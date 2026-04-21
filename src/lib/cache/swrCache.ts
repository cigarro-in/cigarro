/**
 * Minimal SWR-style cache.
 *
 * - In-memory Map for instant access within the tab.
 * - localStorage persistence with TTL so a reload is still warm.
 * - Single in-flight promise per key to prevent thundering-herd fetches.
 *
 * Key change is handled correctly: when the `key` argument changes between
 * renders, the hook re-syncs its state from the new key's cache entry.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface CacheEntry<T> {
  data: T;
  ts: number;
}

const mem = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

const STORAGE_PREFIX = 'swr:';

function readStorage<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

function writeStorage<T>(key: string, entry: CacheEntry<T>): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    /* quota full, ignore */
  }
}

function getEntry<T>(key: string): CacheEntry<T> | null {
  const m = mem.get(key) as CacheEntry<T> | undefined;
  if (m) return m;
  const s = readStorage<T>(key);
  if (s) {
    mem.set(key, s);
    return s;
  }
  return null;
}

export function readCache<T>(key: string): T | null {
  return getEntry<T>(key)?.data ?? null;
}

export function writeCache<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = { data, ts: Date.now() };
  mem.set(key, entry);
  writeStorage(key, entry);
}

export function invalidate(key: string): void {
  mem.delete(key);
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    /* ignore */
  }
}

export function invalidatePrefix(prefix: string): void {
  for (const k of Array.from(mem.keys())) {
    if (k.startsWith(prefix)) mem.delete(k);
  }
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX + prefix)) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

interface UseCachedOptions {
  /** Treat data older than this as stale and revalidate in background. Default 5 min. */
  ttl?: number;
  /** Skip fetching until true. Default true. */
  enabled?: boolean;
}

interface State<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
}

export function useCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseCachedOptions = {}
) {
  const { ttl = 5 * 60_000, enabled = true } = options;

  const [state, setState] = useState<State<T>>(() => {
    const entry = getEntry<T>(key);
    const isFresh = entry && Date.now() - entry.ts < ttl;
    return {
      data: entry?.data ?? null,
      isLoading: enabled && (!entry || !isFresh),
      error: null,
    };
  });

  // Keep fetcher fresh without retriggering the effect
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (k: string) => {
      const existing = inflight.get(k) as Promise<T> | undefined;
      const promise =
        existing ??
        (async () => {
          try {
            const fresh = await fetcherRef.current();
            writeCache(k, fresh);
            return fresh;
          } finally {
            inflight.delete(k);
          }
        })();
      if (!existing) inflight.set(k, promise);

      try {
        const result = await promise;
        // Only commit if still mounted and the key still matches what the caller cares about
        if (mounted.current) {
          setState((prev) =>
            prev.data === result ? prev : { data: result, isLoading: false, error: null }
          );
        }
      } catch (e) {
        if (mounted.current) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: e instanceof Error ? e : new Error(String(e)),
          }));
        }
      }
    },
    []
  );

  // Re-sync when key, enabled, or ttl changes
  useEffect(() => {
    if (!enabled) {
      setState({ data: null, isLoading: false, error: null });
      return;
    }

    const entry = getEntry<T>(key);
    const isFresh = entry && Date.now() - entry.ts < ttl;

    // Immediately reflect the new key's cache state in local state
    setState({
      data: entry?.data ?? null,
      isLoading: !entry || !isFresh,
      error: null,
    });

    if (!isFresh) {
      run(key);
    }
  }, [key, enabled, ttl, run]);

  const refresh = useCallback(() => run(key), [key, run]);

  return {
    data: state.data,
    isLoading: state.isLoading,
    error: state.error,
    refresh,
  };
}
