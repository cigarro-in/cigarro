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
} from "./_generated/server";
import { RENAME_MIGRATION } from "./lib/legacyOrg";
import { genOrderNumberCandidate, isValidOrderNumber } from "./lib/ids";

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
