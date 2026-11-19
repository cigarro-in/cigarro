// R2 restructure ledger (CLAUDE.md "Images"). One row per pre-restructure image
// key, holding the new key it was copied to. Written by the super-admin copy
// endpoint (functions/api/sa/storage-copy.js), read by its planner and by
// restructureStorageKeys-v1 (convex/migrations.ts). Copy only: rows never mean
// an object was moved or deleted.
import { ConvexError, v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { requireSaSession, requireSaWrite } from "./lib/auth";
import { audit } from "./lib/audit";

const MAX_RESULTS_PER_CALL = 100;

const resultV = v.object({
  fromKey: v.string(),
  toKey: v.string(),
  orgSlug: v.string(),
  status: v.union(v.literal("copied"), v.literal("conflict"), v.literal("failed")),
});

// Planner input for one store: its copied moves, keyed by old key. Conflict and
// failed rows are left out so their names are planned again.
export const plan = query({
  args: { saToken: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, { saToken, orgId }) => {
    await requireSaSession(ctx, saToken);
    const org = await ctx.db.get(orgId);
    if (!org) throw new ConvexError({ code: "ORG_NOT_FOUND" });
    if (org.kind === "platform") throw new ConvexError({ code: "PLATFORM_ORG_PROTECTED" });
    const rows = await ctx.db
      .query("storageKeyMoves")
      .withIndex("by_org", (q) => q.eq("orgSlug", org.slug))
      .collect();
    const moves: Record<string, string> = {};
    for (const r of rows) if (r.status === "copied") moves[r.fromKey] = r.toKey;
    return { slug: org.slug, moves };
  },
});

// Per-store totals for the super-admin card.
export const summary = query({
  args: { saToken: v.string() },
  handler: async (ctx, { saToken }) => {
    await requireSaSession(ctx, saToken);
    const rows = await ctx.db.query("storageKeyMoves").collect();
    const bySlug = new Map<string, { orgSlug: string; copied: number; conflict: number; failed: number }>();
    for (const r of rows) {
      const row = bySlug.get(r.orgSlug) ?? { orgSlug: r.orgSlug, copied: 0, conflict: 0, failed: 0 };
      row[r.status] += 1;
      bySlug.set(r.orgSlug, row);
    }
    return [...bySlug.values()].sort((a, b) => a.orgSlug.localeCompare(b.orgSlug));
  },
});

// Upserts one row per old key (the latest attempt wins). Write window required.
export const record = mutation({
  args: { saToken: v.string(), results: v.array(resultV) },
  handler: async (ctx, { saToken, results }) => {
    const sa = await requireSaWrite(ctx, saToken);
    if (results.length > MAX_RESULTS_PER_CALL) throw new ConvexError({ code: "TOO_MANY_RESULTS" });
    const now = Date.now();
    for (const r of results) {
      const existing = await ctx.db
        .query("storageKeyMoves")
        .withIndex("by_fromKey", (q) => q.eq("fromKey", r.fromKey))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, { toKey: r.toKey, orgSlug: r.orgSlug, status: r.status, updatedAt: now });
      } else {
        await ctx.db.insert("storageKeyMoves", { ...r, updatedAt: now });
      }
    }
    const copied = results.filter((r) => r.status === "copied").length;
    await audit(ctx, {
      adminUserId: sa.adminId,
      actorType: "super_admin",
      action: "platform.storage.copy",
      targetType: "storageKeyMoves",
      targetId: results[0]?.orgSlug ?? "",
      payload: { recorded: results.length, copied, conflict: results.length - copied },
    });
    return { recorded: results.length };
  },
});

// Migration input: every copied move across all stores (convex/migrations.ts).
export const loadCopiedMap = internalQuery({
  args: {},
  handler: async (ctx): Promise<Record<string, string>> => {
    const rows = await ctx.db.query("storageKeyMoves").collect();
    const out: Record<string, string> = {};
    for (const r of rows) if (r.status === "copied") out[r.fromKey] = r.toKey;
    return out;
  },
});
