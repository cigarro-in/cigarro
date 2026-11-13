import { paiseToRupees } from './convex/money';
import { siteConfig } from '../config/site';

// Pure per-store settings model (no Convex imports, safe for themes).
// Per-store settings for themes and pages. Reads the public siteSettings
// fields via api.content.getSiteSettings and fills every missing value with
// the defaults in src/config/site.ts, so a store that has never saved its
// settings renders exactly as before. Themes consume this through props or
// this hook, never by importing convex/react themselves.

export interface StoreStateMinAge {
  state: string;
  minAge: number;
}

export interface StoreAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
}

export interface ReferralRewardRule {
  type: 'fixed' | 'percent';
  value: number; // fixed: paise; percent: 0-100
}

// Refer & earn program rules, normalized (see convex/lib/siteSettings.ts).
export interface StoreReferralRules {
  enabled: boolean;
  referrerReward: ReferralRewardRule;
  refereeReward: ReferralRewardRule;
  minOrderPaise: number;
  creditWhen: 'paid' | 'delivered';
  maxRewardsPerReferrer: number; // 0 = unlimited
  expiryDays: number; // 0 = never
}

export interface StoreSettings {
  name: string;
  metaTitle: string;
  metaDescription: string;
  brand: { logoUrl: string; faviconUrl: string; brandColor: string };
  business: {
    legalName: string;
    gstin: string;
    supportEmail: string;
    supportPhone: string;
    address: StoreAddress;
    openingHours: string;
  };
  ageGate: { enabled: boolean; minAge: number; stateMinAge: StoreStateMinAge[] };
  referralRewardPaise: number;
  referralRewardRupees: number;
  referral: StoreReferralRules;
  seo: {
    titleTemplate: string;
    defaultDescription: string;
    googleSiteVerification: string;
    bingSiteVerification: string;
    gaMeasurementId: string;
  };
  socials: {
    instagram: string;
    facebook: string;
    x: string;
    youtube: string;
    whatsapp: string;
  };
}

// Shape of the public getSiteSettings payload (all optional: old rows).
export interface RawStoreSettings {
  siteName?: string | null;
  faviconUrl?: string | null; // legacy top-level favicon (pre brand.faviconUrl)
  metaTitle?: string | null;
  metaDescription?: string | null;
  brand?: Partial<StoreSettings['brand']> | null;
  business?: {
    legalName?: string;
    gstin?: string;
    supportEmail?: string;
    supportPhone?: string;
    address?: Partial<StoreAddress>;
    openingHours?: string;
  } | null;
  ageGate?: {
    enabled: boolean;
    minAge: number;
    stateMinAge: StoreStateMinAge[];
  } | null;
  referralRewardPaise?: number | null;
  referral?: Partial<StoreReferralRules> | null;
  seo?: Partial<StoreSettings['seo']> | null;
  socials?: Partial<StoreSettings['socials']> | null;
}

// Blank strings count as unset, so they fall back like a missing value.
const str = (v: unknown, fallback = ''): string =>
  typeof v === 'string' && v.trim() !== '' ? v : fallback;

const DEFAULT_META_TITLE = 'Cigarro';
const DEFAULT_META_DESCRIPTION = 'The finest selection of premium cigarettes and cigars.';

/** Human copy for one reward rule: "₹100" or "5% of the order". */
export function formatReferralReward(rule: ReferralRewardRule): string {
  if (rule.type === 'fixed') return `₹${paiseToRupees(rule.value)}`;
  return `${rule.value}% of the order`;
}

// Rows saved before the program existed use the flat reward for both sides.
function resolveReferral(raw: RawStoreSettings | null | undefined, flatPaise: number): StoreReferralRules {
  const flat: ReferralRewardRule = { type: 'fixed', value: flatPaise };
  const r = raw?.referral;
  if (!r) {
    return {
      enabled: true,
      referrerReward: flat,
      refereeReward: flat,
      minOrderPaise: 0,
      creditWhen: 'delivered',
      maxRewardsPerReferrer: 0,
      expiryDays: 0,
    };
  }
  return {
    enabled: r.enabled !== false,
    referrerReward: r.referrerReward ?? flat,
    refereeReward: r.refereeReward ?? flat,
    minOrderPaise: r.minOrderPaise ?? 0,
    creditWhen: r.creditWhen ?? 'delivered',
    maxRewardsPerReferrer: r.maxRewardsPerReferrer ?? 0,
    expiryDays: r.expiryDays ?? 0,
  };
}

