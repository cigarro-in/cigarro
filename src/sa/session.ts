// Super-admin session for the Citadel SSO app (/sa). The opaque token lives in
// sessionStorage (not localStorage): it dies with the tab and never persists.
// Every storage access is wrapped; a blocked storage means "signed out".
import { convexUrl } from '../lib/convex/client';

export const SA_STORAGE_KEY = 'cigarro.sa.v1';
export const CITADEL_HUB_URL = 'https://keybastion.pages.dev';
export const SA_SITE_URL = convexUrl.replace('.convex.cloud', '.convex.site');

export interface StoredSa {
  token: string;
  expiresAt: number | null;
  write: boolean;
  writeExpiresAt: number | null;
}

export interface SaMe {
  adminId: string;
  write: boolean;
  writeExpiresAt: number | null;
  expiresAt: number;
}

export function readStoredSa(): StoredSa | null {
  try {
    const raw = sessionStorage.getItem(SA_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSa;
    return typeof parsed?.token === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export function writeStoredSa(value: StoredSa): void {
  try {
    sessionStorage.setItem(SA_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage blocked: the session works until the tab reloads.
  }
}

export function clearStoredSa(): void {
  try {
    sessionStorage.removeItem(SA_STORAGE_KEY);
  } catch {
    // ignore
  }
}

// Error codes from the server and the copy shown for each (no toasts: inline).
export function saErrorMessage(e: unknown): string {
  const code = (e as { data?: { code?: string } })?.data?.code;
  switch (code) {
    case 'NOT_SIGNED_IN':
      return 'Your Citadel session ended. Open this app from Citadel again.';
    case 'WRITE_REQUIRED':
    case 'WRITE_EXPIRED':
      return 'Write access expired. Re-launch from Citadel to edit.';
    case 'SLUG_TAKEN':
      return 'That store slug is already taken.';
    case 'ALIAS_TAKEN':
      return 'That bank alias is already in use.';
    case 'INVALID_SLUG':
      return 'Slug must be 2-63 characters: lowercase letters, digits, hyphens. Reserved words are not allowed.';
    case 'INVALID_NAME':
      return 'Enter a store name (up to 80 characters).';
    case 'INVALID_PHONE':
      return 'Enter a valid Indian mobile number.';
    case 'INVALID_HOSTNAME':
      return 'Enter a valid hostname, for example shop.example.com.';
    case 'RESERVED_HOSTNAME':
      return 'That hostname is reserved by the platform.';
    case 'DUPLICATE_HOSTNAME':
      return 'That hostname is already attached to a store.';
    case 'ORG_NOT_FOUND':
      return 'Store not found. Refresh the list.';
    case 'DOMAIN_NOT_FOUND':
      return 'Domain not found. Refresh the list.';
    case 'MEMBER_NOT_FOUND':
      return 'Member not found. Refresh the list.';
    case 'LAST_OWNER':
      return 'A store must keep at least one owner.';
    default:
      return (e as Error)?.message || 'Something went wrong. Try again.';
  }
}

export async function exchangeLaunchToken(launchToken: string): Promise<StoredSa> {
  const res = await fetch(`${SA_SITE_URL}/api/sa/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: launchToken }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    token?: string;
    expiresAt?: number | null;
    write?: boolean;
    writeExpiresAt?: number | null;
    error?: string;
  };
  if (!res.ok || !body.token) {
    throw new Error(body.error || `Sign-in failed (${res.status})`);
  }
  return {
    token: body.token,
    expiresAt: body.expiresAt ?? null,
    write: !!body.write,
    writeExpiresAt: body.writeExpiresAt ?? null,
  };
}

// null means the session is missing or expired (401).
export async function fetchMe(token: string): Promise<SaMe | null> {
  const res = await fetch(`${SA_SITE_URL}/api/sa/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Session check failed (${res.status})`);
  return (await res.json()) as SaMe;
}

export async function logoutSa(token: string): Promise<void> {
  try {
    await fetch(`${SA_SITE_URL}/api/sa/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Local sign-out still proceeds.
  }
}
