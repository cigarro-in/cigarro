import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireIdentity } from "./lib/auth";
import { inOrg, resolveOrg } from "./lib/org";
import { creditWallet } from "./wallet";

// ---------- Wave 7: referrals, minimal (Supabase -> Convex) ----------
// ORG-SCOPED: one row per user per org. Ports the record/validate semantics
// from 040 and pays the configured reward from the trusted delivered-order
// transition. Reads stay snake_case + ISO dates, matching the old row shape.

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

async function genCode(ctx: any, org: any): Promise<string> {
  for (let i = 0; i < 20; i++) {
    let code = "";
    for (let j = 0; j < 6; j++)
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    const clash = await ctx.db
      .query("referrals")
      .withIndex("by_org_code", (q: any) =>
        q.eq("orgId", org._id).eq("referralCode", code),
      )
      .unique();
    if (!clash) return code;
    if (org.slug === "smokeshop") {
      const legacy = await ctx.db
        .query("referrals")
        .withIndex("by_code", (q: any) => q.eq("referralCode", code))
        .collect();
      if (!legacy.some((r: any) => r.orgId == null)) return code;
    }
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

async function myReferral(ctx: any, org: any, userId: string) {
  const scoped = await ctx.db
    .query("referrals")
    .withIndex("by_org_user", (q: any) =>
      q.eq("orgId", org._id).eq("userId", userId),
    )
    .unique();
  if (scoped) return scoped;
  if (org.slug !== "smokeshop") return null;
  const legacy = await ctx.db
    .query("referrals")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  return legacy.find((r: any) => r.orgId == null) ?? null;
}

async function referralByCode(ctx: any, org: any, code: string) {
  const want = code.trim().toUpperCase();
  const scoped = await ctx.db
    .query("referrals")
    .withIndex("by_org_code", (q: any) =>
      q.eq("orgId", org._id).eq("referralCode", want),
    )
    .unique();
  if (scoped) return scoped;
  if (org.slug !== "smokeshop") return null;
  const legacy = await ctx.db
    .query("referrals")
    .withIndex("by_code", (q: any) => q.eq("referralCode", want))
    .collect();
  return legacy.find((r: any) => r.orgId == null) ?? null;
}

// Get-or-create my row (trigger replacement: old system minted a row per
// auth user via trigger; lazy here, same as the users spine).
export const ensureMyReferral = mutation({
  args: { orgSlug: v.string() },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const identity = await requireIdentity(ctx);
    const existing = await myReferral(ctx, org, identity.subject);
    if (existing) return toReferral(existing);
    const now = Date.now();
    const id = await ctx.db.insert("referrals", {
      orgId: org._id,
      userId: identity.subject,
      referralCode: await genCode(ctx, org),
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
  args: { orgSlug: v.string() },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const identity = await requireIdentity(ctx);
    const row = await myReferral(ctx, org, identity.subject);
    return row ? toReferral(row) : null;
  },
});

// Public by design: logged-out visitors validate codes on the landing page.
// Scoped by orgSlug: a code is only valid in its own org.
export const validateReferralCode = query({
  args: { orgSlug: v.string(), code: v.string() },
  handler: async (ctx, { orgSlug, code }) => {
    const org = await resolveOrg(ctx, orgSlug);
    const want = code.trim().toUpperCase();
    if (!want) return { valid: false, error: "Invalid referral code" };
    const row = await referralByCode(ctx, org, want);
    if (!row || !row.isActive || !inOrg(row, org))
      return { valid: false, error: "Invalid referral code" };
    return { valid: true, referrer_name: await nameFor(ctx, row.userId) };
  },
});

async function attach(
  ctx: any,
  org: any,
  subject: string,
  referredUserId: string,
  referralCode: string,
  signupSource?: string,
  ipAddress?: string,
  userAgent?: string,
) {
  if (referredUserId !== subject) throw new ConvexError({ code: "FORBIDDEN" });
  const want = referralCode.trim().toUpperCase();
  const referrer = await referralByCode(ctx, org, want);
  if (!referrer || !referrer.isActive || !inOrg(referrer, org))
    return { success: false, error: "Invalid referral code" };
  if (referrer.userId === referredUserId)
    return { success: false, error: "Cannot refer yourself" };
  let mine = await myReferral(ctx, org, referredUserId);
  if (mine?.referredByUserId)
    return { success: false, error: "User already referred" };
  const now = Date.now();
  if (!mine) {
    const id = await ctx.db.insert("referrals", {
      orgId: org._id,
      userId: referredUserId,
      referralCode: await genCode(ctx, org),
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
      orgId: org._id,
      referredByUserId: referrer.userId,
      referredByCode: want,
      signupSource: signupSource ?? mine.signupSource,
      ipAddress: ipAddress ?? mine.ipAddress,
      userAgent: userAgent ?? mine.userAgent,
      updatedAt: now,
    });
  }
  await ctx.db.patch(referrer._id, {
    orgId: org._id,
    totalReferrals: referrer.totalReferrals + 1,
    updatedAt: now,
  });
  return {
    success: true,
    referrer_id: referrer.userId,
    referrer_name: await nameFor(ctx, referrer.userId),
  };
}

// Pay both sides exactly once when the referred customer's first order is
// delivered. This is called from the shipping transition, not the client, so
// a caller cannot award credits by replaying or fabricating a request.
// Internal: scoped by the order's own orgId (signature unchanged for admin.ts).
export async function rewardDeliveredReferral(
  ctx: any,
  order: { orgId: any; userId: string; _id: any },
  createdBy: string,
) {
  const org = await ctx.db.get(order.orgId);
  if (!org) return false;
  const orgRef = { _id: org._id, slug: org.slug };
  const mine = await ctx.db
    .query("referrals")
    .withIndex("by_org_user", (q: any) =>
      q.eq("orgId", order.orgId).eq("userId", order.userId),
    )
    .unique();
  const legacyMine =
    !mine && org.slug === "smokeshop"
      ? await ctx.db
          .query("referrals")
          .withIndex("by_user", (q: any) => q.eq("userId", order.userId))
          .collect()
      : null;
  const mineRow =
    mine ?? legacyMine?.find((r: any) => r.orgId == null) ?? null;
  if (!mineRow?.referredByUserId || mineRow.firstOrderCompleted) return false;

  const referrer = await ctx.db
    .query("referrals")
    .withIndex("by_org_user", (q: any) =>
      q.eq("orgId", order.orgId).eq("userId", mineRow.referredByUserId),
    )
    .unique();
  const legacyReferrer =
    !referrer && org.slug === "smokeshop"
      ? await ctx.db
          .query("referrals")
          .withIndex("by_user", (q: any) => q.eq("userId", mineRow.referredByUserId))
          .collect()
      : null;
  const referrerRow =
    referrer ?? legacyReferrer?.find((r: any) => r.orgId == null) ?? null;
  if (!referrerRow || !referrerRow.isActive || !mineRow.isActive) return false;
  if (!inOrg(mineRow, orgRef) || !inOrg(referrerRow, orgRef)) return false;
  const referrerMembership = await ctx.db
    .query("memberships")
    .withIndex("by_org_user", (q: any) =>
      q.eq("orgId", order.orgId).eq("userId", referrerRow.userId),
    )
    .unique();
  if (!referrerMembership) return false;

  const now = Date.now();
  const rewardPaise = Math.max(0, Math.floor(mineRow.referralRewardAmount * 100));
  await ctx.db.patch(mineRow._id, {
    orgId: order.orgId,
    firstOrderCompleted: true,
    firstOrderId: String(order._id),
    firstOrderDate: now,
    ownRewardPaid: rewardPaise > 0,
    ownRewardPaidAt: rewardPaise > 0 ? now : undefined,
    updatedAt: now,
  });
  await ctx.db.patch(referrerRow._id, {
    orgId: order.orgId,
    successfulReferrals: referrerRow.successfulReferrals + 1,
    totalRewardsEarned: referrerRow.totalRewardsEarned + mineRow.referralRewardAmount,
    updatedAt: now,
  });
  if (rewardPaise > 0) {
    await creditWallet(ctx, {
      orgId: order.orgId,
      userId: order.userId,
      amountPaise: rewardPaise,
      reason: "referral_reward",
      relatedOrderId: order._id,
      createdBy,
      note: "referral_first_order",
    });
    await creditWallet(ctx, {
      orgId: order.orgId,
      userId: referrerRow.userId,
      amountPaise: rewardPaise,
      reason: "referral_reward",
      relatedOrderId: order._id,
      createdBy,
      note: "referral_success",
    });
  }
  return true;
}

// Signup-time attach (ReferralTracker) — mirrors record_referral (040).
export const recordReferral = mutation({
  args: {
    orgSlug: v.string(),
    referredUserId: v.string(),
    referralCode: v.string(),
    signupSource: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const org = await resolveOrg(ctx, a.orgSlug);
    const identity = await requireIdentity(ctx);
    return attach(ctx, org, identity.subject, a.referredUserId, a.referralCode, a.signupSource, a.ipAddress, a.userAgent);
  },
});

// Late attach (mobile checkout) — same rules, idempotent result contract.
export const attachReferralLate = mutation({
  args: { orgSlug: v.string(), referredUserId: v.string(), referralCode: v.string() },
  handler: async (ctx, a) => {
    const org = await resolveOrg(ctx, a.orgSlug);
    const identity = await requireIdentity(ctx);
    return attach(ctx, org, identity.subject, a.referredUserId, a.referralCode, "checkout_late");
  },
});

// Eligibility for the checkout referral box (subject-scoped + org-scoped).
export const checkEligibility = query({
  args: { orgSlug: v.string() },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const identity = await requireIdentity(ctx);
    const mine = await myReferral(ctx, org, identity.subject);
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
  args: { orgSlug: v.string() },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const identity = await requireIdentity(ctx);
    const mine = await myReferral(ctx, org, identity.subject);
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
  args: { orgSlug: v.string() },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const identity = await requireIdentity(ctx);
    const mine = await myReferral(ctx, org, identity.subject);
    // No row yet (pre-migration signup): zero stats with no code yet — the
    // row mints on first record/attach, same lazy pattern as users spine.
    // (Old trigger minted at signup; codes only matter once shared.)
    if (!mine)
      return {
        referral_code: "",
        total_referrals: 0,
        successful_referrals: 0,
        pending_referrals: 0,
        total_rewards_earned: 0,
        referral_link: "",
        own_reward_pending: 0,
      };
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
  args: { orgSlug: v.string() },
  handler: async (ctx, args) => {
    const org = await resolveOrg(ctx, args.orgSlug);
    const identity = await requireIdentity(ctx);
    const scoped = await ctx.db
      .query("referrals")
      .withIndex("by_org_referrer", (q: any) =>
        q.eq("orgId", org._id).eq("referredByUserId", identity.subject),
      )
      .collect();
    let rows = scoped;
    if (org.slug === "smokeshop") {
      const legacy = await ctx.db
        .query("referrals")
        .withIndex("by_referrer", (q: any) =>
          q.eq("referredByUserId", identity.subject),
        )
        .collect();
      const seen = new Set(scoped.map((r: any) => r._id));
      rows = [...scoped, ...legacy.filter((r: any) => r.orgId == null && !seen.has(r._id))];
    }
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
  args: { orgSlug: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { orgSlug, limit }) => {
    const org = await resolveOrg(ctx, orgSlug);
    const scoped = await ctx.db
      .query("referrals")
      .withIndex("by_org", (q: any) => q.eq("orgId", org._id))
      .collect();
    let rows = scoped;
    if (org.slug === "smokeshop") {
      const legacy = await ctx.db
        .query("referrals")
        .withIndex("by_org", (q: any) => q.eq("orgId", undefined))
        .collect();
      const seen = new Set(scoped.map((r: any) => r._id));
      rows = [...scoped, ...legacy.filter((r: any) => !seen.has(r._id))];
    }
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
