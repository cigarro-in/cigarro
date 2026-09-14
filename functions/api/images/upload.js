/**
 * R2 image library API (bucket `cigarro-assets`, binding `R2_ASSETS`).
 *
 * - GET  /api/images/upload?prefix=asset_images/  → { images: [{name,key,url,size,uploaded}], folders: [..] }
 * - POST /api/images/upload (multipart: file, folder?) → { url, key, alt, size }
 * - DELETE /api/images/upload?key=asset_images/... → { success: true }
 *
 * Admin-gated: Authorization Bearer <Supabase session JWT>, verified against
 * Convex memberships (same check as invalidate-cache). Files are expected
 * pre-converted to WebP by the client (canvas redraw strips EXIF/GPS and
 * applies lightweight compression); the server validates type + size.
 * Public reads stay on https://cdn.cigarro.in (no auth).
 */

const CDN_BASE = (env) =>
  (env.CDN_BASE_URL || 'https://cdn.cigarro.in').replace(/\/$/, '');
const LIB_PREFIX = 'asset_images/';
const MAX_BYTES = 10 * 1024 * 1024;

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

async function requireAdmin(request, env) {
  if (env.UPLOAD_REQUIRE_ADMIN === 'false') return { ok: true };
  if (!env.R2_ASSETS) return { ok: false, error: 'R2 binding R2_ASSETS missing' };
  const convexUrl =
    env.VITE_CONVEX_URL || 'https://proper-coyote-383.convex.cloud';
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

function cleanFolder(folder) {
  return String(folder || '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\.\./g, '')
    .slice(0, 100);
}

// "Camel Yellow Packet!" → "camel-yellow-packet" (SEO-friendly R2 keys).
function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 60)
    .replace(/-+$/, '');
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return json({}, 200);

  const gate = await requireAdmin(request, env);
  if (!gate.ok) return json({ error: gate.error || 'Unauthorized' }, 401);
  const bucket = env.R2_ASSETS;
  const cdn = CDN_BASE(env);
  const url = new URL(request.url);

  // ---- List (library browser) ----
  if (request.method === 'GET') {
    const prefix = String(url.searchParams.get('prefix') || LIB_PREFIX);
    if (!prefix.startsWith(LIB_PREFIX)) return json({ error: 'Bad prefix' }, 400);
    const listed = await bucket.list({ prefix, limit: 500 });
    const images = [];
    const folderSet = new Set();
    for (const obj of listed.objects || []) {
      const rest = obj.key.slice(prefix.length);
      if (!rest) continue;
      if (rest.includes('/')) {
        folderSet.add(rest.split('/')[0]);
        continue;
      }
      if (!/\.(webp|jpg|jpeg|png|gif|avif)$/i.test(obj.key)) continue;
      images.push({
        id: obj.key,
        name: obj.key.split('/').pop(),
        path: obj.key,
        url: `${cdn}/${obj.key}`,
        size: obj.size || 0,
        contentType: obj.httpMetadata?.contentType || 'image/webp',
        createdAt: obj.uploaded ? new Date(obj.uploaded).toISOString() : new Date().toISOString(),
      });
    }
    images.sort((a, b) => (b.createdAt < a.createdAt ? -1 : 1));
    return json({ images, folders: [...folderSet].map((name) => ({ name, path: `${prefix}${name}/` })) });
  }

  // ---- Upload ----
  if (request.method === 'POST') {
    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    const folder = cleanFolder(form?.get('folder'));
    // raw=true stores non-image assets (video/pdf/zip) untouched under their
    // original extension. Images are expected pre-converted to WebP.
    const raw = String(form?.get('raw') || '') === 'true';
    if (!file || typeof file.arrayBuffer !== 'function')
      return json({ error: 'file (multipart) is required' }, 400);
    const mime = String(file.type || 'application/octet-stream');
    if (!raw && !mime.startsWith('image/'))
      return json({ error: 'Only image uploads allowed (or raw=true)' }, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_BYTES)
      return json({ error: 'File empty or over 10MB' }, 400);
    const ext = raw
      ? (String(file.name || 'bin').split('.').pop() || 'bin').toLowerCase().slice(0, 10)
      : 'webp';
    const rand = Math.random().toString(36).substring(2, 8);
    // SEO filename: item slug when the caller knows it, random suffix keeps
    // keys unique (`camel-yellow-packet-a1b2c3.webp`).
    const stem = slugify(form?.get('slug')) || `${Date.now()}`;
    const key = `${LIB_PREFIX}${folder ? folder + '/' : ''}${stem}-${rand}.${ext}`;
    await bucket.put(key, bytes, {
      httpMetadata: {
        contentType: raw ? mime : 'image/webp',
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });
    return json({ url: `${cdn}/${key}`, key, size: bytes.length });
  }

  // ---- Delete ----
  if (request.method === 'DELETE') {
    const key = String(url.searchParams.get('key') || '');
    if (!key.startsWith(LIB_PREFIX)) return json({ error: 'Bad key' }, 400);
    await bucket.delete(key);
    return json({ success: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
