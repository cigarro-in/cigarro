import { requiredConvexUrl } from '../../lib/env.js';
import { copyCreateOnly } from '../../lib/r2Copy.js';
import { LEGACY_ORG_SLUG } from '../../lib/legacyOrg.js';
import { IMAGE_RE, LEGACY_PREFIX, legacyOwner, planNewKeys } from '../../../convex/lib/storageKeys.ts';

/**
 * Super-admin "Copy images": copies one batch of a store's pre-restructure images
 * into the new layout (<slug>/images/<stem>.<ext>) and records each move in Convex
 * (convex/storageKeyMoves.ts). Copy only: nothing is moved or deleted, old URLs
 * keep working. The client calls this in a loop until done.
 *
 * POST /api/sa/storage-copy
 *   body: { saToken, orgId, cursor?: string | null, limit?: 1..10 (default 10; ~4 R2 calls per key keeps a batch under the 50-subrequest free-plan cap) }
 *   -> { slug, scanned, copied, exists, conflicts, failed, cursor, done }
 *
 * - Names are planned against the recorded moves, so re-runs and later batches keep
 *   every name already assigned. A name an unrelated R2 object holds is a conflict:
 *   the next suffix (-2, -3, ...) is tried. Old objects are never overwritten.
 * - The R2 cursor is the raw listing position; `limit` bounds the raw keys listed,
 *   which bounds the R2 calls made per request.
 *
 * Auth: SA session (Convex storeReset:checkSaWrite, then storageKeyMoves:plan
 * requires a live session). Bucket binding: R2_ASSETS (bucket cigarro-assets).
 */

const ORG_ID_RE = /^[a-z0-9]{20,64}$/i;
const SA_TOKEN_MIN = 20;
const SA_TOKEN_MAX = 256;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 10;
const CURSOR_MAX = 2048;
const CONFLICT_TRIES = 5;

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// Calls a Convex query or mutation over HTTP. Returns { ok, value } or { ok: false, code }.
async function convexCall(convexUrl, kind, path, args) {
  let res;
  try {
    res = await fetch(`${convexUrl}/api/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, args, format: 'json' }),
    });
  } catch {
    return { ok: false, code: 'UNREACHABLE' };
  }
  const body = await res.json().catch(() => null);
  if (body?.status === 'success') return { ok: true, value: body.value };
  return { ok: false, code: body?.errorData?.code || 'CONVEX_ERROR' };
}

function convexFailure(result, fallback) {
  if (result.code === 'NOT_SIGNED_IN') return json({ error: 'Not signed in', code: result.code }, 401);
  if (result.code === 'WRITE_REQUIRED' || result.code === 'WRITE_EXPIRED')
    return json({ error: 'Write access required', code: result.code }, 403);
  return json({ error: fallback, code: result.code }, 500);
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
  const cursor = typeof body?.cursor === 'string' && body.cursor ? body.cursor.slice(0, CURSOR_MAX) : undefined;
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(body?.limit) || DEFAULT_LIMIT));

  if (saToken.length < SA_TOKEN_MIN || saToken.length > SA_TOKEN_MAX) return json({ error: 'Not signed in' }, 401);
  if (!ORG_ID_RE.test(orgId)) return json({ error: 'Bad store id' }, 400);
  if (!env.R2_ASSETS) return json({ error: 'R2 binding R2_ASSETS missing' }, 500);

  const convexUrl = requiredConvexUrl(env);

  // 1. Write window must be open: this endpoint records results in Convex.
  const write = await convexCall(convexUrl, 'query', 'storeReset:checkSaWrite', { saToken });
  if (!write.ok) return convexFailure(write, 'Could not check write access');
  if (write.value?.ok !== true) return json({ error: 'Write access required', code: 'WRITE_REQUIRED' }, 403);

  // 2. Store slug and the moves already recorded for it.
  const planned = await convexCall(convexUrl, 'query', 'storageKeyMoves:plan', { saToken, orgId });
  if (!planned.ok) return convexFailure(planned, 'Could not read store data');
  const slug = planned.value?.slug;
  if (typeof slug !== 'string' || !/^[a-z0-9-]{1,50}$/.test(slug)) return json({ error: 'Invalid store slug' }, 500);
  const moves = { ...(planned.value?.moves ?? {}) };

  // 3. One page of raw keys. Legacy store: bare asset_images/... plus its own orgs/ keys.
  const prefix = slug === LEGACY_ORG_SLUG ? LEGACY_PREFIX : `${LEGACY_PREFIX}orgs/${slug}/`;
  const bucket = env.R2_ASSETS;
  const page = await bucket.list({ prefix, limit, cursor });
  const own = (page.objects || [])
    .map((o) => o.key)
    .filter((key) => IMAGE_RE.test(key) && legacyOwner(key, LEGACY_ORG_SLUG) === slug);

  const cdn = (env.CDN_BASE_URL || 'https://cdn.cigarro.in').replace(/\/$/, '');
  const results = [];
  const counts = { copied: 0, exists: 0, conflicts: 0, failed: 0 };

  for (const from of own) {
    if (from in moves) continue; // already recorded: keeps its target
    const blocked = new Set();
    let outcome = null;
    let to = '';
    for (let attempt = 0; attempt < CONFLICT_TRIES && !outcome; attempt++) {
      to = planNewKeys([from], slug, moves, blocked)[from];
      let copied;
      try {
        copied = await copyCreateOnly(bucket, cdn, from, to);
      } catch {
        outcome = 'failed';
        break;
      }
      if (copied.body.status === 'conflict') {
        blocked.add(to);
        continue;
      }
      if (copied.httpStatus === 200) {
        outcome = copied.body.status === 'exists' ? 'exists' : 'copied';
      } else {
        outcome = 'failed';
      }
    }
    if (!outcome) outcome = 'conflict';

    if (outcome === 'copied' || outcome === 'exists') {
      moves[from] = to;
      counts[outcome] += 1;
      results.push({ fromKey: from, toKey: to, orgSlug: slug, status: 'copied' });
    } else if (outcome === 'conflict') {
      counts.conflicts += 1;
      results.push({ fromKey: from, toKey: to, orgSlug: slug, status: 'conflict' });
    } else {
      counts.failed += 1;
      results.push({ fromKey: from, toKey: to, orgSlug: slug, status: 'failed' });
    }
  }

  // 4. Record this batch. A failure here is safe: the copies stay, and the next run
  // finds them as "exists" and records them then.
  if (results.length > 0) {
    const recorded = await convexCall(convexUrl, 'mutation', 'storageKeyMoves:record', { saToken, results });
    if (!recorded.ok) return convexFailure(recorded, 'Could not record the copies. Run it again.');
  }

  const done = !page.truncated;
  return json({
    slug,
    scanned: own.length,
    copied: counts.copied,
    exists: counts.exists,
    conflicts: counts.conflicts,
    failed: counts.failed,
    cursor: done ? null : page.cursor,
    done,
  });
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ error: 'Method not allowed' }, 405);
}
