import { ConvexError, v } from "convex/values";

export const DEFAULT_PAGE_SIZE = 15;
export const MAX_PAGE_SIZE = 200;

/** undefined/NaN/non-finite -> 15; floor; <1 -> 1; >200 -> 200. */
export function clampPageSize(n?: number | null): number {
  if (n === undefined || n === null || !Number.isFinite(n)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(n)));
}

/** Returns a copy of Convex PaginationOptions with numItems clamped by clampPageSize. */
export function clampPaginationOpts<T extends { numItems: number }>(opts: T): T {
  return { ...opts, numItems: clampPageSize(opts.numItems) };
}

/** Spread into query args: cursor + pageSize. */
export const pageArgs = {
  cursor: v.optional(v.union(v.string(), v.null())),
  pageSize: v.optional(v.number()),
};

export type ScanPage<D> = { page: D[]; continueCursor: string | null; isDone: boolean };

/**
 * Interleaves two descending streams by key (used for legacy rows that sit
 * beside a store's scoped rows). Equal keys are ordered by _id descending, so
 * the merged order is deterministic.
 */
export async function* mergeDesc<D extends { _id: string }>(
  a: AsyncIterable<D>,
  b: AsyncIterable<D>,
  keyOf: (d: D) => number,
): AsyncGenerator<D> {
  const ia = a[Symbol.asyncIterator]();
  const ib = b[Symbol.asyncIterator]();
  try {
    let ra = await ia.next();
    let rb = await ib.next();
    while (!ra.done || !rb.done) {
      if (
        !ra.done &&
        (rb.done ||
          keyOf(ra.value) > keyOf(rb.value) ||
          (keyOf(ra.value) === keyOf(rb.value) && ra.value._id >= rb.value._id))
      ) {
        yield ra.value;
        ra = await ia.next();
      } else if (!rb.done) {
        yield rb.value;
        rb = await ib.next();
      }
    }
  } finally {
    await ia.return?.();
    await ib.return?.();
  }
}

type ScanKey = { key: number; id: string };

function encodeCursor(k: ScanKey): string {
  return btoa(JSON.stringify({ k: k.key, id: k.id }));
}

function decodeCursor(cursor: string): ScanKey {
  const bad = () => new ConvexError({ code: "BAD_CURSOR" });
  let parsed: unknown;
  try {
    parsed = JSON.parse(atob(cursor));
  } catch {
    throw bad();
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as { k?: unknown }).k !== "number" ||
    !Number.isFinite((parsed as { k: number }).k) ||
    typeof (parsed as { id?: unknown }).id !== "string"
  ) {
    throw bad();
  }
  const p = parsed as { k: number; id: string };
  return { key: p.k, id: p.id };
}

/**
 * Cursor pagination for queries that cannot use Convex's .paginate(): Convex
 * allows only one .paginate() per query, and substring search cannot use
 * .filter() on an index. Instead, the caller supplies an ordered (descending by
 * key) scan and this helper walks it, keeping the docs that match.
 *
 * Pages may hold fewer than pageSize rows when maxScan stops a sparse filter
 * (isDone is false in that case, so keep calling with the returned cursor).
 *
 * `build(after)` must, when `after` is given, bound the query so that
 * key <= after.key (for example with `.lte` on the index).
 */
export async function scanPage<D extends { _id: string }>(opts: {
  cursor?: string | null;
  pageSize?: number | null;
  maxScan?: number;
  build: (after: { key: number; id: string } | null) => AsyncIterable<D>;
  keyOf: (d: D) => number;
  match?: (d: D) => boolean | Promise<boolean>;
}): Promise<ScanPage<D>> {
  const size = clampPageSize(opts.pageSize);
  const maxScan = Math.max(1, Math.floor(opts.maxScan ?? 1000));
  const after = opts.cursor ? decodeCursor(opts.cursor) : null;

  const page: D[] = [];
  let scanned = 0;
  let last: ScanKey | null = null;
  let skipping = after !== null;
  let isDone = false;
  let continueCursor: string | null = null;

  const it = opts.build(after)[Symbol.asyncIterator]();
  try {
    for (;;) {
      const r = await it.next();
      if (r.done) {
        isDone = true;
        continueCursor = null;
        break;
      }
      const d = r.value;
      const key = opts.keyOf(d);

      if (skipping && after) {
        // Docs at the resume key were scanned on the previous page. Skip them
        // through the doc with the cursor's _id; a smaller key ends the skip.
        if (key === after.key) {
          if (d._id === after.id) skipping = false;
          continue;
        }
        if (key > after.key) continue;
        skipping = false;
      }

      scanned++;
      last = { key, id: d._id };
      if (!opts.match || (await opts.match(d))) page.push(d);

      if (page.length === size) {
        const peek = await it.next();
        isDone = !!peek.done;
        continueCursor = encodeCursor(last);
        break;
      }
      if (scanned >= maxScan) {
        isDone = false;
        continueCursor = encodeCursor(last);
        break;
      }
    }
  } finally {
    await it.return?.();
  }

  return { page, continueCursor, isDone };
}
