// One-time data migrations. Each migration is recorded in the `migrations`
// table; a migration marked "done" is never run again. A failing migration is
// retried on later runs, up to MAX_RUNS attempts.
//
// Runs only when explicitly triggered, never on a cron:
//   - dev:   npx convex run migrations:runPending
//   - prod:  super-admin "Run pending migrations" button on the Platform Config
//            page (platform:runPendingMigrations, requires a write window).
// Inspect progress via platform:listMigrations.

import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
  type MutationCtx,
} from "./_generated/server";
import { LEGACY_ORG_SLUG, RENAME_MIGRATION, renameDone } from "./lib/legacyOrg";
import { OLDSMOKESHOP_MOVED_IMAGE_KEYS } from "./lib/oldsmokeshopMovedImages";
import { STORAGE_KEY_MAP } from "./lib/storageKeyMap";
import { rewriteStorageDeep } from "./lib/storageKeys";
import { genOrderNumberCandidate, isValidOrderNumber } from "./lib/ids";
import { cleanDescription } from "./lib/cleanDescription";

const MAX_RUNS = 5;
const MAX_RESULT_CHARS = 2048;

// Modules absent from the generated api.d.ts until codegen runs; referenced by path.
const renameLegacyOrgRef = makeFunctionReference<
  "mutation",
  Record<string, never>,
  unknown
>("organizations:renameLegacyOrgSlug");
const listRowsRef = makeFunctionReference<
  "query",
  Record<string, never>,
  MigrationRow[]
>("migrations:listRows");
const importSmokeshopRedirectsRef = makeFunctionReference<
  "mutation",
  Record<string, never>,
  unknown
>("redirects:importSmokeshopRedirects");

const backfillPlatformFeesRef = makeFunctionReference<
  "mutation",
  Record<string, never>,
  unknown
>("platformFees:backfillPlatformFees");

const writeRowRef = makeFunctionReference<
  "mutation",
  { name: string; status: "done" | "failed"; result?: string; updatedAt: number },
  null
>("migrations:writeRow");

export interface MigrationRow {
  name: string;
  status: "done" | "failed";
  result?: string;
  runs: number;
  updatedAt: number;
}

export const listRows = internalQuery({
  args: {},
  handler: async (ctx): Promise<MigrationRow[]> => {
    const rows = await ctx.db.query("migrations").collect();
    return rows.map((r) => ({
      name: r.name,
      status: r.status,
      result: r.result,
      runs: r.runs,
      updatedAt: r.updatedAt,
    }));
  },
});

// Upsert one row. `runs` is incremented here, once per attempt.
export const writeRow = internalMutation({
  args: {
    name: v.string(),
    status: v.union(v.literal("done"), v.literal("failed")),
    result: v.optional(v.string()),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("migrations")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();
    const doc = {
      name: args.name,
      status: args.status,
      result: args.result,
      runs: (existing?.runs ?? 0) + 1,
      updatedAt: args.updatedAt,
    };
    if (existing) await ctx.db.replace(existing._id, doc);
    else await ctx.db.insert("migrations", doc);
    return null;
  },
});

