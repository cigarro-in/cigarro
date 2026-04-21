import { ConvexError, v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, mutation, query } from "./_generated/server";
import { requireIdentity, requireMember, requireOrgAdmin } from "./lib/auth";
import { audit } from "./lib/audit";
import { assertPositiveInt } from "./lib/money";
import { ledgerReason } from "./schema";

// ---------- Internal primitives ----------

export async function getOrCreateWalletAccount(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  userId: string,
): Promise<Doc<"walletAccounts">> {
  const existing = await ctx.db
    .query("walletAccounts")
    .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
    .unique();
  if (existing) return existing;
  const id = await ctx.db.insert("walletAccounts", {
    orgId,
    userId,
    balancePaise: 0,
    updatedAt: Date.now(),
  });
  return (await ctx.db.get(id))!;
}

export async function debitWallet(
  ctx: MutationCtx,
  args: {
    orgId: Id<"organizations">;
    userId: string;
    amountPaise: number;
    reason: Doc<"walletLedger">["reason"];
    relatedOrderId?: Id<"orders">;
    createdBy?: string;
    note?: string;
  },
) {
  assertPositiveInt(args.amountPaise, "amountPaise");
  if (args.amountPaise === 0) return;
  const acct = await getOrCreateWalletAccount(ctx, args.orgId, args.userId);
  if (acct.balancePaise < args.amountPaise) {
    throw new ConvexError({
      code: "INSUFFICIENT_WALLET",
      balance: acct.balancePaise,
      requested: args.amountPaise,
    });
  }
  const balanceAfterPaise = acct.balancePaise - args.amountPaise;
  await ctx.db.patch(acct._id, {
    balancePaise: balanceAfterPaise,
    updatedAt: Date.now(),
  });
  await ctx.db.insert("walletLedger", {
    orgId: args.orgId,
    userId: args.userId,
    entryType: "debit",
    amountPaise: args.amountPaise,
    balanceAfterPaise,
    reason: args.reason,
    relatedOrderId: args.relatedOrderId,
    createdAt: Date.now(),
    createdBy: args.createdBy ?? "system",
    note: args.note,
  });
}

export async function creditWallet(
  ctx: MutationCtx,
  args: {
    orgId: Id<"organizations">;
    userId: string;
    amountPaise: number;
    reason: Doc<"walletLedger">["reason"];
    relatedOrderId?: Id<"orders">;
    createdBy?: string;
    note?: string;
  },
) {
  assertPositiveInt(args.amountPaise, "amountPaise");
  if (args.amountPaise === 0) return;
  const acct = await getOrCreateWalletAccount(ctx, args.orgId, args.userId);
  const balanceAfterPaise = acct.balancePaise + args.amountPaise;
  await ctx.db.patch(acct._id, {
    balancePaise: balanceAfterPaise,
    updatedAt: Date.now(),
  });
  await ctx.db.insert("walletLedger", {
    orgId: args.orgId,
    userId: args.userId,
    entryType: "credit",
    amountPaise: args.amountPaise,
    balanceAfterPaise,
    reason: args.reason,
    relatedOrderId: args.relatedOrderId,
    createdAt: Date.now(),
    createdBy: args.createdBy ?? "system",
    note: args.note,
  });
}

// ---------- Public queries ----------

export const getMyBalance = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const identity = await requireIdentity(ctx);
    const acct = await ctx.db
      .query("walletAccounts")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", orgId).eq("userId", identity.subject),
      )
      .unique();
    return { balancePaise: acct?.balancePaise ?? 0 };
  },
});

export const getMyLedger = query({
  args: {
    orgId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { orgId, limit }) => {
    const identity = await requireIdentity(ctx);
    return await ctx.db
      .query("walletLedger")
      .withIndex("by_org_user_time", (q) =>
        q.eq("orgId", orgId).eq("userId", identity.subject),
      )
      .order("desc")
      .take(limit ?? 50);
  },
});

// ---------- Admin ----------

export const adminCreditWallet = mutation({
  args: {
    orgId: v.id("organizations"),
    targetUserId: v.string(),
    amountPaise: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireOrgAdmin(ctx, args.orgId);
    assertPositiveInt(args.amountPaise, "amountPaise");
    await creditWallet(ctx, {
      orgId: args.orgId,
      userId: args.targetUserId,
      amountPaise: args.amountPaise,
      reason: "admin_credit",
      createdBy: `admin:${identity.subject}`,
      note: args.note,
    });
    await audit(ctx, {
      orgId: args.orgId,
      adminUserId: identity.subject,
      action: "wallet_credit",
      targetType: "user",
      targetId: args.targetUserId,
      payload: { amountPaise: args.amountPaise, note: args.note },
    });
  },
});
