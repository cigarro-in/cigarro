import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useConvex, type ConvexReactClient } from 'convex/react';
import { listR2Images, type R2Image } from '../../../../lib/images/upload';
import { fetchUsageBatch, type AssetUsage } from '../../../../lib/images/usage';
import { ORG_SLUG } from '../../../../lib/convex/org';
import { toActionError, type ActionError } from '../../../ui';

// One shared copy of the store's image library for every picker and the
// Images page. Opening a picker shows the last copy at once (no flicker) and
// refreshes it in the background when it is older than STALE_MS.

const STALE_MS = 30_000;

export interface LibrarySnapshot {
  /** Newest first. undefined until the first list arrives. */
  images: R2Image[] | undefined;
  /** "Where used" per R2 key. Missing key = not checked yet; total -1 = check failed. */
  usage: Map<string, AssetUsage>;
  usageReady: boolean;
  error: ActionError | null;
}

interface Store extends LibrarySnapshot {
  fetchedAt: number;
  listing: Promise<void> | null;
  usageLoading: Promise<void> | null;
}

const stores = new Map<string, Store>();
const listeners = new Set<() => void>();

function store(): Store {
  let s = stores.get(ORG_SLUG);
  if (!s) {
    s = { images: undefined, usage: new Map(), usageReady: false, error: null, fetchedAt: 0, listing: null, usageLoading: null };
    stores.set(ORG_SLUG, s);
  }
  return s;
}

// Snapshots are replaced (never mutated) so useSyncExternalStore sees changes.
let snapshot: LibrarySnapshot = { images: undefined, usage: new Map(), usageReady: false, error: null };
function publish(patch: Partial<Store>) {
  Object.assign(store(), patch);
  const s = store();
  snapshot = { images: s.images, usage: s.usage, usageReady: s.usageReady, error: s.error };
  listeners.forEach((l) => l());
}

function byNewest(a: R2Image, b: R2Image) {
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
}

async function loadUsage(convex: ConvexReactClient, images: R2Image[]) {
  const s = store();
  if (s.usageLoading) return s.usageLoading;
  const run = (async () => {
    try {
      const usage = await fetchUsageBatch(convex, images.map((i) => ({ key: i.path, url: i.url })));
      publish({ usage, usageReady: true });
    } finally {
      store().usageLoading = null;
    }
  })();
  s.usageLoading = run;
  return run;
}

async function loadLibrary(convex: ConvexReactClient, withUsage: boolean) {
  const s = store();
  if (s.listing) return s.listing;
  const run = (async () => {
    try {
      const all: R2Image[] = [];
      let cursor: string | undefined;
      do {
        const page = await listR2Images('images', cursor);
        all.push(...page.images);
        cursor = page.cursor;
      } while (cursor);
      const images = [...new Map(all.map((i) => [i.path, i])).values()].sort(byNewest);
      publish({ images, error: null, fetchedAt: Date.now() });
      if (withUsage) await loadUsage(convex, images);
    } catch (err) {
      publish({ images: store().images ?? [], error: toActionError(err, 'Could not load your images. Try again.') });
    } finally {
      store().listing = null;
    }
  })();
  s.listing = run;
  return run;
}

/** Add a freshly uploaded image to the shared library (unused until saved). */
export function addToLibrary(image: R2Image) {
  const s = store();
  const images = [image, ...(s.images ?? []).filter((i) => i.path !== image.path)];
  const usage = new Map(s.usage);
  usage.set(image.path, { key: image.path, total: 0, mutableTotal: 0, historicalTotal: 0, contexts: [] });
  publish({ images, usage });
}

export function removeFromLibrary(paths: string[]) {
  const s = store();
  const gone = new Set(paths);
  publish({ images: (s.images ?? []).filter((i) => !gone.has(i.path)) });
}

export function setLibraryUsage(entries: Map<string, AssetUsage>) {
  publish({ usage: new Map([...store().usage, ...entries]) });
}

/** The image a picker or upload returned, as a library row. */
export function libraryImageFromUpload(r: { url: string; key: string; size: number }): R2Image {
  const name = r.key.split('/').pop() || r.key;
  return { id: r.key, name, path: r.key, url: r.url, size: r.size, contentType: 'image/webp', createdAt: new Date().toISOString() };
}

/**
 * The store's image library, newest first, with "where used" for each image.
 * Shared across pickers and the Images page; refreshes in the background.
 */
export function useImageLibrary({ enabled = true, withUsage = true }: { enabled?: boolean; withUsage?: boolean } = {}) {
  const convex = useConvex();
  const snap = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
  );

  useEffect(() => {
    if (!enabled) return;
    const s = store();
    // Another store's copy may be in the snapshot after a store switch.
    if (snapshot.images !== s.images) publish({});
    if (!s.images || Date.now() - s.fetchedAt > STALE_MS) void loadLibrary(convex, withUsage);
    else if (withUsage && !s.usageReady && s.images) void loadUsage(convex, s.images);
  }, [enabled, withUsage, convex]);

  const refresh = useCallback(async () => {
    store().fetchedAt = 0;
    await loadLibrary(convex, withUsage);
  }, [convex, withUsage]);

  /** Re-check usage for some images (before a delete). Fail-closed: total -1 on error. */
  const recheckUsage = useCallback(
    async (images: R2Image[]) => {
      const fresh = await fetchUsageBatch(convex, images.map((i) => ({ key: i.path, url: i.url })));
      setLibraryUsage(fresh);
      return fresh;
    },
    [convex],
  );

  return { ...snap, refresh, recheckUsage };
}
