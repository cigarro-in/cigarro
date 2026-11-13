import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { DatabaseReader } from "../_generated/server";
import { isLegacyOrg } from "./legacyOrg";

// Per-org storefront settings (siteSettings row, key = "main").
// Every field is optional so pre-existing rows keep validating. Validators are
// shared by the schema and the admin save mutation.

export const storeAddressV = v.object({
  line1: v.optional(v.string()),
  line2: v.optional(v.string()),
  city: v.optional(v.string()),
  state: v.optional(v.string()),
  pincode: v.optional(v.string()),
});

export const storeBrandV = v.object({
  logoUrl: v.optional(v.string()),
  faviconUrl: v.optional(v.string()),
  brandColor: v.optional(v.string()), // #rrggbb
});

export const storeBusinessV = v.object({
  legalName: v.optional(v.string()),
  gstin: v.optional(v.string()),
  supportEmail: v.optional(v.string()),
  supportPhone: v.optional(v.string()),
  address: v.optional(storeAddressV),
  openingHours: v.optional(v.string()),
});

export const storeAgeGateV = v.object({
  enabled: v.boolean(),
  minAge: v.number(),
  stateMinAge: v.array(v.object({ state: v.string(), minAge: v.number() })),
});

export const storeSeoV = v.object({
  titleTemplate: v.optional(v.string()), // e.g. "%s | Store"
  defaultDescription: v.optional(v.string()),
  googleSiteVerification: v.optional(v.string()),
  bingSiteVerification: v.optional(v.string()),
  gaMeasurementId: v.optional(v.string()),
});

export const storeSocialsV = v.object({
  instagram: v.optional(v.string()),
  facebook: v.optional(v.string()),
  x: v.optional(v.string()),
  youtube: v.optional(v.string()),
  whatsapp: v.optional(v.string()),
});

export const DEFAULT_REFERRAL_REWARD_PAISE = 10000; // Rs 100

// Refer & earn program rules (per store). A reward is either a fixed amount in
// paise or a percent of the qualifying order's final amount.
export const referralRewardV = v.object({
  type: v.union(v.literal("fixed"), v.literal("percent")),
  value: v.number(), // fixed: integer paise; percent: 0-100
});

export const storeReferralV = v.object({
  enabled: v.boolean(),
  referrerReward: referralRewardV,
  refereeReward: referralRewardV,
  minOrderPaise: v.number(), // integer paise; order must reach this to qualify
  creditWhen: v.union(v.literal("paid"), v.literal("delivered")),
  maxRewardsPerReferrer: v.number(), // 0 = unlimited
  expiryDays: v.number(), // 0 = credits never expire
});

export type ReferralReward = { type: "fixed" | "percent"; value: number };
export type ReferralProgramRules = {
  enabled: boolean;
  referrerReward: ReferralReward;
  refereeReward: ReferralReward;
  minOrderPaise: number;
  creditWhen: "paid" | "delivered";
  maxRewardsPerReferrer: number;
  expiryDays: number;
};

/**
 * Effective program rules for an org. Rows saved before the program existed
 * keep the old behaviour: enabled, flat reward (siteSettings.referralRewardPaise)
 * paid to both sides on delivery.
 */
export function resolveReferralProgram(
  row: { referral?: ReferralProgramRules | null; referralRewardPaise?: number | null } | null | undefined,
): ReferralProgramRules {
  const r = row?.referral;
  if (r) return r;
  const flat = row?.referralRewardPaise ?? DEFAULT_REFERRAL_REWARD_PAISE;
  return {
    enabled: true,
    referrerReward: { type: "fixed", value: flat },
    refereeReward: { type: "fixed", value: flat },
    minOrderPaise: 0,
    creditWhen: "delivered",
    maxRewardsPerReferrer: 0,
    expiryDays: 0,
  };
}

/** Paise a reward is worth on an order of `orderPaise` (never negative, integer). */
export function computeReferralRewardPaise(reward: ReferralReward, orderPaise: number): number {
  if (reward.type === "fixed") return Math.max(0, Math.round(reward.value));
  return Math.max(0, Math.floor((orderPaise * reward.value) / 100));
}

/**
 * The org's siteSettings row. The legacy org also reads pre-backfill legacy rows
 * (orgId absent), matching the other org-scoped readers.
 */
export async function readOrgSiteSettings(
  ctx: { db: DatabaseReader },
  org: { _id: Id<"organizations">; slug: string },
) {
  const row = await ctx.db
    .query("siteSettings")
    .withIndex("by_org_key", (q) => q.eq("orgId", org._id).eq("key", "main"))
    .unique();
  if (row || !isLegacyOrg(org)) return row;
  const legacy = await ctx.db
    .query("siteSettings")
    .withIndex("by_key", (q) => q.eq("key", "main"))
    .collect();
  return legacy.find((r) => r.orgId == null) ?? null;
}
