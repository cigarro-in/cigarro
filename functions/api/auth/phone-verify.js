import { requiredConvexUrl } from '../../lib/env.js';
import { getRequestOrg } from '../../lib/org.js';
import { mintOwnJwt } from '../../lib/jwt.js';
import { convexSiteUrl, fetchAdminStores } from '../../lib/adminStores.js';
/**
 * Phone OTP verification endpoint (MSG91 → own ES256 JWT).
 *
 * Flow:
 *   1. Client verifies OTP via MSG91 widget, gets `access-token` JWT
 *   2. Client POSTs { phone, token, name? } to this endpoint
 *   3. Server verifies the token with MSG91's verifyAccessToken API
 *   4. Server resolves phone -> stable userId via Convex, scoped to the store
 *      (resolvePhoneIdentity HTTP action; one users row per store+phone, legacy
 *      legacy-org phones keep their existing userId — no Supabase)
 *   5. Server mints our ES256 JWT (sub = userId, org = store slug) and returns it.
 *   6. Client stores it and talks to Convex directly.
 *
 * Admin host modes (admin.<root>):
 *   - With body.orgSlug (path login at admin.<root>/<store>/): as above, for that
 *     store. Token carries ctx "admin".
 *   - Without body.orgSlug (phone-only login at admin.<root>/): the phone's admin
 *     stores are looked up after OTP. None -> NO_ADMIN_ACCESS. Otherwise a token
 *     for body.store (if the phone administers it) or the first store, plus the
 *     store list. Nothing is revealed before OTP verification.
 *
 * Env vars required:
 *   - MSG91_AUTH_KEY            (server-only, MSG91 dashboard → Auth key)
 *   - EDGE_SHARED_SECRET        (server-only, must match Convex env)
 *   - JWT_PRIVATE_JWK           (server-only, ES256 private JWK)
 *   - VITE_CONVEX_URL           (convex.cloud URL; .site derived unless
 *     CONVEX_SITE_URL is set explicitly)
 */

// Store slug shape (matches organizations.slug). Anything else is rejected
// before it reaches Convex.
const ORG_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;

