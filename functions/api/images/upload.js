import { requiredConvexUrl } from '../../lib/env.js';
/**
 * R2 image library API (bucket `cigarro-assets`, binding `R2_ASSETS`).
 *
 * - GET  /api/images/upload?prefix=asset_images/  → { images: [{name,key,url,size,uploaded}], folders: [..] }
 * - POST /api/images/upload (multipart: file, folder?) → { url, key, size }
 * - DELETE /api/images/upload?key=asset_images/... → { success: true }
 *
 * Admin-gated: Authorization Bearer <own ES256 JWT (cigarro_token)>, verified against
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

function cleanFolder(folder) {
  return String(folder || '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\.\./g, '')
    .slice(0, 100);
}

function decodeListCursor(cursor) {
  if (!cursor) return {};
  try { return JSON.parse(atob(cursor)); } catch { return { tenant: cursor }; }
}

function encodeListCursor(tenant, legacy) {
  return btoa(JSON.stringify({ tenant: tenant || null, legacy: legacy || null }));
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
  const orgSlug = String(env.VITE_ORG_SLUG || 'smokeshop');
  if (!/^[a-z0-9-]{1,50}$/.test(orgSlug)) return json({ error: 'Invalid org configuration' }, 500);
  const tenantPrefix = `${LIB_PREFIX}orgs/${orgSlug}/`;

  // ---- List (library browser; cursor-paginated for bulk walks) ----
  if (request.method === 'GET') {
    const requestedPrefix = String(url.searchParams.get('prefix') || LIB_PREFIX);
    if (!requestedPrefix.startsWith(LIB_PREFIX)) return json({ error: 'Bad prefix' }, 400);
    const explicitTenantPrefix = `${tenantPrefix}`;
    const explicitTenant = requestedPrefix.startsWith(explicitTenantPrefix);
    if (explicitTenant && requestedPrefix.slice(explicitTenantPrefix.length).split('/').some((part) => part === 'orgs' || part === orgSlug))
      return json({ error: 'Bad prefix' }, 400);
    const relativePrefix = cleanFolder(requestedPrefix.slice(explicitTenant ? explicitTenantPrefix.length : LIB_PREFIX.length));
    if (!explicitTenant && relativePrefix.split('/').some((part) => part === 'orgs'))
      return json({ error: 'Bad prefix' }, 400);
    const prefix = `${explicitTenantPrefix}${relativePrefix ? relativePrefix + '/' : ''}`;
    const cursorState = decodeListCursor(url.searchParams.get('cursor'));
    const [tenant, legacy] = await Promise.all([
      bucket.list({ prefix, limit: 500, cursor: cursorState.tenant || undefined }),
      orgSlug === 'smokeshop' && !explicitTenant
        ? bucket.list({ prefix: `${LIB_PREFIX}${relativePrefix ? relativePrefix + '/' : ''}`, limit: 500, cursor: cursorState.legacy || undefined })
        : Promise.resolve(null),
    ]);
    const images = [];
    const folderMap = new Map();
    for (const [listed, sourcePrefix, isLegacy] of [
      [tenant, prefix, false],
      [legacy, `${LIB_PREFIX}${relativePrefix ? relativePrefix + '/' : ''}`, true],
    ]) {
      for (const obj of listed?.objects || []) {
        if (isLegacy && obj.key.startsWith(`${LIB_PREFIX}orgs/`)) continue;
        const rest = obj.key.slice(sourcePrefix.length);
        if (!rest) continue;
        if (rest.includes('/')) {
          const folder = rest.split('/')[0];
          if (folder !== 'orgs') folderMap.set(`${sourcePrefix}${folder}/`, { name: folder, path: `${sourcePrefix}${folder}/` });
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
          metadata: obj.customMetadata || {},
        });
      }
    }
    images.sort((a, b) => (b.createdAt < a.createdAt ? -1 : 1));
    const out = { images, folders: [...folderMap.values()] };
    if (tenant.truncated || legacy?.truncated)
      out.cursor = encodeListCursor(tenant.truncated ? tenant.cursor : null, legacy?.truncated ? legacy.cursor : null);
    return json(out);
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
    if (raw && mime.startsWith('image/'))
      return json({ error: 'Images must use the WebP upload flow' }, 400);
    if (!raw && mime !== 'image/webp')
      return json({ error: 'Converted WebP image required' }, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_BYTES)
      return json({ error: 'File empty or over 10MB' }, 400);
    if (!raw && !(bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'))
      return json({ error: 'Invalid WebP image' }, 400);
    const ext = raw
      ? (String(file.name || 'bin').split('.').pop() || 'bin').toLowerCase().slice(0, 10)
      : 'webp';
    if (raw && /^(webp|jpe?g|png|gif|avif|svg)$/.test(ext))
      return json({ error: 'Images must use the WebP upload flow' }, 400);
    // SEO filename: item slug when the caller knows it, numeric suffix on
    // collision (`slug.webp`, `slug-2.webp`, …). Conditional put keeps this
    // race-safe: onlyIf etagDoesNotMatch '*' never overwrites, retry next.
    const sourceName = String(form?.get('slug') || (raw ? file.name : '') || '').replace(/\.[^.]+$/, '');
    const stem = slugify(sourceName) || `${Date.now()}`;
    const base = `${tenantPrefix}${folder ? folder + '/' : ''}${stem}`;
    const pipelineSource = String(form?.get('pipelineSource') || '');
    if (pipelineSource && !/^[a-f0-9]{24}$/.test(pipelineSource))
      return json({ error: 'Invalid pipeline marker' }, 400);
    const customMetadata = {};
    if (form?.get('alt')) customMetadata.alt = String(form.get('alt')).slice(0, 300);
    if (pipelineSource) customMetadata.pipelineSource = pipelineSource;
    const meta = {
      httpMetadata: {
        contentType: raw ? mime : 'image/webp',
        cacheControl: 'public, max-age=31536000, immutable',
      },
      // Create-only: R2 returns null when the key already exists.
      onlyIf: { etagDoesNotMatch: '*' },
      ...(Object.keys(customMetadata).length ? { customMetadata } : {}),
    };
    let key = null;
    for (let n = 1; n <= 100; n++) {
      const candidate = n === 1 ? `${base}.${ext}` : `${base}-${n}.${ext}`;
      const stored = await bucket.put(candidate, bytes, meta);
      if (stored !== null) {
        key = candidate;
        break;
      }
    }
    if (!key) return json({ error: 'Name collision; retry upload' }, 409);
    return json({ url: `${cdn}/${key}`, key, size: bytes.length });
  }

  // ---- Delete ----
  if (request.method === 'DELETE') {
    const key = String(url.searchParams.get('key') || '');
    const isTenantKey = key.startsWith(tenantPrefix);
    const isLegacyShopKey = orgSlug === 'smokeshop' && key.startsWith(LIB_PREFIX) && !key.startsWith(`${LIB_PREFIX}orgs/`);
    if (!isTenantKey && !isLegacyShopKey) return json({ error: 'Bad key' }, 400);
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer /, '');
    let usage;
    try {
      const check = await fetch(`${requiredConvexUrl(env)}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ path: 'adminCatalog:imageUsage', args: { orgSlug, key, url: `${cdn}/${key}` }, format: 'json' }),
      });
      const body = await check.json();
      if (!check.ok || body?.status !== 'success' || typeof body.value?.total !== 'number')
        return json({ error: 'Usage check unavailable; delete blocked' }, 503);
      usage = body.value.total;
    } catch {
      return json({ error: 'Usage check unavailable; delete blocked' }, 503);
    }
    if (usage !== 0) return json({ error: 'Asset is in use; delete blocked', usage }, 409);
    await bucket.delete(key);
    return json({ success: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