// JSON string capped at MAX_RESULT_CHARS. If too large, stores a valid JSON
// wrapper with a preview instead of cutting the JSON mid-token.
function capJson(value: unknown): string {
  let json: string;
  try {
    json = JSON.stringify(value ?? null) ?? "null";
  } catch {
    json = JSON.stringify(String(value));
  }
  if (json.length <= MAX_RESULT_CHARS) return json;
  let len = MAX_RESULT_CHARS;
  for (;;) {
    const out = JSON.stringify({
      truncated: true,
      originalChars: json.length,
      preview: json.slice(0, len),
    });
    if (out.length <= MAX_RESULT_CHARS || len === 0) return out;
    len = Math.floor(len / 2);
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface Migration {
  name: string;
  run: (ctx: ActionCtx) => Promise<unknown>;
}

// One-off: give every order that predates the five-digit orderNumber a unique
// (per org) number. Orders created since then already have one (allocated in
// createOrder). Skips rows that already carry a valid number, so re-running is
// a no-op. Single transaction per run; fine at current store sizes.
export const backfillOrderNumbers = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ orgs: number; assigned: number }> => {
    const orgs = await ctx.db.query("organizations").collect();
    let assigned = 0;
    for (const org of orgs) {
      const orders = await ctx.db
        .query("orders")
        .withIndex("by_org_user", (q) => q.eq("orgId", org._id))
        .collect();
      const used = new Set<number>();
      for (const o of orders) {
        if (isValidOrderNumber(o.orderNumber)) used.add(o.orderNumber);
      }
      for (const o of orders) {
        if (isValidOrderNumber(o.orderNumber)) continue;
        let candidate = genOrderNumberCandidate();
        let tries = 0;
        while (used.has(candidate)) {
          if (++tries > 1000) {
            throw new Error(`ORDER_NUMBER_EXHAUSTED for org ${org._id}`);
          }
          candidate = genOrderNumberCandidate();
        }
        used.add(candidate);
        await ctx.db.patch(o._id, { orderNumber: candidate });
        assigned++;
      }
    }
    return { orgs: orgs.length, assigned };
  },
});

const backfillOrderNumbersRef = makeFunctionReference<
  "mutation",
  Record<string, never>,
  unknown
>("migrations:backfillOrderNumbers");

export const BACKFILL_ORDER_NUMBERS_MIGRATION = "backfillOrderNumbers-v1";

// Only migrations that may still be needed. Finished one-offs are removed from
// this list together with their functions. Add new entries here and delete the
// function once it has run.
const MIGRATIONS: Migration[] = [
  {
    name: RENAME_MIGRATION,
    run: async (ctx) => await ctx.runMutation(renameLegacyOrgRef, {}),
  },
  {
    name: BACKFILL_ORDER_NUMBERS_MIGRATION,
    run: async (ctx) => await ctx.runMutation(backfillOrderNumbersRef, {}),
  },
  {
    // Literal name: the exported const below is declared after this array.
    name: "cleanSmokeshopDescriptions-v1",
    run: async (ctx) => await runCleanSmokeshopDescriptions(ctx),
  },
  {
    // Dukaan redirects (imports/the2935/redirects.csv) for smokeshop. Idempotent.
    name: "smokeshopRedirects-v1",
    run: async (ctx) => await ctx.runMutation(importSmokeshopRedirectsRef, {}),
  },
  {
    // Platform fees: existing stores get fee 800 bps + setupGate "waived";
    // default deposit in appConfig; creates the internal platform org. Idempotent.
    name: "platformFees-v1",
    run: async (ctx) => await ctx.runMutation(backfillPlatformFeesRef, {}),
  },
  {
    // Old store images copied out of orgs/smokeshop/. v2 also covers subfolders (blogs/).
    name: "moveOldsmokeshopImages-v2",
    run: async (ctx) => await runMoveOldsmokeshopImages(ctx),
  },
  {
    // Pre-restructure image keys → <store>/images/ (copies made by scripts/r2-restructure/copy.ts).
    // Literal name: the exported const below is declared after this array.
    name: "restructureStorageKeys-v1",
    run: async (ctx) => await runRestructureStorageKeys(ctx),
  },
];

