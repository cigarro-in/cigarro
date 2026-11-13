// Own-JWT session: our ES256 token (30d, OTP-renewed).
// Storage is local only — never committed.

import { ORG_SLUG } from '../convex/org';
import { LEGACY_ORG_SLUG } from '../org/legacyOrg';

// One session per store. The pre-namespacing key is migrated once, and only
// into the legacy store: that was the only store the old key ever held a
// session for. Its per-store key was also under the pre-rename slug
// (`smokeshop`), so that key is moved to the current one too.
const LEGACY_KEY = 'cigarro.session.v1';
const PRE_RENAME_KEY = 'cigarro.session.v1:smokeshop';
const KEY = `cigarro.session.v1:${ORG_SLUG}`;

function migrateLegacyKey() {
  try {
    if (ORG_SLUG !== LEGACY_ORG_SLUG) return;
    const preRename = localStorage.getItem(PRE_RENAME_KEY);
    if (preRename !== null) {
      if (localStorage.getItem(KEY) === null) localStorage.setItem(KEY, preRename);
      localStorage.removeItem(PRE_RENAME_KEY);
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === null) return;
    if (localStorage.getItem(KEY) === null) localStorage.setItem(KEY, legacy);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Storage blocked: the user simply signs in again.
  }
}
migrateLegacyKey();

interface StoredSession {
  token: string;
  userId: string;
  phone: string;
  exp: number; // ms
}

function read(): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredSession;
    if (!s.token || !s.exp) return null;
    return s;
  } catch {
    return null;
  }
}

function decodeExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function getSession() {
  const s = read();
  if (!s) return null;
  const exp = decodeExp(s.token) ?? s.exp;
  if (exp <= Date.now()) {
    clearSession();
    return null;
  }
  return s;
}

export function getAccessToken(): string | null {
  return getSession()?.token ?? null;
}

export function storeSession(token: string, userId: string, phone: string) {
  const exp = decodeExp(token) ?? Date.now() + 30 * 24 * 60 * 60 * 1000;
  const s: StoredSession = { token, userId, phone, exp };
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Private mode — session lasts this tab via memory only.
  }
  return s;
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

// Admin host (admin.<root>): one session per store, addressed by slug rather
// than by the build-time store, so a store switch can write the target's key.
const SESSION_PREFIX = 'cigarro.session.v1:';

export function storeSessionForStore(slug: string, token: string, userId: string, phone: string) {
  const exp = decodeExp(token) ?? Date.now() + 30 * 24 * 60 * 60 * 1000;
  const s: StoredSession = { token, userId, phone, exp };
  try {
    localStorage.setItem(`${SESSION_PREFIX}${slug}`, JSON.stringify(s));
  } catch {
    // Private mode: the switch still navigates; the target store will ask again.
  }
  return s;
}

// Slugs of stores that still hold an unexpired session on this origin.
export function listStoredSessionSlugs(): string[] {
  try {
    const slugs: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(SESSION_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const s = JSON.parse(raw) as StoredSession;
      if (!s.token || !s.exp) continue;
      const exp = decodeExp(s.token) ?? s.exp;
      if (exp > Date.now()) slugs.push(key.slice(SESSION_PREFIX.length));
    }
    return slugs;
  } catch {
    return [];
  }
}

// Sign out of every store on this origin.
export function clearAllSessions() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(SESSION_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

// Same-tab writes don't fire `storage` events (cross-tab only), so tell the
// Convex auth bridge to re-fetch the token after store/clear.
export function notifyAuthChanged() {
  try {
    window.dispatchEvent(new Event('cigarro:auth-changed'));
  } catch {
    // non-browser (SSR/edge) — no listeners to notify.
  }
}
