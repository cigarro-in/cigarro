import { getRequestOrg } from '../../lib/org.js';
import { mintOwnJwt, verifyAdminJwt } from '../../lib/jwt.js';
import { fetchAdminStores } from '../../lib/adminStores.js';

/**
 * Admin store switch without a new OTP (admin.<root> only).
 *
 * Input: Authorization: Bearer <current admin JWT>, body { targetSlug }.
 * The current token must be an admin-host token (ctx "admin", valid signature,
 * not expired). The phone inside it must still be owner/admin of targetSlug, as
 * checked live in Convex. Returns a new token for that store's userId.
 */

const STORE_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;

function json(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
  }

  const url = new URL(request.url);
  if (getRequestOrg(context).admin !== true) {
    return json({ error: 'Not found', code: 'NOT_ADMIN_HOST' }, 404);
  }
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) {
    return json({ error: 'Forbidden', code: 'BAD_ORIGIN' }, 403);
  }

  const auth = request.headers.get('authorization') || '';
  const session = await verifyAdminJwt(env, auth.startsWith('Bearer ') ? auth.slice(7).trim() : '');
  if (!session) {
    return json({ error: 'Sign in again', code: 'SESSION_INVALID' }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Bad request', code: 'BAD_JSON' }, 400);
  }
  const targetSlug = String(body?.targetSlug ?? '').trim().toLowerCase();
  if (!STORE_SLUG_RE.test(targetSlug)) {
    return json({ error: 'Invalid store', code: 'BAD_STORE' }, 400);
  }

  let stores;
  try {
    stores = await fetchAdminStores(env, session.phone);
  } catch {
    return json({ error: 'Store lookup failed, try again', code: 'LOOKUP_FAILED' }, 503);
  }
  const match = stores.find((s) => s.slug === targetSlug);
  if (!match) {
    return json({ error: "This number isn't an admin of that store.", code: 'NOT_ADMIN_OF_STORE' }, 403);
  }

  const token = await mintOwnJwt(env, {
    userId: match.userId,
    phone: session.phone,
    orgSlug: match.slug,
    admin: true,
  });
  if (!token) {
    return json({ error: 'Server JWT not configured', code: 'JWT_NOT_CONFIGURED' }, 500);
  }
  return json({ cigarro_token: token, user_id: match.userId, store: match.slug }, 200);
}
