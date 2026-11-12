// One-time data migrations, run automatically by the "run pending migrations"
// cron (convex/crons.ts) every 10 minutes. Each migration is recorded in the
// `migrations` table; a migration marked "done" is never run again. A failing
// migration is retried on later ticks, up to MAX_RUNS attempts.
//
// Internal only. Inspect progress from the super-admin Platform Config page
// (platform:listMigrations).

import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
} from "./_generated/server";

const MAX_RUNS = 5;
const MAX_RESULT_CHARS = 2048;

// Modules absent from the generated api.d.ts until codegen runs; referenced by path.
const seedDomainsRef = makeFunctionReference<"mutation", Record<string, never>, unknown>(
  "domains:seedSmokeshopDomains",
);
const cleanupCanonicalUrlsRef = makeFunctionReference<
  "mutation",
  { orgSlug: string; dryRun: boolean },
  unknown
>("maintenance:cleanupCanonicalUrls");
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

// Order matters: later migrations may depend on earlier ones.
const MIGRATIONS: Migration[] = [
  {
    name: "backfillUserOrgs-v1",
    run: async (ctx) => {
      let cursor: string | null = null;
      let patched = 0;
      let pages = 0;
      for (;;) {
        const page: {
          patched: number;
          isDone: boolean;
          continueCursor: string;
        } = await ctx.runMutation(internal.userState.backfillUserOrgs, {
          orgSlug: "smokeshop",
          cursor,
        });
        patched += page.patched;
        pages += 1;
        if (page.isDone) break;
        cursor = page.continueCursor;
      }
      return { patched, pages };
    },
  },
  {
    name: "migrateLegacyGmail-v1",
    // Fails (and is retried) if GMAIL_TOKEN_KEY is not set.
    run: async (ctx) => await ctx.runAction(internal.gmail.migrateLegacyGmail, {}),
  },
  {
    name: "seedSmokeshopDomains-v1",
    run: async (ctx) => await ctx.runMutation(seedDomainsRef, {}),
  },
  {
    name: "cleanupCanonicalUrls-v1",
    run: async (ctx) =>
      await ctx.runMutation(cleanupCanonicalUrlsRef, {
        orgSlug: "smokeshop",
        dryRun: false,
      }),
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
