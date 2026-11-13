// Shared helpers for the customer list and profile. Pure functions only.

export interface CustomerListRow {
  id: string;
  name: string;
  phone: string;
  isAdmin: boolean;
  orderCount: number;
  totalSpent: number;
  lastOrderDate: number | null;
  createdAt: number;
}

/** Newest activity first; customers without orders sort last. */
export function sortByLastOrder(rows: CustomerListRow[]): CustomerListRow[] {
  return rows.slice().sort((a, b) => {
    const al = a.lastOrderDate ?? -Infinity;
    const bl = b.lastOrderDate ?? -Infinity;
    if (al !== bl) return bl - al;
    return b.createdAt - a.createdAt;
  });
}

/** Matches on name (case-insensitive) or phone digits. */
export function matchesCustomer(row: CustomerListRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (row.name.toLowerCase().includes(q)) return true;
  const qDigits = q.replace(/\D/g, '');
  return qDigits.length > 0 && row.phone.replace(/\D/g, '').includes(qDigits);
}

/** Digits only, country code included (wa.me format), e.g. 919876543210. */
export function whatsappDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export function whatsappHref(phone: string): string {
  return `https://wa.me/${whatsappDigits(phone)}`;
}

export function mapsHref(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/** 'Nov 2026' for "customer since". */
export function formatMonthYear(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

import type { FunctionReturnType } from 'convex/server';
import type { api } from '../../../../convex/_generated/api';

/** Shape returned by adminStats:getCustomerProfile (rupees, ms timestamps). */
export type CustomerProfile = NonNullable<FunctionReturnType<typeof api.adminStats.getCustomerProfile>>;
export type CustomerProfileOrder = CustomerProfile['orders'][number];
export type CustomerProfileAddress = CustomerProfile['addresses'][number];
