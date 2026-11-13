// Admin-host session helpers: store switch without OTP, and sign-out of every
// store. Tokens are per store (see session.ts); the switch endpoint mints the
// target store's token from the current admin token.

import {
  clearAllSessions,
  getSession,
  notifyAuthChanged,
  storeSessionForStore,
} from '../../lib/auth/session';

export class AdminAuthError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'AdminAuthError';
    this.code = code;
  }
}

// Switches the admin session to another store the same phone administers.
// Resolves only after the target session is stored; then navigates there.
export async function switchAdminStore(targetSlug: string): Promise<void> {
  const current = getSession();
  if (!current) throw new AdminAuthError('Sign in again to switch stores.', 'SESSION_EXPIRED');

  let res: Response;
  try {
    res = await fetch('/api/auth/switch-store', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${current.token}`,
      },
      body: JSON.stringify({ targetSlug }),
    });
  } catch {
    throw new AdminAuthError('Network error. Check your connection and try again.', 'NETWORK');
  }

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.cigarro_token || !data?.user_id) {
    throw new AdminAuthError(
      data?.error || 'Could not switch store.',
      data?.code || `HTTP_${res.status}`,
    );
  }

  storeSessionForStore(targetSlug, data.cigarro_token, data.user_id, current.phone);
  window.location.assign(`/${targetSlug}/`);
}

// Clears every store session on this origin and returns to the admin root.
export function signOutOfAdmin(): void {
  clearAllSessions();
  notifyAuthChanged();
  window.location.assign('/');
}

// "+91 •••••• 3210": country code and last four digits only.
export function maskPhone(phone: string | null | undefined): string {
  const digits = (phone || '').replace(/[^\d+]/g, '');
  if (digits.length < 6) return phone || '';
  const last4 = digits.slice(-4);
  const cc = digits.startsWith('+') && digits.length > 11 ? digits.slice(0, digits.length - 10) : '';
  return `${cc ? `${cc} ` : ''}•••••• ${last4}`;
}
