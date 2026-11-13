import type { RawStoreSettings, StoreSettings } from '../../../lib/storeSettings';

/** Props every settings section receives from the shell (live, non-null). */
export interface SectionProps {
  live: StoreSettings;
  /** Stored values as saved (null when the store has never saved settings). */
  raw: RawStoreSettings | null;
}

// Settings index: one entry per sub-route (/settings/<id>). Order is the list order.
export type SettingsSectionId = 'store' | 'checkout' | 'referral' | 'legal' | 'advanced';

export interface SettingsSection {
  id: SettingsSectionId;
  label: string;
  description: string;
}

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { id: 'store', label: 'Store details', description: 'Name, logo, site icon, contact and social links' },
  { id: 'checkout', label: 'Checkout & shipping', description: 'Delivery methods, prices and estimates' },
  { id: 'referral', label: 'Refer & earn', description: 'Rewards for inviting friends' },
  { id: 'legal', label: 'Legal & age gate', description: 'Legal name, GSTIN and entry age rules' },
  { id: 'advanced', label: 'Advanced', description: 'Theme, search metadata and analytics' },
];

export function settingsSectionFromPath(pathname: string): SettingsSectionId | null {
  const last = pathname.replace(/\/+$/, '').split('/').pop() ?? '';
  return SETTINGS_SECTIONS.find((s) => s.id === last)?.id ?? null;
}
