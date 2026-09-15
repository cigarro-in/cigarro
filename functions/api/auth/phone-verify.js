/**
 * Phone OTP verification endpoint (MSG91 → own ES256 JWT).
 *
 * Flow:
 *   1. Client verifies OTP via MSG91 widget, gets `access-token` JWT
 *   2. Client POSTs { phone, token, name? } to this endpoint
 *   3. Server verifies the token with MSG91's verifyAccessToken API
 *   4. Server resolves phone -> stable userId via Convex
 *      (resolvePhoneIdentity HTTP action; creates the users row for new
 *      phones, legacy phones keep their existing userId — no Supabase)
 *   5. Server mints our ES256 JWT (sub = userId) and returns it.
 *   6. Client stores it and talks to Convex directly.
 *
 * Env vars required:
 *   - MSG91_AUTH_KEY            (server-only, MSG91 dashboard → Auth key)
 *   - EDGE_SHARED_SECRET        (server-only, must match Convex env)
 *   - JWT_PRIVATE_JWK           (server-only, ES256 private JWK)
 *   - VITE_CONVEX_URL           (convex.cloud URL; .site derived unless
 *     CONVEX_SITE_URL is set explicitly)
 */

// ---------- Auth: our own JWT issuer ----------
// iss/aud must match convex/auth.config.ts. sub = stable userId (legacy
// phones keep their existing id via Convex phone lookup — no Supabase).
const OWN_ISSUER = 'https://cigarro.in/auth';
const OWN_AUDIENCE = 'cigarro-storefront';
const OWN_TTL_S = 30 * 24 * 60 * 60; // 30 days; re-login is one OTP tap.

function b64url(bytes) {
  let s = '';
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlJson(obj) {
  return b64url(new TextEncoder().encode(JSON.stringify(obj)));
}

// Returns { token } or null when JWT env is not configured (legacy
// Supabase flow keeps working — the client falls back).
async function mintOwnJwt(env, userId, phone) {
  try {
    const jwk = JSON.parse(env.JWT_PRIVATE_JWK || 'null');
    if (!jwk || !jwk.d) return null;
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    );
    const now = Math.floor(Date.now() / 1000);
    const head = b64urlJson({ alg: 'ES256', typ: 'JWT', kid: jwk.kid || 'cigarro-1' });
    const body = b64urlJson({
      iss: OWN_ISSUER,
      aud: OWN_AUDIENCE,
      sub: userId,
      phone,
      iat: now,
      exp: now + OWN_TTL_S,
    });
    const sig = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      new TextEncoder().encode(`${head}.${body}`),
    );
    return `${head}.${body}.${b64url(sig)}`;
  } catch (err) {
    console.error('[phone-verify] own-JWT mint failed:', err.message);
    return null;
  }
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

    const msg91AuthKey = env.MSG91_AUTH_KEY;
    const edgeSecret = env.EDGE_SHARED_SECRET;
import { requiredConvexUrl } from '../../lib/env.js';
    const convexUrl = requiredConvexUrl(env);
    const convexSite = (env.CONVEX_SITE_URL || convexUrl).replace('.convex.cloud', '.convex.site');

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

    // 2. Resolve phone -> stable userId via Convex (no Supabase). New
    // phones get a users row with a fresh UUID; legacy phones resolve to
    // their existing userId.
    const idRes = await fetch(`${convexSite}/resolvePhoneIdentity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${edgeSecret}`,
      },
      body: JSON.stringify({ phone: normalizedPhone, name: name || undefined }),
    });
    const idBody = await idRes.json().catch(() => null);
    if (!idRes.ok || !idBody?.userId) {
      throw new Error(idBody?.error || 'Identity resolution failed');
    }
    const userId = idBody.userId;
    const isNewUser = !!idBody.isNewUser;

    // 3. Mint our JWT (required — no legacy session anymore).
    const cigarroToken = await mintOwnJwt(env, userId, normalizedPhone);
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
