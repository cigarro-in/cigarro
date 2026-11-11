import { persistCrash } from '../lib/crash-logs.js';

export async function onRequestPost(context) {
  const { request } = context;
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return new Response(null, { status: 403 });
  if (!request.headers.get('content-type')?.startsWith('application/json')) return new Response(null, { status: 415 });
  if (Number(request.headers.get('content-length')) > 20000) return new Response(null, { status: 413 });
  // Read bounded input even when Content-Length is missing or forged.
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  let length = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 20000) { await reader.cancel(); return new Response(null, { status: 413 }); }
    chunks.push(value);
  }
  let report;
  try {
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    report = JSON.parse(new TextDecoder().decode(bytes));
    if (!report || typeof report.message !== 'string') throw new Error('Invalid report');
  } catch { return new Response(null, { status: 400 }); }
  const saved = await persistCrash(context, report, report.source === 'convex' ? 'convex' : 'app');
  return new Response(null, { status: saved ? 204 : 503, headers: { 'cache-control': 'no-store' } });
}
