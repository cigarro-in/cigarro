import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireIdentity } from "./lib/auth";

const KEY = "singleton";

/**
 * Public read — returns platform-wide config like the GAS template URL.
 * Safe to expose: the template URL is intentionally shared with tenants
 * (it's the "copy this master project" link).
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
function mergeSenders(custom: string[] | undefined): string[] {
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
    const row = await ctx.db
      .query("appConfig")
      .withIndex("by_key", (q) => q.eq("key", KEY))
      .unique();
    return {
      gasTemplateUrl: row?.gasTemplateUrl ?? null,
      bankSenders: mergeSenders(row?.bankSenders),
      customBankSenders: row?.bankSenders ?? [],
      defaultBankSenders: DEFAULT_SENDERS,
    };
  },
});

/**
 * Internal-ish read for the pokeGas action — returns the merged sender list
 * (custom + defaults, deduped) the GAS should search Gmail for.
 */
export const getBankSenders = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("appConfig")
      .withIndex("by_key", (q) => q.eq("key", KEY))
      .unique();
    return mergeSenders(row?.bankSenders);
  },
});

/**
 * Mutation — callable only by a user who is an `owner` of at least one org.
 * Keeps this gated while still letting you edit from the admin UI.
 */
export const set = mutation({
  args: {
    gasTemplateUrl: v.optional(v.string()),
    bankSenders: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const ownerMembership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .filter((q) => q.eq(q.field("role"), "owner"))
      .first();
    if (!ownerMembership) throw new ConvexError({ code: "NOT_PLATFORM_OWNER" });

    const patch: Record<string, unknown> = {
      updatedAt: Date.now(),
      updatedBy: identity.subject,
    };

    if (args.gasTemplateUrl !== undefined) {
      const url = args.gasTemplateUrl.trim();
      if (url && !/^https:\/\/script\.google\.com\/home\/projects\/[^/]+\/copy$/i.test(url)) {
        throw new ConvexError({ code: "INVALID_TEMPLATE_URL" });
      }
      patch.gasTemplateUrl = url || undefined;
    }

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
