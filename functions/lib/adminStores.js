// Store list for one phone, from Convex (users rows joined to owner/admin
// memberships). Server-to-server only, guarded by EDGE_SHARED_SECRET. Never
// cached: a removed admin must lose access on the next login or switch.
import { requiredConvexUrl } from './env.js';

export function convexSiteUrl(env) {
  return (env.CONVEX_SITE_URL || requiredConvexUrl(env)).replace('.convex.cloud', '.convex.site');
}

// [{ slug, name, userId, role }] for an E.164 phone. Throws on any failure.
export async function fetchAdminStores(env, phone) {
  if (!env.EDGE_SHARED_SECRET) throw new Error('EDGE_SHARED_SECRET not configured');
  const res = await fetch(`${convexSiteUrl(env)}/adminStores`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.EDGE_SHARED_SECRET}`,
    },
    body: JSON.stringify({ phone }),
    signal: AbortSignal.timeout(6000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok || !Array.isArray(body.stores)) {
    throw new Error('Admin store lookup failed');
  }
  return body.stores;
}
