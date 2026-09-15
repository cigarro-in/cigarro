// Shared env helper for Pages Functions. Deployment URLs come ONLY from
// the Cloudflare dashboard (Preview + Production env vars) — no hardcoded
// fallbacks, so a missing var fails closed instead of silently hitting the
// wrong Convex deployment.

export function requiredConvexUrl(env) {
  const url = (env.VITE_CONVEX_URL || '').replace(/\/$/, '');
  if (!url) throw new Error('VITE_CONVEX_URL not configured');
  return url;
}