// Never throws: each migration is isolated, and failures are recorded.
export const runPending = internalAction({
  args: {},
  handler: async (ctx): Promise<Record<string, string>> => {
    const summary: Record<string, string> = {};
    let rows: MigrationRow[];
    try {
      rows = await ctx.runQuery(listRowsRef, {});
    } catch (err) {
      console.error("[migrations] could not read migrations table", err);
      return { _error: errorMessage(err) };
    }
    const byName = new Map(rows.map((r) => [r.name, r]));

    for (const m of MIGRATIONS) {
      const row = byName.get(m.name);
      if (row?.status === "done") {
        summary[m.name] = "skipped:done";
        continue;
      }
      if (row && row.status === "failed" && row.runs >= MAX_RUNS) {
        summary[m.name] = "skipped:gave-up";
        continue;
      }
      try {
        const result = await m.run(ctx);
        await ctx.runMutation(writeRowRef, {
          name: m.name,
          status: "done",
          result: capJson(result),
          updatedAt: Date.now(),
        });
        summary[m.name] = "done";
      } catch (err) {
        console.error(`[migrations] ${m.name} failed`, err);
        summary[m.name] = "failed";
        try {
          await ctx.runMutation(writeRowRef, {
            name: m.name,
            status: "failed",
            result: capJson({ error: errorMessage(err) }),
            updatedAt: Date.now(),
          });
        } catch (writeErr) {
          console.error(`[migrations] could not record failure for ${m.name}`, writeErr);
        }
      }
    }
    return summary;
  },
});

// ---------------------------------------------------------------------------
// cleanSmokeshopDescriptions-v1: runs cleanDescription over the description of
// the org with slug `smokeshop` (the Dukaan-imported store) only: catalog
// products and categories. Catalog variants have no description column.
// Idempotent: a row is patched only when its cleaned text differs. Batched by
// cursor; the action loops until both tables are done and returns the counts.
// ---------------------------------------------------------------------------

export const CLEAN_SMOKESHOP_DESCRIPTIONS_MIGRATION = "cleanSmokeshopDescriptions-v1";
const SMOKESHOP_SLUG = "smokeshop";
const CLEAN_BATCH_SIZE = 100;

export interface CleanBatchResult {
  scanned: number;
  changed: number;
  continueCursor: string;
  isDone: boolean;
}

const cleanSmokeshopBatchRef = makeFunctionReference<
  "mutation",
  { table: "catalogProducts" | "catalogCategories"; cursor: string | null },
  CleanBatchResult
>("migrations:cleanSmokeshopDescriptionsBatch");

export const cleanSmokeshopDescriptionsBatch = internalMutation({
  args: {
    table: v.union(v.literal("catalogProducts"), v.literal("catalogCategories")),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx: MutationCtx, { table, cursor }): Promise<CleanBatchResult> => {
    // Until the rename runs, slug `smokeshop` still names the legacy store.
    if (!(await renameDone(ctx))) {
      throw new Error("renameSmokeshopToOldsmokeshop-v1 has not run; refusing to touch slug smokeshop");
    }
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", SMOKESHOP_SLUG))
      .first();
    if (!org) throw new Error(`no organization with slug ${SMOKESHOP_SLUG}`);

    const now = { cursor, numItems: CLEAN_BATCH_SIZE };
    let scanned = 0;
    let changed = 0;
    let continueCursor = "";
    let isDone = false;

    if (table === "catalogProducts") {
      const page = await ctx.db
        .query("catalogProducts")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .paginate(now);
      for (const row of page.page) {
        scanned++;
        if (!row.description) continue;
        const after = cleanDescription(row.description, { imgAlt: row.name });
        if (after === row.description) continue;
        await ctx.db.patch(row._id, { description: after });
        changed++;
      }
      continueCursor = page.continueCursor;
      isDone = page.isDone;
    } else {
      const page = await ctx.db
        .query("catalogCategories")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .paginate(now);
      for (const row of page.page) {
        scanned++;
        if (!row.description) continue;
        const after = cleanDescription(row.description, { imgAlt: row.name });
        if (after === row.description) continue;
        await ctx.db.patch(row._id, { description: after });
        changed++;
      }
      continueCursor = page.continueCursor;
      isDone = page.isDone;
    }
    return { scanned, changed, continueCursor, isDone };
  },
});

async function runCleanSmokeshopDescriptions(ctx: ActionCtx): Promise<unknown> {
  const totals: Record<string, { scanned: number; changed: number }> = {
    catalogProducts: { scanned: 0, changed: 0 },
    catalogCategories: { scanned: 0, changed: 0 },
  };
  for (const table of ["catalogProducts", "catalogCategories"] as const) {
    let cursor: string | null = null;
    let isDone = false;
    while (!isDone) {
      const r: CleanBatchResult = await ctx.runMutation(cleanSmokeshopBatchRef, { table, cursor });
      totals[table].scanned += r.scanned;
      totals[table].changed += r.changed;
      cursor = r.continueCursor;
      isDone = r.isDone;
    }
  }
  return totals;
}

