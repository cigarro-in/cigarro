import type { RawStoreSettings, StoreSettings } from '../../../lib/storeSettings';

/** Props every settings section receives from the shell (live, non-null). */
export interface SectionProps {
  live: StoreSettings;
  /** Stored values as saved (null when the store has never saved settings). */
  raw: RawStoreSettings | null;
}

// Settings index: one entry per sub-route (/settings/<id>). Order is the list order.
export type SettingsSectionId = 'store' | 'payments' | 'checkout' | 'referral' | 'legal' | 'advanced';

export interface SettingsSection {
  id: SettingsSectionId;
  label: string;
}

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { id: 'store', label: 'Store details' },
  { id: 'payments', label: 'Payments' },
  { id: 'checkout', label: 'Checkout & shipping' },
  { id: 'referral', label: 'Refer & earn' },
  { id: 'legal', label: 'Legal & age gate' },
  { id: 'advanced', label: 'Advanced' },
];

// Anchors that live inside a section but are linked from elsewhere (setup
// checklist, dashboard). #upi and #setup open Payments.
const HASH_ALIASES: Record<string, SettingsSectionId> = { upi: 'payments', setup: 'payments' };

/** Hash deep links such as /settings#payments. */
export function settingsSectionFromHash(hash: string): SettingsSectionId | null {
  const id = hash.replace(/^#/, '');
  return HASH_ALIASES[id] ?? SETTINGS_SECTIONS.find((s) => s.id === id)?.id ?? null;
}

export function settingsSectionFromPath(pathname: string): SettingsSectionId | null {
  const last = pathname.replace(/\/+$/, '').split('/').pop() ?? '';
  return SETTINGS_SECTIONS.find((s) => s.id === last)?.id ?? null;
}
