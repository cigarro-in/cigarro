import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getPlatformAdminIdentity, requirePlatformAdmin } from "./lib/auth";

const KEY = "singleton";

/**
 * Platform-admin read — returns platform-wide config like the bank-alert
 * sender list. Non-platform-admins get null.
 */
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

export const get = query({
  args: {},
  handler: async (ctx) => {
    if (!(await getPlatformAdminIdentity(ctx))) return null;
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
 * Internal-ish read for the Gmail poller — returns the merged sender list
 * (custom + defaults, deduped) used to build the Gmail search query.
 */
export const getBankSenders = query({
  args: {},
  handler: async (ctx) => {
    if (!(await getPlatformAdminIdentity(ctx))) return null;
    const row = await ctx.db
      .query("appConfig")
      .withIndex("by_key", (q) => q.eq("key", KEY))
      .unique();
    return mergeSenders(row?.bankSenders);
  },
});

/**
 * Mutation — callable only by a PLATFORM_ADMIN_USER_IDS member.
 */
export const set = mutation({
  args: {
    bankSenders: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Interim: replaced by Citadel `requireSaWrite` once super-admin SSO lands.
    const identity = await requirePlatformAdmin(ctx);

    const patch: Record<string, unknown> = {
      updatedAt: Date.now(),
      updatedBy: identity.subject,
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
  },
});
