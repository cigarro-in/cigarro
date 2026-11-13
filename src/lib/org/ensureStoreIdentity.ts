// Store identity gate for the client entry (src/main.tsx). It runs before any
// module that reads the org is evaluated.
//
// The edge injects window.__ORG__ into every storefront document, and that is
// the only source the client trusts. Each time it is present it is saved to this
// origin's localStorage. If __ORG__ is missing and the hostname lookup fails
// (offline or Convex down), the saved copy is used. It belongs to this origin, so
// it is always this site's store. The store is never defaulted to another one.
// Only localhost keeps the dev fallback in OrgContext.

const LOOKUP_TIMEOUT_MS = 5000;
const IDENTITY_KEY = 'org:identity';

type Identity = NonNullable<Window['__ORG__']>;

export function isLocalDevHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.localhost')
  );
}

function readSavedIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Identity>;
    if (typeof v.slug !== 'string' || !v.slug) return null;
    return {
      slug: v.slug,
      id: typeof v.id === 'string' ? v.id : null,
      name: typeof v.name === 'string' ? v.name : '',
      primaryHost: typeof v.primaryHost === 'string' ? v.primaryHost : window.location.host,
    };
  } catch {
    return null;
  }
}

function saveIdentity(identity: Identity): void {
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    // Storage blocked: the next offline start has nothing to fall back to.
  }
}

/** Resolves true when window.__ORG__ is set for this page, or no store is needed. */
export async function ensureStoreIdentity(): Promise<boolean> {
  const { hostname, pathname, search } = window.location;
  const isAdmin = hostname.split('.')[0] === 'admin';
  const isLocal = isLocalDevHost(hostname);

  if (window.__ORG__) {
    // Admin and localhost identities are not this origin's storefront store.
    if (!isAdmin && !isLocal) saveIdentity(window.__ORG__);
    return true;
  }

  // Localhost uses the dev fallback. The admin host (store from the path, or the
  // /sa super-admin app) never needs a hostname-derived storefront store.
  if (isLocal || isAdmin) return true;

  const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
  let row: { slug?: string; orgId?: string | null; name?: string; primaryHost?: string; redirectTo?: string | null } | null | undefined;
  try {
    if (!convexUrl) throw new Error('no convex url');
    const res = await fetch(`${convexUrl}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: 'domains:resolveByHost',
        args: { hostname },
        format: 'json',
      }),
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });
    const body = await res.json();
    if (body?.status !== 'success') throw new Error('lookup failed');
    row = body.value;
  } catch {
    // Network lookup failed: fall back to this origin's saved identity.
    row = undefined;
  }

  if (row === undefined) {
    const saved = readSavedIdentity();
    if (!saved) return false;
    window.__ORG__ = saved;
    return true;
  }
  // Lookup succeeded: the host is unknown when the value is null.
  if (!row) return false;

  if (row.redirectTo) {
    window.location.replace(`https://${row.redirectTo}${pathname}${search}`);
    return false;
  }
  if (!row.slug) return false;

  const identity: Identity = {
    slug: row.slug,
    id: row.orgId ?? null,
    name: row.name ?? '',
    primaryHost: row.primaryHost || window.location.host,
  };
  window.__ORG__ = identity;
  saveIdentity(identity);
  return true;
}
