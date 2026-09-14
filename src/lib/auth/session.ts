// Auth Phase 2 session: our own JWT (30d, OTP-renewed), Supabase fallback
// during the dual-issuer soak. Storage is local only — never committed.

const KEY = 'cigarro.session.v1';

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

// Same-tab writes don't fire `storage` events (cross-tab only), so tell the
// Convex auth bridge to re-fetch the token after store/clear.
export function notifyAuthChanged() {
  try {
    window.dispatchEvent(new Event('cigarro:auth-changed'));
  } catch {
    // non-browser (SSR/edge) — no listeners to notify.
  }
}
