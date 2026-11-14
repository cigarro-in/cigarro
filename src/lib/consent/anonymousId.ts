import { readStoredPreference, writeStoredPreference } from '../browserStorage';

// Random id for a visitor who has not signed in. Kept in localStorage and a
// first-party cookie (one year). Sent with age-gate consent so the rows can be
// linked to the customer after sign-in. Never throws.
const KEY = 'cg_anon_id';
const ID_RE = /^[A-Za-z0-9_-]{16,80}$/;
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function newId(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function readCookie(): string | null {
  try {
    const match = /(?:^|;\s*)cg_anon_id=([^;]+)/.exec(document.cookie);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export function getAnonymousId(): string | null {
  try {
    let id = readStoredPreference(KEY) ?? readCookie();
    if (!id || !ID_RE.test(id)) id = newId();
    writeStoredPreference(KEY, id);
    try {
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `${KEY}=${id}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax${secure}`;
    } catch {
      // Cookies blocked: localStorage still holds the id.
    }
    return id;
  } catch {
    return null;
  }
}
