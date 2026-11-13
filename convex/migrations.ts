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
import { RENAME_MIGRATION, renameDone } from "./lib/legacyOrg";
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
