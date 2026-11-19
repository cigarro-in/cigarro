import { LEGACY_ORG_SLUG } from '../../lib/legacyOrg.js';
import { getRequestOrg } from '../../lib/org.js';
import { requiredConvexUrl } from '../../lib/env.js';
/**
 * R2 image library API (bucket `cigarro-assets`, binding `R2_ASSETS`).
 *
 * Key layout (see CLAUDE.md "Images"):
 *   <store-slug>/images/<stem>.<ext>      every image of a store, flat
 *   <store-slug>/documents/<stem>.<ext>   raw files (pdf, zip, video)
 *
 * - GET    /api/images/upload?kind=images|documents&cursor=…  → { images: [{name,key,url,size,uploaded}], cursor? }
 * - GET    /api/images/upload?legacy=1&cursor=…               → same shape, the store's pre-restructure keys (copy source)
 * - POST   /api/images/upload (multipart: file, slug?, alt?, raw=true | png=true) → { url, key, size }
 * - POST   /api/images/upload?action=copy  (json {from}) → { status: "copied"|"exists", key, url }
 * - DELETE /api/images/upload?key=<store>/…  → { success: true }
 *
 * Admin-gated: Authorization Bearer <own ES256 JWT (cigarro_token)>, verified against
 * Convex memberships. Files are expected pre-converted to WebP by the client (canvas
 * redraw strips EXIF/GPS); the server validates type + size.
 * Public reads stay on https://cdn.cigarro.in (no auth).
 *
 * Every write is create-only: a key that already exists is never overwritten.
 */

const CDN_BASE = (env) =>
  (env.CDN_BASE_URL || 'https://cdn.cigarro.in').replace(/\/$/, '');
// Pre-restructure keys. Kept readable (copy source, delete of old objects, legacy list).
const OLD_PREFIX = 'asset_images/';
const MAX_BYTES = 10 * 1024 * 1024;
const STORE_HEADER_RE = /^[a-z0-9-]{1,50}$/;
const IMAGE_EXT_RE = /\.(webp|jpg|jpeg|png|gif|avif)$/i;

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Store',
    },
  });
}

// The store this request acts for. On the admin host the API path carries no
// store, so the admin client names the store in X-Store. Only honoured on the
// admin host; requireAdmin still checks membership in that named store.
function requestedStoreSlug(request, context) {
  const org = getRequestOrg(context);
  const named = (request.headers.get('X-Store') || '').trim().toLowerCase();
  if (org.admin && STORE_HEADER_RE.test(named)) return named;
  return String(org.slug);
}

