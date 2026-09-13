// TEMPORARY debug probe (delete after Wave 3 gate passes).
// Returns the raw result of a Convex api/query fetch from the edge runtime.
export async function onRequest(context) {
  const { env } = context;
  const convexUrl =
    (env.VITE_CONVEX_URL || 'https://proper-coyote-383.convex.cloud').trim();
  const out = { host: null, ok: false, status: null, bodyPreview: null };
  try {
    out.host = new URL(convexUrl).host;
  } catch (e) {
    out.bodyPreview = 'BAD-URL: ' + String(e && e.message);
    return Response.json(out);
  }
  try {
    const res = await fetch(`${convexUrl}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'catalog:catalogCounts', args: {}, format: 'json' }),
    });
    out.status = res.status;
    const text = await res.text();
    out.ok = res.ok;
    out.bodyPreview = text.slice(0, 500);
  } catch (e) {
    out.bodyPreview = 'FETCH-THREW: ' + String((e && e.stack) || e);
  }
  return Response.json(out);
}