// ---------------------------------------------------------------------------
// moveOldsmokeshopImages (v2 adds subfolders such as blogs/): before the slug rename, the original store
// uploaded into asset_images/orgs/smokeshop/, which now belongs to the new
// `smokeshop` store. Those files were copied (not moved) to
// asset_images/orgs/oldsmokeshop/ by hand. This rewrites the old store's rows
// to the copies, only for keys in OLDSMOKESHOP_MOVED_IMAGE_KEYS, so a URL is
// never pointed at a file that was not copied. Old copies are deleted later,
// by hand, once this has run on PROD. Idempotent.
// ---------------------------------------------------------------------------

export const MOVE_OLDSMOKESHOP_IMAGES_MIGRATION = "moveOldsmokeshopImages-v2";
const OLD_IMG_PREFIX = "asset_images/orgs/smokeshop/";
const NEW_IMG_PREFIX = "asset_images/orgs/oldsmokeshop/";
const MOVED_IMAGE_SET = new Set(OLDSMOKESHOP_MOVED_IMAGE_KEYS);
const IMG_KEY_RE = /asset_images\/orgs\/smokeshop\/([A-Za-z0-9._/-]+)/g;

const IMAGE_TABLES = [
  "catalogBrands",
  "catalogCategories",
  "catalogProducts",
  "catalogVariants",
  "catalogCollections",
  "catalogCombos",
  "heroSlides",
  "blogPosts",
  "blogCategories",
  "siteSettings",
  "storePages",
  "sectionConfigurations",
  "homepageComponentConfig",
] as const;
type ImageTable = (typeof IMAGE_TABLES)[number] | "orders";

function rewriteImageKeys(value: unknown): { value: unknown; changed: boolean } {
  if (typeof value === "string") {
    if (!value.includes(OLD_IMG_PREFIX)) return { value, changed: false };
    const next = value.replace(IMG_KEY_RE, (whole, name: string) =>
      MOVED_IMAGE_SET.has(name) ? `${NEW_IMG_PREFIX}${name}` : whole,
    );
    return { value: next, changed: next !== value };
  }
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((v) => {
      const r = rewriteImageKeys(v);
      changed ||= r.changed;
      return r.value;
    });
    return { value: changed ? out : value, changed };
  }
  if (value && typeof value === "object" && !(value instanceof ArrayBuffer)) {
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const r = rewriteImageKeys(v);
      changed ||= r.changed;
      out[k] = r.value;
    }
    return { value: changed ? out : value, changed };
  }
  return { value, changed: false };
}

