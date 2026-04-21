/**
 * Phone OTP verification endpoint (MSG91 → Supabase session bridge)
 *
 * Flow:
 *   1. Client verifies OTP via MSG91 widget, gets `access-token` JWT
 *   2. Client POSTs { phone, token, name? } to this endpoint
 *   3. Server verifies the token with MSG91's verifyAccessToken API
 *   4. Server finds/creates Supabase auth user keyed by phone, ensures a
 *      synthetic email is attached (<phone>@phone.cigarro.in)
 *   5. Server calls admin.generateLink({ type: 'magiclink', email }) to
 *      produce a verification token signed by Supabase's own asymmetric keys
 *   6. Response includes { email, token_hash, user_id }
 *   7. Client calls supabase.auth.verifyOtp({ email, token_hash, type: 'email' })
 *      — Supabase then issues a real ES256 session recognised by Convex.
 *
 * Env vars required:
 *   - MSG91_AUTH_KEY            (server-only, MSG91 dashboard → Auth key)
 *   - SUPABASE_URL              (same value as VITE_SUPABASE_URL)
 *   - SUPABASE_SERVICE_ROLE_KEY (server-only)
 */

import { createClient } from '@supabase/supabase-js';

const SYNTHETIC_EMAIL_DOMAIN = 'phone.cigarro.in';

function normalizePhone(phone, countryCode) {
  let p = String(phone || '').replace(/[^\d]/g, '');
  if (p.length === 10) p = `${countryCode || '91'}${p}`;
  return `+${p}`;
}

function syntheticEmail(normalizedPhone) {
  return `${normalizedPhone.replace('+', '')}@${SYNTHETIC_EMAIL_DOMAIN}`;
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
    const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!msg91AuthKey || !supabaseUrl || !serviceKey) {
      const missing = [
        !msg91AuthKey && 'MSG91_AUTH_KEY',
        !supabaseUrl && 'SUPABASE_URL',
        !serviceKey && 'SUPABASE_SERVICE_ROLE_KEY',
      ].filter(Boolean).join(', ');
      return jsonResponse({ error: `Server auth not configured. Missing: ${missing}` }, 500, corsHeaders);
    }

    // 1. Verify OTP token with MSG91
    await verifyMsg91Token(token, msg91AuthKey);

    const normalizedPhone = normalizePhone(phone, countryCode);
    const userEmail = syntheticEmail(normalizedPhone);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 2. Find or create the auth user for this phone.
    let userId = null;
    let isNewUser = false;

    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (existingProfile?.id) {
      userId = existingProfile.id;
    } else {
      // Create with phone + synthetic email so generateLink works.
      const phoneDigits = normalizedPhone.replace('+', '');
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        phone: phoneDigits,
        email: userEmail,
        phone_confirm: true,
        email_confirm: true,
        user_metadata: { name: name || null, provider: 'phone-otp' },
      });
      if (createErr) {
        // Race: concurrent request may have created the user. Re-lookup.
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

    // 3. Ensure the user has our synthetic email set (existing users may not).
    //    generateLink(type: magiclink) requires the target user to have an email.
    const { data: userData } = await admin.auth.admin.getUserById(userId);
    if (userData?.user && userData.user.email !== userEmail) {
      await admin.auth.admin.updateUserById(userId, {
        email: userEmail,
        email_confirm: true,
        ...(name ? { user_metadata: { ...userData.user.user_metadata, name } } : {}),
      });
    } else if (name) {
      await admin.auth.admin.updateUserById(userId, {
        user_metadata: { ...(userData?.user?.user_metadata ?? {}), name },
      });
    }

    // 4. Upsert the profiles row
    const profilePayload = {
      id: userId,
      phone: normalizedPhone,
      phone_verified_at: new Date().toISOString(),
    };
    if (name) profilePayload.name = name;
    if (isNewUser && !name) profilePayload.name = 'Customer';
    await admin.from('profiles').upsert(profilePayload, { onConflict: 'id' });

    // 5. Generate a magiclink. Supabase signs with its own asymmetric key
    //    and returns a token_hash the client can exchange for a real session.
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
    });
    if (linkErr) throw linkErr;

    const tokenHash = linkData?.properties?.hashed_token;
    if (!tokenHash) {
      throw new Error('Supabase did not return a token_hash');
    }

    return jsonResponse(
      {
        email: userEmail,
        token_hash: tokenHash,
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