/** Pure normalizer: stored values win, missing values fall back to defaults. */
export function resolveStoreSettings(raw?: RawStoreSettings | null): StoreSettings {
  const d = siteConfig;
  const addr = raw?.business?.address ?? {};
  const age = raw?.ageGate;
  const paise =
    typeof raw?.referralRewardPaise === 'number'
      ? raw.referralRewardPaise
      : d.referralRewardPaise;
  const referral = resolveReferral(raw, paise);
  // Brand fallbacks derive from the store's own name, never from the
  // oldsmokeshop defaults in site.ts (a store without seo.titleTemplate must
  // not get "| Cigarro").
  const name = str(raw?.siteName, d.name);
  return {
    name,
    metaTitle: str(raw?.metaTitle, name || DEFAULT_META_TITLE),
    metaDescription: str(raw?.metaDescription, DEFAULT_META_DESCRIPTION),
    brand: {
      logoUrl: str(raw?.brand?.logoUrl),
      faviconUrl: str(raw?.brand?.faviconUrl, str(raw?.faviconUrl)),
      brandColor: str(raw?.brand?.brandColor, d.theme.primaryColor),
    },
    business: {
      legalName: str(raw?.business?.legalName),
      gstin: str(raw?.business?.gstin),
      supportEmail: str(raw?.business?.supportEmail, d.email.support),
      supportPhone: str(raw?.business?.supportPhone),
      address: {
        line1: str(addr.line1),
        line2: str(addr.line2),
        city: str(addr.city),
        state: str(addr.state),
        pincode: str(addr.pincode),
      },
      openingHours: str(raw?.business?.openingHours),
    },
    ageGate: {
      enabled: age ? age.enabled : d.ageGate.enabled,
      minAge: age ? age.minAge : d.ageGate.minAge,
      stateMinAge: age
        ? age.stateMinAge.map((s) => ({ state: s.state, minAge: s.minAge }))
        : d.ageGate.stateMinAge.map((s) => ({ ...s })),
    },
    // Legacy flat mirror: the referee's fixed reward, or 0 for percent rules.
    referralRewardPaise: referral.refereeReward.type === 'fixed' ? referral.refereeReward.value : 0,
    referralRewardRupees: paiseToRupees(referral.refereeReward.type === 'fixed' ? referral.refereeReward.value : 0),
    referral,
    seo: {
      titleTemplate: str(raw?.seo?.titleTemplate, `%s | ${name}`),
      defaultDescription: str(raw?.seo?.defaultDescription, d.seo.defaultDescription),
      googleSiteVerification: str(raw?.seo?.googleSiteVerification),
      bingSiteVerification: str(raw?.seo?.bingSiteVerification),
      gaMeasurementId: str(raw?.seo?.gaMeasurementId),
    },
    socials: {
      instagram: str(raw?.socials?.instagram, d.social.instagram),
      facebook: str(raw?.socials?.facebook, d.social.facebook),
      x: str(raw?.socials?.x, d.social.twitter),
      youtube: str(raw?.socials?.youtube),
      whatsapp: str(raw?.socials?.whatsapp),
    },
  };
}

export const DEFAULT_AGE_GATE = resolveStoreSettings().ageGate;

// "18" or "18 (21 for Karnataka)" for copy such as "over 18 years".
export function ageRuleLabel(gate: { minAge: number; stateMinAge: StoreStateMinAge[] }): string {
  const states = gate.stateMinAge.map((s) => `${s.minAge} for ${s.state}`);
  return states.length ? `${gate.minAge} (${states.join(', ')})` : `${gate.minAge}`;
}
