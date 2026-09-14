import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireIdentity } from "./lib/auth";

// ---------- Wave 7: referrals, minimal (Supabase -> Convex) ----------
// Ports the exact RPC semantics from 040 (record/validate) that the app
// consumes. Reward *payout* never existed server-side (no trigger/RPC sets
// first_order_completed), so flags are carried, not invented.
// Reads stay snake_case + ISO dates, matching the old row shape.

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

async function genCode(ctx: any): Promise<string> {
  for (let i = 0; i < 20; i++) {
    let code = "";
    for (let j = 0; j < 6; j++)
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    const clash = await ctx.db
      .query("referrals")
      .withIndex("by_code", (q: any) => q.eq("referralCode", code))
      .unique();
    if (!clash) return code;
  }
  throw new ConvexError({ code: "CODE_EXHAUSTED" });
}

function toReferral(r: any) {
  const iso = (ms?: number | null) =>
    ms ? new Date(ms).toISOString() : null;
  return {
    id: r._id,
    user_id: r.userId,
    referral_code: r.referralCode,
    total_referrals: r.totalReferrals,
    successful_referrals: r.successfulReferrals,
    total_rewards_earned: r.totalRewardsEarned,
    referred_by_user_id: r.referredByUserId ?? null,
    referred_by_code: r.referredByCode ?? null,
    referral_reward_amount: r.referralRewardAmount,
    first_order_completed: r.firstOrderCompleted,
    first_order_id: r.firstOrderId ?? null,
    first_order_date: iso(r.firstOrderDate),
    own_reward_paid: r.ownRewardPaid,
    own_reward_paid_at: iso(r.ownRewardPaidAt),
    signup_source: r.signupSource ?? null,
    ip_address: r.ipAddress ?? null,
    user_agent: r.userAgent ?? null,
    is_active: r.isActive,
    created_at: new Date(r.createdAt).toISOString(),
    updated_at: new Date(r.updatedAt).toISOString(),
  };
}

async function nameFor(ctx: any, userId: string): Promise<string> {
  const u = await ctx.db
    .query("users")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .unique();
  return u?.name ?? "A friend";
}

// Get-or-create my row (trigger replacement: old system minted a row per
// auth user via trigger; lazy here, same as the users spine).
export const ensureMyReferral = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const existing = await ctx.db
      .query("referrals")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .unique();
    if (existing) return toReferral(existing);
    const now = Date.now();
    const id = await ctx.db.insert("referrals", {
      userId: identity.subject,
      referralCode: await genCode(ctx),
      totalReferrals: 0,
      successfulReferrals: 0,
      totalRewardsEarned: 0,
      referralRewardAmount: 100,
      firstOrderCompleted: false,
      ownRewardPaid: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    return toReferral(await ctx.db.get(id));
  },
});

export const getMyReferral = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const row = await ctx.db
      .query("referrals")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .unique();
    return row ? toReferral(row) : null;
  },
});

// Public by design: logged-out visitors validate codes on the landing page.
export const validateReferralCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const want = code.trim().toUpperCase();
    if (!want) return { valid: false, error: "Invalid referral code" };
    const row = await ctx.db
      .query("referrals")
      .withIndex("by_code", (q) => q.eq("referralCode", want))
      .unique();
    if (!row || !row.isActive)
      return { valid: false, error: "Invalid referral code" };
    return { valid: true, referrer_name: await nameFor(ctx, row.userId) };
  },
});

