import { requiredConvexUrl } from '../../lib/env.js';
/**
 * Remote-image byte proxy for admin web-search imports.
 *
 * GET /api/images/fetch?url=<encoded> → raw image bytes
 *
 * Admin-gated (own ES256 JWT, same check as images/upload). SSRF-guarded:
 * http(s) only, no credentials in URL, literal private/loopback/link-local
 * IPs and internal-looking hostnames rejected. Content-type must be
 * image/* and body is capped at 8MB.
 *
 * The caller (browser) runs the bytes through the standard WebP pipeline
 * (crop/resize/compress) before storing to R2 — this endpoint never writes.
 */

const MAX_BYTES = 8 * 1024 * 1024;

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

async function requireAdmin(request, env) {
  if (env.UPLOAD_REQUIRE_ADMIN === 'false') return { ok: true };
  const convexUrl = requiredConvexUrl(env);
  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return { ok: false, error: 'Missing session' };
  try {
    const res = await fetch(`${convexUrl}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        path: 'adminStats:checkMyAdmin',
        args: { orgSlug: env.VITE_ORG_SLUG || 'smokeshop' },
        format: 'json',
      }),
    });
    const body = await res.json().catch(() => null);
    if (body?.status === 'success' && body.value?.ok) return { ok: true };
    return { ok: false, error: 'Admin only' };
  } catch {
    return { ok: false, error: 'Auth check failed' };
  }
}

// Image search supplies domain URLs. Reject literal IPs and local hostnames;
// every redirect is checked again below.
export function blockedTarget(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return 'Bad URL';
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'Only http(s) allowed';
  if (u.username || u.password) return 'Credentials in URL not allowed';
  const host = u.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '::1' ||
    host === '[::1]' ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal') ||
    host.endsWith('.local') ||
    host.endsWith('.invalid') ||
    !host.includes('.') ||
    /^[\d.]+$/.test(host) ||
    host.startsWith('[')
  )
    return 'Internal URL not allowed';
  return null;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return json({}, 200);
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const gate = await requireAdmin(request, env);
  if (!gate.ok) return json({ error: gate.error || 'Unauthorized' }, 401);

  const target = new URL(request.url).searchParams.get('url') || '';
  const blocked = blockedTarget(target);
  if (blocked) return json({ error: blocked }, 400);

  let upstream;
  let source = target;
  try {
    for (let i = 0; i < 4; i++) {
      upstream = await fetch(source, {
        redirect: 'manual',
        headers: { Accept: 'image/*' },
      });
      if (![301, 302, 303, 307, 308].includes(upstream.status)) break;
      const location = upstream.headers.get('location');
      if (!location) return json({ error: 'Bad redirect' }, 502);
      source = new URL(location, source).toString();
      if (blockedTarget(source)) return json({ error: 'Unsafe redirect' }, 400);
    }
  } catch {
    return json({ error: 'Fetch failed' }, 502);
  }
  if (!upstream || [301, 302, 303, 307, 308].includes(upstream.status))
    return json({ error: 'Too many redirects' }, 502);
  if (!upstream.ok) return json({ error: `Upstream ${upstream.status}` }, 502);
  const type = (upstream.headers.get('content-type') || '').split(';')[0].trim();
  if (!type.startsWith('image/')) return json({ error: 'Not an image' }, 400);
  const declared = Number(upstream.headers.get('content-length') || 0);
  if (declared > MAX_BYTES) return json({ error: 'Image over 8MB' }, 400);

  if (!upstream.body) return json({ error: 'Empty image' }, 400);
  const chunks = [];
  const reader = upstream.body.getReader();
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BYTES) {
      await reader.cancel();
      return json({ error: 'Image over 8MB' }, 400);
    }
    chunks.push(value);
  }
  if (!size) return json({ error: 'Empty image' }, 400);
  const buf = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    buf.set(chunk, offset);
    offset += chunk.length;
  }

  return new Response(buf, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'private, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