async function requireAdmin(request, env, orgSlug) {
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
        args: { orgSlug },
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

function decodeListCursor(cursor) {
  if (!cursor) return undefined;
  try { return JSON.parse(atob(cursor)).c || undefined; } catch { return undefined; }
}

function encodeListCursor(cursor) {
  return btoa(JSON.stringify({ c: cursor }));
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

function listedImage(obj, cdn) {
  return {
    id: obj.key,
    name: obj.key.split('/').pop(),
    path: obj.key,
    url: `${cdn}/${obj.key}`,
    size: obj.size || 0,
    contentType: obj.httpMetadata?.contentType || 'image/webp',
    createdAt: obj.uploaded ? new Date(obj.uploaded).toISOString() : new Date().toISOString(),
    metadata: obj.customMetadata || {},
  };
}

// Only keys that are this store's, in either layout. Old keys are the store's own
// `asset_images/orgs/<slug>/…`, and for the legacy store also bare `asset_images/…`.
function isOwnOldKey(key, orgSlug) {
  if (!key.startsWith(OLD_PREFIX)) return false;
  if (key.startsWith(`${OLD_PREFIX}orgs/`)) return key.startsWith(`${OLD_PREFIX}orgs/${orgSlug}/`);
  return orgSlug === LEGACY_ORG_SLUG;
}

function isOwnNewKey(key, orgSlug) {
  return key.startsWith(`${orgSlug}/images/`) || key.startsWith(`${orgSlug}/documents/`);
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return json({}, 200);

  const orgSlug = requestedStoreSlug(request, context);
  if (!/^[a-z0-9-]{1,50}$/.test(orgSlug)) return json({ error: 'Invalid org configuration' }, 500);
  const gate = await requireAdmin(request, env, orgSlug);
  if (!gate.ok) return json({ error: gate.error || 'Unauthorized' }, 401);
  const bucket = env.R2_ASSETS;
  const cdn = CDN_BASE(env);
  const url = new URL(request.url);

  // ---- List ----
  if (request.method === 'GET') {
    const cursor = decodeListCursor(url.searchParams.get('cursor'));
    let prefix;
    const legacy = url.searchParams.get('legacy') === '1';
    const kind = url.searchParams.get('kind') === 'documents' ? 'documents' : 'images';
    if (legacy) {
      // Copy source: this store's pre-restructure keys. The legacy store also owns
      // bare `asset_images/<name>` keys, so its scan starts at the root of that prefix.
      prefix = orgSlug === LEGACY_ORG_SLUG ? OLD_PREFIX : `${OLD_PREFIX}orgs/${orgSlug}/`;
    } else {
      prefix = `${orgSlug}/${kind}/`;
    }
    const listed = await bucket.list({ prefix, limit: 500, cursor });
    const images = [];
    for (const obj of listed.objects || []) {
      if (legacy && !isOwnOldKey(obj.key, orgSlug)) continue;
      // Documents are listed whatever their extension; images only as image types.
      if (kind === 'images' && !legacy && !IMAGE_EXT_RE.test(obj.key)) continue;
      if (legacy && !IMAGE_EXT_RE.test(obj.key)) continue;
      images.push(listedImage(obj, cdn));
    }
    images.sort((a, b) => (b.createdAt < a.createdAt ? -1 : 1));
    const out = { images };
    if (listed.truncated) out.cursor = encodeListCursor(listed.cursor);
    return json(out);
  }

  // ---- Upload + copy ----
  if (request.method === 'POST' && url.searchParams.get('action') === 'copy') {
    const body = await request.json().catch(() => null);
    const from = String(body?.from || '');
    if (!from || !isOwnOldKey(from, orgSlug) || !IMAGE_EXT_RE.test(from))
      return json({ error: 'Bad source key' }, 400);
    const stem = slugify(from.split('/').pop().replace(IMAGE_EXT_RE, '')) || `${Date.now()}`;
    const ext = (from.match(IMAGE_EXT_RE)?.[1] || 'webp').toLowerCase();
    // Target key is chosen by the caller (the copy script's map), so the same key is
    // produced on every run. The server only checks it is this store's new layout.
    const to = String(body?.to || `${orgSlug}/images/${stem}.${ext}`);
    if (!isOwnNewKey(to, orgSlug) || to.includes('..')) return json({ error: 'Bad target key' }, 400);
    const sourceHead = await bucket.head(from);
    if (!sourceHead) return json({ error: 'Source not found', key: from }, 404);
    // Target already there: fine when it holds the same bytes (an earlier run),
    // a conflict otherwise. Never overwritten either way.
    const existing = await bucket.head(to);
    if (existing) {
      const same = existing.etag === sourceHead.etag;
      return json({ status: same ? 'exists' : 'conflict', key: to, url: `${cdn}/${to}` }, same ? 200 : 409);
    }
    const source = await bucket.get(from);
    if (!source) return json({ error: 'Source not found', key: from }, 404);
    const stored = await bucket.put(to, source.body, {
      httpMetadata: source.httpMetadata,
      customMetadata: source.customMetadata,
      // Create-only: null means the target key appeared meanwhile (race-safe).
      onlyIf: { etagDoesNotMatch: '*' },
    });
    if (stored === null) return json({ status: 'conflict', key: to, error: 'Target appeared during copy' }, 409);
    return json({ status: 'copied', key: to, url: `${cdn}/${to}`, size: stored.size });
  }

  if (request.method === 'POST') {
    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    // raw=true stores non-image assets (video/pdf/zip) untouched under documents/.
    const raw = String(form?.get('raw') || '') === 'true';
    // png=true: a PNG generated in the browser (store app icons). Checked by its signature.
    const png = String(form?.get('png') || '') === 'true';
    if (raw && png) return json({ error: 'Use either raw or png, not both' }, 400);
    if (!file || typeof file.arrayBuffer !== 'function')
      return json({ error: 'file (multipart) is required' }, 400);
    const mime = String(file.type || 'application/octet-stream');
    if (raw && mime.startsWith('image/'))
      return json({ error: 'Images must use the WebP upload flow' }, 400);
    if (png && mime !== 'image/png')
      return json({ error: 'PNG image required' }, 400);
    if (!raw && !png && mime !== 'image/webp')
      return json({ error: 'Converted WebP image required' }, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_BYTES)
      return json({ error: 'File empty or over 10MB' }, 400);
    if (!raw && !png && !(bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'))
      return json({ error: 'Invalid WebP image' }, 400);
    if (png && !(bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)))
      return json({ error: 'Invalid PNG image' }, 400);
    const ext = raw
      ? (String(file.name || 'bin').split('.').pop() || 'bin').toLowerCase().slice(0, 10)
      : png ? 'png' : 'webp';
    if (raw && /^(webp|jpe?g|png|gif|avif|svg)$/.test(ext))
      return json({ error: 'Images must use the WebP upload flow' }, 400);
    // SEO filename: item slug when the caller knows it, numeric suffix on
    // collision (`slug.webp`, `slug-2.webp`, …). Conditional put keeps this
    // race-safe: onlyIf etagDoesNotMatch '*' never overwrites, retry next.
    const sourceName = String(form?.get('slug') || (raw ? file.name : '') || '').replace(/\.[^.]+$/, '');
    const stem = slugify(sourceName) || `${Date.now()}`;
    const base = `${orgSlug}/${raw ? 'documents' : 'images'}/${stem}`;
    const pipelineSource = String(form?.get('pipelineSource') || '');
    if (pipelineSource && !/^[a-f0-9]{24}$/.test(pipelineSource))
      return json({ error: 'Invalid pipeline marker' }, 400);
    const customMetadata = {};
    if (form?.get('alt')) customMetadata.alt = String(form.get('alt')).slice(0, 300);
    if (pipelineSource) customMetadata.pipelineSource = pipelineSource;
    const meta = {
      httpMetadata: {
        contentType: raw ? mime : png ? 'image/png' : 'image/webp',
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
    if (!isOwnNewKey(key, orgSlug) && !isOwnOldKey(key, orgSlug)) return json({ error: 'Bad key' }, 400);
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
