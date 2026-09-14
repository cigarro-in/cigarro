import { mutation } from "./_generated/server";
import { v } from "convex/values";

// TEMPORARY one-shot PROD seed (public so PROD tables can be seeded over
// HTTPS; removed immediately after — do not build on it).
export const seedProd = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let discounts = 0;
    let referrals = 0;

    const clash = await ctx.db
      .query("discounts")
      .withIndex("by_code", (q) => q.eq("code", "2FW3A5FI"))
      .unique();
    if (!clash) {
      await ctx.db.insert("discounts", {
        name: "Lucky",
        code: "2FW3A5FI",
        type: "percentage",
        value: 10,
        applicable_to: "all",
        start_date: 1764633600000,
        end_date: 1765584000000,
        usage_limit: 1,
        usage_count: 0,
        is_active: true,
        createdAt: now,
        updatedAt: now,
      });
      discounts = 1;
    }

    const codes: [string, string][] = [
      ["baccd998-1171-4215-abf1-21bbf4939e00", "GJ3DQP"],
      ["f796bcbf-ecd8-4e83-9479-fd39b41d967d", "XEVLUS"],
      ["ba687c21-3990-4378-9bdb-eeab3d11633a", "VM4JXU"],
    ];
    for (const [userId, referralCode] of codes) {
      const existing = await ctx.db
        .query("referrals")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      if (existing) continue;
      await ctx.db.insert("referrals", {
        userId,
        referralCode,
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
      referrals++;
    }
    return { discounts, referrals };
  },
});
