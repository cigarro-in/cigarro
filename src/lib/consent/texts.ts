// Version strings for the exact wording a visitor saw. Stored with every
// consent row (consentEvents.textVersion). Bump the suffix when the wording
// changes; never reuse a version for different text.
export const CONSENT_TEXT_VERSION = {
  ageGateClassic: 'age-gate.classic.v1',
  ageGateVivid: 'age-gate.vivid.v1',
  checkoutTerms: 'checkout-terms.v1',
} as const;