async function attach(ctx: any, subject: string, referredUserId: string, referralCode: string, signupSource?: string, ipAddress?: string, userAgent?: string) {
  if (referredUserId !== subject) throw new ConvexError({ code: "FORBIDDEN" });
  const want = referralCode.trim().toUpperCase();
  const referrer = await ctx.db
    .query("referrals")
    .withIndex("by_code", (q: any) => q.eq("referralCode", want))
    .unique();
  if (!referrer || !referrer.isActive)
    return { success: false, error: "Invalid referral code" };
  if (referrer.userId === referredUserId)
    return { success: false, error: "Cannot refer yourself" };
  let mine = await ctx.db
    .query("referrals")
    .withIndex("by_user", (q: any) => q.eq("userId", referredUserId))
    .unique();
  if (mine?.referredByUserId)
    return { success: false, error: "User already referred" };
  const now = Date.now();
  if (!mine) {
    const id = await ctx.db.insert("referrals", {
      userId: referredUserId,
      referralCode: await genCode(ctx),
      totalReferrals: 0,
      successfulReferrals: 0,
      totalRewardsEarned: 0,
      referralRewardAmount: 100,
      firstOrderCompleted: false,
      ownRewardPaid: false,
      referredByUserId: referrer.userId,
      referredByCode: want,
      signupSource,
      ipAddress,
      userAgent,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    mine = await ctx.db.get(id);
  } else {
    await ctx.db.patch(mine._id, {
      referredByUserId: referrer.userId,
      referredByCode: want,
      signupSource: signupSource ?? mine.signupSource,
      ipAddress: ipAddress ?? mine.ipAddress,
      userAgent: userAgent ?? mine.userAgent,
      updatedAt: now,
    });
  }
  await ctx.db.patch(referrer._id, {
    totalReferrals: referrer.totalReferrals + 1,
    updatedAt: now,
  });
  return {
    success: true,
    referrer_id: referrer.userId,
    referrer_name: await nameFor(ctx, referrer.userId),
  };
}

// Signup-time attach (ReferralTracker) — mirrors record_referral (040).
export const recordReferral = mutation({
  args: {
    referredUserId: v.string(),
    referralCode: v.string(),
    signupSource: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const identity = await requireIdentity(ctx);
    return attach(ctx, identity.subject, a.referredUserId, a.referralCode, a.signupSource, a.ipAddress, a.userAgent);
  },
});

// Late attach (mobile checkout) — same rules, idempotent result contract.
export const attachReferralLate = mutation({
  args: { referredUserId: v.string(), referralCode: v.string() },
  handler: async (ctx, a) => {
    const identity = await requireIdentity(ctx);
    return attach(ctx, identity.subject, a.referredUserId, a.referralCode, "checkout_late");
  },
});

// Eligibility for the checkout referral box (subject-scoped).
export const checkEligibility = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const mine = await ctx.db
      .query("referrals")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .unique();
    if (!mine) return { eligible: true, applied: false };
    if (!mine.referredByUserId && !mine.firstOrderCompleted)
      return { eligible: true, applied: false };
    return {
      eligible: false,
      applied: !!mine.referredByUserId && !mine.firstOrderCompleted,
    };
  },
});

export const checkIfReferred = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const mine = await ctx.db
      .query("referrals")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .unique();
    if (!mine?.referredByUserId) return { was_referred: false };
    return {
      was_referred: true,
      referrer_name: await nameFor(ctx, mine.referredByUserId),
      reward_pending:
        mine.firstOrderCompleted && !mine.ownRewardPaid
          ? mine.referralRewardAmount
          : 0,
    };
  },
});

export const getReferralStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const mine = await ctx.db
      .query("referrals")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .unique();
    if (!mine) return null;
    return {
      referral_code: mine.referralCode,
      total_referrals: mine.totalReferrals,
      successful_referrals: mine.successfulReferrals,
      pending_referrals: Math.max(0, mine.totalReferrals - mine.successfulReferrals),
      total_rewards_earned: mine.totalRewardsEarned,
      referral_link: "",
      own_reward_pending:
        mine.referredByUserId && mine.firstOrderCompleted && !mine.ownRewardPaid
          ? mine.referralRewardAmount
          : 0,
    };
  },
});

export const getReferredUsers = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const rows = await ctx.db
      .query("referrals")
      .withIndex("by_referrer", (q: any) => q.eq("referredByUserId", identity.subject))
      .collect();
    const out = [];
    for (const r of rows) {
      const u = await ctx.db
        .query("users")
        .withIndex("by_user", (q: any) => q.eq("userId", r.userId))
        .unique();
      out.push({
        referred_user_id: r.userId,
        referred_user_email: u?.phone ?? "",
        referred_user_name: u?.name ?? "A friend",
        signup_date: new Date(r.createdAt).toISOString(),
        first_order_completed: r.firstOrderCompleted,
        first_order_date: r.firstOrderDate ? new Date(r.firstOrderDate).toISOString() : null,
        reward_earned: r.firstOrderCompleted ? r.referralRewardAmount : 0,
      });
    }
    return out;
  },
});

export const getLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db.query("referrals").collect();
    rows.sort((a, b) => b.successfulReferrals - a.successfulReferrals || b.totalReferrals - a.totalReferrals);
    const out = [];
    for (const r of rows.slice(0, limit ?? 10)) {
      const u = await ctx.db
        .query("users")
        .withIndex("by_user", (q: any) => q.eq("userId", r.userId))
        .unique();
      out.push({
        user_id: r.userId,
        user_name: u?.name ?? "A friend",
        email: u?.phone ?? "",
        referral_code: r.referralCode,
        total_referrals: r.totalReferrals,
        successful_referrals: r.successfulReferrals,
        total_rewards_earned: r.totalRewardsEarned,
        created_at: new Date(r.createdAt).toISOString(),
      });
    }
    return out;
  },
});
