// Fills {{token}} placeholders in built-in and custom store page text from the
// store's settings. Pure: no React, no Convex.
//
// Two modes:
// - 'html': values are escaped, and a list value becomes a <ul> (the body).
// - 'text': raw values (titles, meta tags, breadcrumbs).
// Unknown tokens are left as written, so a typo stays visible to the admin.

import type { StoreSettings } from '../storeSettings';

export type TokenValue = string | string[];

export const STORE_PAGE_TOKENS = [
  'storeName',
  'supportEmail',
  'supportPhone',
  'address',
  'deliveryOptions',
] as const;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function fillStorePageTokens(
  template: string,
  values: Record<string, TokenValue>,
  mode: 'html' | 'text',
): string {
  return template.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) return match;
    const value = values[key];
    if (Array.isArray(value)) {
      if (mode === 'text') return value.join('; ');
      if (value.length === 0) return '';
      return `<ul>${value.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
    }
    return mode === 'html' ? escapeHtml(value) : value;
  });
}

/** Token values for one store. deliveryLines: one line per live shipping method. */
export function storePageTokenValues(
  settings: StoreSettings,
  deliveryLines: string[],
): Record<string, TokenValue> {
  const a = settings.business.address;
  return {
    storeName: settings.name,
    supportEmail: settings.business.supportEmail,
    supportPhone: settings.business.supportPhone,
    address: [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', '),
    deliveryOptions: deliveryLines,
  };
}
