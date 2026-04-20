/**
 * Minimal SWR-style cache.
 *
 * - In-memory Map for instant access within the tab.
 * - localStorage persistence with TTL so a reload is still warm.
 * - Single in-flight promise per key to prevent thundering-herd fetches.
 *
 * Usage:
 *   const { data, isLoading, refresh } = useCached(
 *     'homepage:v1',
 *     fetchHomepageData,
 *     { ttl: 5 * 60_000 }
 *   );
 */

import { useEffect, useRef, useState } from 'react';

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

export function readCache<T>(key: string): T | null {
  const m = mem.get(key) as CacheEntry<T> | undefined;
  if (m) return m.data;
  const s = readStorage<T>(key);
  if (s) {
    mem.set(key, s);
    return s.data;
  }
  return null;
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

export function useCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseCachedOptions = {}
) {
  const { ttl = 5 * 60_000, enabled = true } = options;
  const cached = readCache<T>(key);
  const [data, setData] = useState<T | null>(cached);
  const [isLoading, setIsLoading] = useState<boolean>(cached === null && enabled);
  const [error, setError] = useState<Error | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = async () => {
    if (!enabled) return;
    setError(null);
    const existing = inflight.get(key) as Promise<T> | undefined;
    const promise =
      existing ??
      (async () => {
        try {
          const fresh = await fetcher();
          writeCache(key, fresh);
          return fresh;
        } finally {
          inflight.delete(key);
        }
      })();
    if (!existing) inflight.set(key, promise);

    try {
      const result = await promise;
      if (mounted.current) {
        setData(result);
        setIsLoading(false);
      }
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof Error ? e : new Error(String(e)));
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!enabled) return;
    const entry = mem.get(key) ?? readStorage<T>(key);
    const isFresh = entry && Date.now() - entry.ts < ttl;
    if (!isFresh) {
      run();
    } else {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return {
    data,
    isLoading,
    error,
    refresh: run,
  };
}
