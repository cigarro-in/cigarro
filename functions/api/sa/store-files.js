import { requiredConvexUrl } from '../../lib/env.js';

/**
 * Super-admin "Fresh start": R2 file cleanup for one store.
 *
 * POST /api/sa/store-files
 *   body: { saToken, orgId, mode: "used" | "unused" | "both", dryRun: boolean }
 *   -> { listed, used, unused, deleted }
 *
 * - used:   files under asset_images/orgs/<slug>/ that the store's data references
 * - unused: files under that prefix that nothing references
 * - dryRun: counts only, nothing is deleted (deleted = 0)
 *
 * Auth: the SA session token is checked by Convex (storeReset:referencedFileKeys
 * needs a live session; storeReset:checkSaWrite needs an open write window).
 * Bucket binding: R2_ASSETS (bucket cigarro-assets).
 */

const MODES = new Set(['used', 'unused', 'both']);
const STORE_SLUG_RE = /^[a-z0-9-]{1,50}$/;
const ORG_ID_RE = /^[a-z0-9]{20,64}$/i;
const SA_TOKEN_MIN = 20;
const SA_TOKEN_MAX = 256;
const R2_DELETE_MAX = 1000;

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// Calls a public Convex query over HTTP. Returns { ok, value } or { ok: false, code }.
async function convexQuery(convexUrl, path, args) {
  let res;
  try {
    res = await fetch(`${convexUrl}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, args, format: 'json' }),
    });
  } catch {
    return { ok: false, code: 'UNREACHABLE' };
  }
  const body = await res.json().catch(() => null);
  if (body?.status === 'success') return { ok: true, value: body.value };
  return { ok: false, code: body?.errorData?.code || 'CONVEX_ERROR', message: body?.errorMessage || '' };
}

async function listAllKeys(bucket, prefix) {
  const keys = [];
  let cursor;
  do {
    const page = await bucket.list({ prefix, limit: 1000, cursor });
    for (const obj of page.objects || []) keys.push(obj.key);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return keys;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
  const saToken = typeof body?.saToken === 'string' ? body.saToken : '';
  const orgId = typeof body?.orgId === 'string' ? body.orgId : '';
  const mode = body?.mode;
  const dryRun = body?.dryRun === true;

  if (saToken.length < SA_TOKEN_MIN || saToken.length > SA_TOKEN_MAX) return json({ error: 'Not signed in' }, 401);
  if (!ORG_ID_RE.test(orgId)) return json({ error: 'Bad store id' }, 400);
  if (!MODES.has(mode)) return json({ error: 'Bad mode' }, 400);
  if (!env.R2_ASSETS) return json({ error: 'R2 binding R2_ASSETS missing' }, 500);

  const convexUrl = requiredConvexUrl(env);

  // 1. Session + store. Also returns the slug the R2 prefix is built from.
  const refs = await convexQuery(convexUrl, 'storeReset:referencedFileKeys', { saToken, orgId });
  if (!refs.ok) {
    if (refs.code === 'NOT_SIGNED_IN') return json({ error: 'Not signed in', code: refs.code }, 401);
    return json({ error: 'Could not read store data', code: refs.code }, 500);
  }

  // 2. Write window must be open for any call here, dry runs included.
  const write = await convexQuery(convexUrl, 'storeReset:checkSaWrite', { saToken });
  if (!write.ok) {
    if (write.code === 'NOT_SIGNED_IN') return json({ error: 'Not signed in', code: write.code }, 401);
    return json({ error: 'Write access required', code: write.code || 'WRITE_REQUIRED' }, 403);
  }
  if (write.value?.ok !== true) return json({ error: 'Write access required', code: 'WRITE_REQUIRED' }, 403);

  const slug = refs.value?.slug;
  if (typeof slug !== 'string' || !STORE_SLUG_RE.test(slug)) return json({ error: 'Invalid store slug' }, 500);
  const referenced = new Set(Array.isArray(refs.value?.keys) ? refs.value.keys : []);

  const prefix = `asset_images/orgs/${slug}/`;
  const bucket = env.R2_ASSETS;
  const keys = await listAllKeys(bucket, prefix);
  const used = [];
  const unused = [];
  for (const key of keys) {
    // Never touch anything outside this store's prefix.
    if (!key.startsWith(prefix)) continue;
    (referenced.has(key) ? used : unused).push(key);
  }

  const target = mode === 'used' ? used : mode === 'unused' ? unused : [...used, ...unused];
  let deleted = 0;
  if (!dryRun) {
    for (let i = 0; i < target.length; i += R2_DELETE_MAX) {
      const batch = target.slice(i, i + R2_DELETE_MAX);
      await bucket.delete(batch);
      deleted += batch.length;
    }
  }

  return json({ listed: keys.length, used: used.length, unused: unused.length, deleted });
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ error: 'Method not allowed' }, 405);
}
