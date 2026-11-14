import { getRequestOrg } from '../lib/org.js';
import { requiredConvexUrl } from '../lib/env.js';

/**
 * POST /api/consent: records an age-gate confirmation for a visitor who has not
 * signed in (convex/consent.ts, recordAnonymous). The store comes from the
 * request hostname. The client IP comes from CF-Connecting-IP, which Cloudflare
 * sets and a visitor cannot override.
 *
 * Body: { anonymousId, kind: 'age_confirmation', granted?, textVersion, pagePath? }
 * Only age_confirmation is accepted here. Signed-in consent goes straight to Convex.
 */

const ANON_ID_RE = /^[A-Za-z0-9_-]{16,80}$/;
const TEXT_VERSION_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const CONVEX_TIMEOUT_MS = 4000;

function json(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// Path only: query strings can carry personal data, so they are dropped.
function cleanPagePath(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return undefined;
  try {
    return new URL(raw, 'https://placeholder.invalid').pathname.slice(0, 300);
  } catch {
    return undefined;
  }
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
  }

  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) {
    return json({ error: 'Forbidden', code: 'BAD_ORIGIN' }, 403);
  }

  const org = getRequestOrg(context);
  if (!org?.id || org.admin === true) {
    return json({ error: 'Unknown store', code: 'UNKNOWN_STORE' }, 404);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Bad request', code: 'BAD_JSON' }, 400);
  }

  const anonymousId = typeof body?.anonymousId === 'string' ? body.anonymousId : '';
  const textVersion = typeof body?.textVersion === 'string' ? body.textVersion : '';
  if (body?.kind !== 'age_confirmation') {
    return json({ error: 'Bad request', code: 'BAD_KIND' }, 400);
  }
  if (!ANON_ID_RE.test(anonymousId)) {
    return json({ error: 'Bad request', code: 'BAD_ANONYMOUS_ID' }, 400);
  }
  if (!TEXT_VERSION_RE.test(textVersion)) {
    return json({ error: 'Bad request', code: 'BAD_TEXT_VERSION' }, 400);
  }

  const ip = request.headers.get('cf-connecting-ip') || undefined;
  const userAgent = (request.headers.get('user-agent') || '').slice(0, 300) || undefined;

  let res;
  try {
    res = await fetch(`${requiredConvexUrl(env)}/api/mutation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: 'consent:recordAnonymous',
        args: {
          orgId: org.id,
          anonymousId,
          granted: body.granted !== false,
          textVersion,
          pagePath: cleanPagePath(body.pagePath),
          ip,
          userAgent,
        },
        format: 'json',
      }),
      signal: AbortSignal.timeout(CONVEX_TIMEOUT_MS),
    });
  } catch (error) {
    console.error('consent: Convex unreachable', error instanceof Error ? error.message : error);
    return json({ error: 'Try again', code: 'UNAVAILABLE' }, 503);
  }

  const out = await res.json().catch(() => null);
  if (!out || out.status !== 'success') {
    console.error('consent: record failed', out?.errorMessage || out?.status || res.status);
    return json({ error: 'Could not record', code: 'RECORD_FAILED' }, 502);
  }
  return json({ ok: true }, 200);
}