// Active store by slug, or null. Uses the public organizations:getBySlug query
// (returns null for unknown or inactive stores).
async function lookupOrgBySlug(env, slug) {
  const res = await fetch(`${requiredConvexUrl(env)}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'organizations:getBySlug', args: { slug }, format: 'json' }),
    signal: AbortSignal.timeout(4000),
  });
  const body = await res.json();
  if (body.status !== 'success') throw new Error('Store lookup failed');
  return body.value ?? null;
}

function normalizePhone(phone, countryCode) {
  let p = String(phone || '').replace(/[^\d]/g, '');
  if (p.length === 10) p = `${countryCode || '91'}${p}`;
  return `+${p}`;
}

async function verifyMsg91Token(token, authKey) {
  const res = await fetch('https://control.msg91.com/api/v5/widget/verifyAccessToken', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ authkey: authKey, 'access-token': token }),
  });
  const data = await res.json();
  if (data.type === 'success') return data;
  const msg = String(data.message || '').toLowerCase();
  if (msg.includes('already verified')) return data;
  throw new Error(data.message || 'Phone verification failed');
}

export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const { phone, token, name, countryCode } = body || {};

    if (!phone || !token) {
      return jsonResponse({ error: 'phone and token are required' }, 400, corsHeaders);
    }

    // The store comes from the request host. Only the admin host may name a
    // store in the body, and only one that exists.
    const requestOrg = getRequestOrg(context);
    const onAdminHost = requestOrg.admin === true;
    // Admin host with no orgSlug in the body: phone-only admin login.
    const discovery = onAdminHost && body.orgSlug === undefined;
    let pathOrgSlug = null;
    if (onAdminHost && body.orgSlug !== undefined) {
      const requested = String(body.orgSlug || '').trim().toLowerCase();
      if (!ORG_SLUG_RE.test(requested)) {
        return jsonResponse({ error: 'Invalid store' }, 400, corsHeaders);
      }
      const org = await lookupOrgBySlug(env, requested);
      if (!org) {
        return jsonResponse({ error: 'Store not found' }, 404, corsHeaders);
      }
      pathOrgSlug = org.slug;
    }

    const msg91AuthKey = env.MSG91_AUTH_KEY;
    const edgeSecret = env.EDGE_SHARED_SECRET;
    const convexUrl = requiredConvexUrl(env);
    const convexSite = convexSiteUrl(env);

    if (!msg91AuthKey || !edgeSecret) {
      const missing = [
        !msg91AuthKey && 'MSG91_AUTH_KEY',
        !edgeSecret && 'EDGE_SHARED_SECRET',
      ].filter(Boolean).join(', ');
      return jsonResponse({ error: `Server auth not configured. Missing: ${missing}` }, 500, corsHeaders);
    }

    // 1. Verify OTP token with MSG91
    await verifyMsg91Token(token, msg91AuthKey);

    const normalizedPhone = normalizePhone(phone, countryCode);

    if (discovery) {
      // 2a. Phone-only admin login: stores this phone administers (post-OTP only).
      const stores = await fetchAdminStores(env, normalizedPhone);
      if (stores.length === 0) {
        return jsonResponse(
          { error: "This number isn't an admin of any store.", code: 'NO_ADMIN_ACCESS' },
          403,
          corsHeaders,
        );
      }
      const wanted = body.store ? String(body.store).trim().toLowerCase() : null;
      const chosen = (wanted && stores.find((s) => s.slug === wanted)) || stores[0];
      const adminToken = await mintOwnJwt(env, {
        userId: chosen.userId,
        phone: normalizedPhone,
        orgSlug: chosen.slug,
        admin: true,
      });
      if (!adminToken) {
        throw new Error('Server JWT not configured (JWT_PRIVATE_JWK)');
      }
      return jsonResponse(
        {
          cigarro_token: adminToken,
          user_id: chosen.userId,
          is_new_user: false,
          phone: normalizedPhone,
          store: chosen.slug,
          stores: stores.map((s) => ({ slug: s.slug, name: s.name, logoUrl: null })),
        },
        200,
        corsHeaders,
      );
    }

    const orgSlug = pathOrgSlug || requestOrg.slug;

    // 2. Resolve phone -> stable userId via Convex (no Supabase). New
    // phones get a users row with a fresh UUID; legacy phones resolve to
    // their existing userId.
    const idRes = await fetch(`${convexSite}/resolvePhoneIdentity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${edgeSecret}`,
      },
      body: JSON.stringify({ phone: normalizedPhone, orgSlug, name: name || undefined }),
    });
    const idBody = await idRes.json().catch(() => null);
    if (!idRes.ok || !idBody?.userId) {
      throw new Error(idBody?.error || 'Identity resolution failed');
    }
    const userId = idBody.userId;
    const isNewUser = !!idBody.isNewUser;

    // 3. Mint our JWT (required — no legacy session anymore).
    const cigarroToken = await mintOwnJwt(env, {
      userId,
      phone: normalizedPhone,
      orgSlug,
      admin: onAdminHost,
    });
    if (!cigarroToken) {
      throw new Error('Server JWT not configured (JWT_PRIVATE_JWK)');
    }

    return jsonResponse(
      {
        cigarro_token: cigarroToken,
        user_id: userId,
        is_new_user: isNewUser,
      },
      200,
      corsHeaders,
    );
  } catch (err) {
    console.error('[phone-verify]', err);
    return jsonResponse(
      {
        error: err?.message || 'Verification failed',
        detail: err?.stack?.split('\n')?.[0] || null,
      },
      400,
      corsHeaders,
    );
  }
}

function jsonResponse(payload, status, cors) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