export const moveOldsmokeshopImagesBatch = internalMutation({
  args: { table: v.string(), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { table, cursor }): Promise<CleanBatchResult> => {
    if (!(await renameDone(ctx))) throw new Error("rename has not run");
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", LEGACY_ORG_SLUG))
      .first();
    if (!org) throw new Error(`no organization with slug ${LEGACY_ORG_SLUG}`);

    let changed = 0;
    if (table === "organizations") {
      const { _id, _creationTime, ...fields } = org;
      const r = rewriteImageKeys(fields);
      if (r.changed) {
        await ctx.db.replace(_id, r.value as typeof fields);
        changed++;
      }
      return { scanned: 1, changed, continueCursor: "", isDone: true };
    }

    const t = table as ImageTable;
    const index = t === "orders" ? "by_org_created" : "by_org";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = await (ctx.db.query(t) as any)
      .withIndex(index, (q: any) => q.eq("orgId", org._id))
      .paginate({ cursor, numItems: CLEAN_BATCH_SIZE });
    for (const row of page.page) {
      const { _id, _creationTime, ...fields } = row;
      const r = rewriteImageKeys(fields);
      if (!r.changed) continue;
      await ctx.db.replace(_id, r.value as typeof fields);
      changed++;
    }
    return {
      scanned: page.page.length,
      changed,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

const moveOldsmokeshopImagesBatchRef = makeFunctionReference<
  "mutation",
  { table: string; cursor: string | null },
  CleanBatchResult
>("migrations:moveOldsmokeshopImagesBatch");

async function runMoveOldsmokeshopImages(ctx: ActionCtx) {
  const totals: Record<string, { scanned: number; changed: number }> = {};
  for (const table of ["organizations", "orders", ...IMAGE_TABLES]) {
    totals[table] = { scanned: 0, changed: 0 };
    let cursor: string | null = null;
    let isDone = false;
    while (!isDone) {
      const r: CleanBatchResult = await ctx.runMutation(moveOldsmokeshopImagesBatchRef, { table, cursor });
      totals[table].scanned += r.scanned;
      totals[table].changed += r.changed;
      cursor = r.continueCursor;
      isDone = r.isDone;
    }
  }
  return totals;
}

// ---------------------------------------------------------------------------
// restructureStorageKeys-v1: stored image references move from the pre-restructure
// keys (asset_images/orgs/<slug>/<folder>/…, asset_images/…) to the new layout
// (<slug>/images/…). The objects are copied first by scripts/r2-restructure/copy.ts,
// which writes convex/lib/storageKeyMap.ts. Old objects stay in R2, so old URLs
// (cached copies, Google's index, order history) keep working. Orders are not
// rewritten. Idempotent: once a reference is rewritten it no longer matches a key.
// ---------------------------------------------------------------------------

export const RESTRUCTURE_STORAGE_KEYS_MIGRATION = "restructureStorageKeys-v1";
// Every table that stores image references (orders excluded on purpose).
const RESTRUCTURE_TABLES = [...IMAGE_TABLES, "organizations", "carts"] as const;
const RESTRUCTURE_BATCH_SIZE = 100;

export const restructureStorageKeysBatch = internalMutation({
  args: { table: v.string(), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { table, cursor }): Promise<CleanBatchResult> => {
    if (Object.keys(STORAGE_KEY_MAP).length === 0) {
      throw new Error("storageKeyMap is empty: run scripts/r2-restructure/copy.ts first");
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = await (ctx.db.query(table as any) as any).paginate({ cursor, numItems: RESTRUCTURE_BATCH_SIZE });
    let changed = 0;
    for (const row of page.page as Record<string, unknown>[]) {
      const patch: Record<string, unknown> = {};
      for (const [field, value] of Object.entries(row)) {
        if (field === "_id" || field === "_creationTime") continue;
        const r = rewriteStorageDeep(value, STORAGE_KEY_MAP);
        if (r.changed) patch[field] = r.value;
      }
      if (Object.keys(patch).length === 0) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.db.patch(row._id as any, patch);
      changed++;
    }
    return {
      scanned: page.page.length,
      changed,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

const restructureStorageKeysBatchRef = makeFunctionReference<
  "mutation",
  { table: string; cursor: string | null },
  CleanBatchResult
>("migrations:restructureStorageKeysBatch");

async function runRestructureStorageKeys(ctx: ActionCtx): Promise<unknown> {
  if (Object.keys(STORAGE_KEY_MAP).length === 0) {
    throw new Error("storageKeyMap is empty: run scripts/r2-restructure/copy.ts first");
  }
  const totals: Record<string, { scanned: number; changed: number }> = {};
  for (const table of RESTRUCTURE_TABLES) {
    totals[table] = { scanned: 0, changed: 0 };
    let cursor: string | null = null;
    let isDone = false;
    while (!isDone) {
      const r: CleanBatchResult = await ctx.runMutation(restructureStorageKeysBatchRef, { table, cursor });
      totals[table].scanned += r.scanned;
      totals[table].changed += r.changed;
      cursor = r.continueCursor;
      isDone = r.isDone;
    }
  }
  return totals;
}
