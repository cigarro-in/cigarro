// Own ES256 JWT issuer, shared by phone-verify (storefront + admin) and the
// admin store endpoints. iss/aud must match convex/auth.config.ts.
//
// Tokens minted on the admin host carry ctx = "admin". Only those are accepted
// by /api/auth/switch-store, so a storefront token can never switch stores.

export const OWN_ISSUER = 'https://cigarro.in/auth';
export const OWN_AUDIENCE = 'cigarro-storefront';
export const OWN_TTL_S = 30 * 24 * 60 * 60; // 30 days; re-login is one OTP tap.
export const ADMIN_CTX = 'admin';

function b64url(bytes) {
  let s = '';
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlJson(obj) {
  return b64url(new TextEncoder().encode(JSON.stringify(obj)));
}

function b64urlToBytes(str) {
  const pad = (4 - (str.length % 4)) % 4;
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// { token } signed for the given identity, or null when JWT_PRIVATE_JWK is
// not configured or signing fails. `admin` stamps ctx = "admin".
export async function mintOwnJwt(env, { userId, phone, orgSlug, admin = false }) {
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
      // Store the token was minted for. Convex rejects it on any other store.
      org: orgSlug,
      ...(admin ? { ctx: ADMIN_CTX } : {}),
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
    console.error('[jwt] own-JWT mint failed:', err?.message);
    return null;
  }
}

// Payload of a token this host minted on the admin host, or null. Checks the
// signature against JWT_PUBLIC_JWK, issuer, audience, expiry, the admin ctx
// claim and the presence of sub and phone.
export async function verifyAdminJwt(env, token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const [head, body, sig] = parts;
    const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(head)));
    if (header.alg !== 'ES256') return null;
    const pub = JSON.parse(env.JWT_PUBLIC_JWK || 'null');
    if (!pub || !pub.x || !pub.y) return null;
    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: 'EC', crv: 'P-256', x: pub.x, y: pub.y, ext: true },
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      b64urlToBytes(sig),
      new TextEncoder().encode(`${head}.${body}`),
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(body)));
    const now = Math.floor(Date.now() / 1000);
    if (payload.iss !== OWN_ISSUER || payload.aud !== OWN_AUDIENCE) return null;
    if (typeof payload.exp !== 'number' || payload.exp <= now) return null;
    if (payload.ctx !== ADMIN_CTX) return null;
    if (typeof payload.sub !== 'string' || typeof payload.phone !== 'string') return null;
    return payload;
  } catch {
    return null;
  }
}
