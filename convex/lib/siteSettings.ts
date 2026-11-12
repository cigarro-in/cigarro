import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { DatabaseReader } from "../_generated/server";

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

/**
 * The org's siteSettings row. Smokeshop also reads pre-backfill legacy rows
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
  if (row || org.slug !== "smokeshop") return row;
  const legacy = await ctx.db
    .query("siteSettings")
    .withIndex("by_key", (q) => q.eq("key", "main"))
    .collect();
  return legacy.find((r) => r.orgId == null) ?? null;
}
