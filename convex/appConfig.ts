import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireSaSession, requireSaWrite } from "./lib/auth";
import { audit } from "./lib/audit";

const KEY = "singleton";

// Sender patterns used for the Gmail `from:` search. Domain-level is safer
// than exact address — HDFC can rotate sender addresses without breaking us.
// The template parser's senderRegex does the final check to decide which
// matched emails are genuine transaction alerts.
export const DEFAULT_SENDERS = [
  "hdfcbank.bank.in",
  "hdfcbank.net",
];

/**
 * Merge custom senders with built-in defaults (deduplicated, case-insensitive).
 * Custom senders are always added — never replace — so enabling one bank
 * doesn't disable HDFC.
 */
export function mergeSenders(custom: string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of [...(custom ?? []), ...DEFAULT_SENDERS]) {
    const normalized = s.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(s.trim());
  }
  return out;
}

/**
 * Super-admin read (Citadel session) — platform-wide bank-alert sender list.
 */
export const get = query({
  args: { saToken: v.string() },
  handler: async (ctx, { saToken }) => {
    await requireSaSession(ctx, saToken);
    const row = await ctx.db
      .query("appConfig")
      .withIndex("by_key", (q) => q.eq("key", KEY))
      .unique();
    return {
      bankSenders: mergeSenders(row?.bankSenders),
      customBankSenders: row?.bankSenders ?? [],
      defaultBankSenders: DEFAULT_SENDERS,
    };
  },
});

/**
 * Super-admin read — the merged sender list (custom + defaults, deduped).
 */
export const getBankSenders = query({
  args: { saToken: v.string() },
  handler: async (ctx, { saToken }) => {
    await requireSaSession(ctx, saToken);
    const row = await ctx.db
      .query("appConfig")
      .withIndex("by_key", (q) => q.eq("key", KEY))
      .unique();
    return mergeSenders(row?.bankSenders);
  },
});

/**
 * Super-admin write (Citadel session with an open write window).
 */
export const set = mutation({
  args: {
    saToken: v.string(),
    bankSenders: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const sa = await requireSaWrite(ctx, args.saToken);

    const patch: Record<string, unknown> = {
      updatedAt: Date.now(),
      updatedBy: sa.adminId,
    };

    if (args.bankSenders !== undefined) {
      const cleaned = args.bankSenders
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.length < 120);
      if (cleaned.length > 20)
        throw new ConvexError({ code: "TOO_MANY_SENDERS" });
      patch.bankSenders = cleaned.length > 0 ? cleaned : undefined;
    }

    const existing = await ctx.db
      .query("appConfig")
      .withIndex("by_key", (q) => q.eq("key", KEY))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("appConfig", { key: KEY, ...patch } as any);
    }
    await audit(ctx, {
      adminUserId: sa.adminId,
      actorType: "super_admin",
      action: "platform.bankSenders.set",
      targetType: "appConfig",
      targetId: KEY,
      payload: { customCount: args.bankSenders?.length ?? null },
    });
  },
});
