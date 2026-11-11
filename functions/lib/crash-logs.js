import { requiredConvexUrl } from './env.js';

// The edge sets source, tenant and reporter; clients cannot impersonate server logs.
export async function persistCrash(context, report, source = 'cloudflare') {
  try {
    const { env, request } = context;
    if (!env.EDGE_SHARED_SECRET) throw new Error('Crash logging: EDGE_SHARED_SECRET missing');
    const site = (env.CONVEX_SITE_URL || requiredConvexUrl(env)).replace('.convex.cloud', '.convex.site');
    const day = new Date().toISOString().slice(0, 10);
    // Daily salted fingerprint for rate limiting; never store the raw IP.
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(
      `${env.EDGE_SHARED_SECRET}:${day}:${request.headers.get('cf-connecting-ip') || 'unknown'}`,
    ));
    const reporter = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
    const result = await fetch(`${site}/crashLogs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.EDGE_SHARED_SECRET}` },
      body: JSON.stringify({
        orgSlug: env.VITE_ORG_SLUG || 'smokeshop', reporter,
        report: {
          source,
          message: String(report.message || 'Unknown error').slice(0, 2000),
          stack: String(report.stack || '').slice(0, 6000),
          componentStack: String(report.componentStack || '').slice(0, 6000),
          path: String(report.path || new URL(request.url).pathname).slice(0, 500),
          userAgent: (request.headers.get('user-agent') || '').slice(0, 500),
          build: String(report.build || env.CF_PAGES_COMMIT_SHA || '').slice(0, 100),
          operation: String(report.operation || request.method).slice(0, 200),
          requestId: (request.headers.get('cf-ray') || '').slice(0, 100),
          ...(Number.isInteger(report.status) ? { status: report.status } : {}),
        },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!result.ok && result.status !== 429) console.error('Crash logging failed:', result.status);
    return result.ok;
  } catch (error) {
    // Never let reporting replace the original response or create recursion.
    console.error('Crash logging unavailable:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}
