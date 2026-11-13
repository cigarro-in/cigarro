// Store identity gate for the client entry (src/main.tsx). It runs before any
// module that reads the org is evaluated.
//
// The edge injects window.__ORG__ into every storefront document, and that is
// the only source the client trusts. If it is missing (a cached shell or a
// document the edge did not rewrite), the store is resolved from this
// hostname through Convex. It is never defaulted to another store. Only
// localhost keeps the dev fallback in OrgContext.

const LOOKUP_TIMEOUT_MS = 5000;

export function isLocalDevHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.localhost')
  );
}

/** Resolves true when window.__ORG__ is set for this page, or no store is needed. */
export async function ensureStoreIdentity(): Promise<boolean> {
  if (window.__ORG__) return true;

  const { hostname, pathname, search } = window.location;
  // Localhost uses the dev fallback. The admin host (store from the path, or
  // the /sa super-admin app) never needs a hostname-derived storefront store.
  if (isLocalDevHost(hostname) || hostname.split('.')[0] === 'admin') return true;

  const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
  if (!convexUrl) return false;

  try {
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
    if (body?.status !== 'success' || !body.value) return false;

    const row = body.value as {
      slug?: string;
      orgId?: string | null;
      name?: string;
      primaryHost?: string;
      redirectTo?: string | null;
    };
    if (row.redirectTo) {
      window.location.replace(`https://${row.redirectTo}${pathname}${search}`);
      return false;
    }
    if (!row.slug) return false;

    window.__ORG__ = {
      slug: row.slug,
      id: row.orgId ?? null,
      name: row.name ?? '',
      primaryHost: row.primaryHost || window.location.host,
    };
    return true;
  } catch {
    return false;
  }
}
