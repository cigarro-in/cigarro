/**
 * Phone OTP verification endpoint (MSG91 → Supabase session bridge)
 *
 * Flow:
 *   1. Client verifies OTP via MSG91 widget, gets `access-token` JWT
 *   2. Client POSTs { phone, token, name? } to this endpoint
 *   3. Server verifies the token with MSG91's verifyAccessToken API
 *   4. Server finds/creates Supabase auth user keyed by phone
 *   5. Server upserts the profiles row (name, phone, phone_verified_at)
 *   6. Server mints a Supabase-compatible HS256 JWT signed with SUPABASE_JWT_SECRET
 *   7. Client calls supabase.auth.setSession({ access_token, refresh_token })
 *
 * Env vars required:
 *   - MSG91_AUTH_KEY            (server-only, MSG91 dashboard → Auth key)
 *   - SUPABASE_URL              (same value as VITE_SUPABASE_URL)
 *   - SUPABASE_SERVICE_ROLE_KEY (server-only)
 *   - SUPABASE_JWT_SECRET       (Supabase dashboard → Settings → API → JWT Secret)
 */

import { createClient } from '@supabase/supabase-js';

const JWT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function b64url(input) {
  let s;
  if (typeof input === 'string') {
    s = btoa(input);
  } else {
    let str = '';
    for (const byte of input) str += String.fromCharCode(byte);
    s = btoa(str);
  }
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerPart = b64url(JSON.stringify(header));
  const payloadPart = b64url(JSON.stringify(payload));
  const signingInput = `${headerPart}.${payloadPart}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput))
  );
  return `${signingInput}.${b64url(sig)}`;
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
  if (data.type !== 'success') {
    throw new Error(data.message || 'Phone verification failed');
  }
  return data;
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
      return new Response(JSON.stringify({ error: 'phone and token are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const msg91AuthKey = env.MSG91_AUTH_KEY;
    const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const jwtSecret = env.SUPABASE_JWT_SECRET;

    if (!msg91AuthKey || !supabaseUrl || !serviceKey || !jwtSecret) {
      const missing = [
        !msg91AuthKey && 'MSG91_AUTH_KEY',
        !supabaseUrl && 'SUPABASE_URL',
        !serviceKey && 'SUPABASE_SERVICE_ROLE_KEY',
        !jwtSecret && 'SUPABASE_JWT_SECRET',
      ].filter(Boolean).join(', ');
      return new Response(JSON.stringify({ error: `Server auth not configured. Missing: ${missing}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 1. Verify OTP token with MSG91
    await verifyMsg91Token(token, msg91AuthKey);

    const normalizedPhone = normalizePhone(phone, countryCode);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 2. Find or create the auth user for this phone.
    // Fast path: look up our own profiles table (has a unique index on phone).
    // Falls back to admin.createUser if no profile exists.
    let userId = null;
    let isNewUser = false;

    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (existingProfile?.id) {
      userId = existingProfile.id;
      if (name) {
        await admin.auth.admin.updateUserById(userId, {
          user_metadata: { name },
        });
      }
    } else {
      const phoneDigits = normalizedPhone.replace('+', '');
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        phone: phoneDigits,
        phone_confirm: true,
        user_metadata: { name: name || null, provider: 'phone-otp' },
      });
      if (createErr) {
        // Race: user may have been created by a concurrent request. Look them up.
        const { data: retry } = await admin
          .from('profiles')
          .select('id')
          .eq('phone', normalizedPhone)
          .maybeSingle();
        if (retry?.id) {
          userId = retry.id;
        } else {
          throw createErr;
        }
      } else {
        userId = created.user.id;
        isNewUser = true;
      }
    }

    // 3. Upsert the profiles row
    const profilePayload = {
      id: userId,
      phone: normalizedPhone,
      phone_verified_at: new Date().toISOString(),
    };
    if (name) profilePayload.name = name;
    if (isNewUser && !name) profilePayload.name = 'Customer';

    await admin.from('profiles').upsert(profilePayload, { onConflict: 'id' });

    // 4. Mint Supabase-compatible JWT
    const now = Math.floor(Date.now() / 1000);
    const accessToken = await signJWT(
      {
        aud: 'authenticated',
        iss: `${supabaseUrl}/auth/v1`,
        sub: userId,
        phone: normalizedPhone.replace('+', ''),
        role: 'authenticated',
        aal: 'aal1',
        iat: now,
        exp: now + JWT_TTL_SECONDS,
        amr: [{ method: 'otp', timestamp: now }],
        session_id: crypto.randomUUID(),
        app_metadata: { provider: 'phone', providers: ['phone'] },
        user_metadata: { name: name || null },
      },
      jwtSecret
    );

    return new Response(
      JSON.stringify({
        access_token: accessToken,
        refresh_token: accessToken, // no refresh flow; re-auth on expiry
        expires_in: JWT_TTL_SECONDS,
        token_type: 'bearer',
        user_id: userId,
        is_new_user: isNewUser,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (err) {
    console.error('[phone-verify]', err);
    return new Response(
      JSON.stringify({
        error: err?.message || 'Verification failed',
        detail: err?.stack?.split('\n')?.[0] || null,
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}
