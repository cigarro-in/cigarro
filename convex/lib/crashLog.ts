import { v } from 'convex/values';

export const crashSource = v.union(v.literal('app'), v.literal('convex'), v.literal('cloudflare'));
export const crashReport = v.object({
  source: crashSource, message: v.string(), stack: v.optional(v.string()),
  componentStack: v.optional(v.string()), path: v.optional(v.string()),
  userAgent: v.optional(v.string()), build: v.optional(v.string()),
  operation: v.optional(v.string()), requestId: v.optional(v.string()),
  status: v.optional(v.number()),
});

// Never persist request bodies, cookies, auth headers, or raw Convex arguments.
export function redactCrashText(value: unknown, max = 8000): string {
  if (typeof value !== 'string') return '';
  return value.slice(0, 16000)
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[token]')
    // SDK validation errors can embed arbitrary argument objects. Keep the
    // surrounding failure and stack, but discard the embedded customer data.
    .replace(/\{[\s\S]*\}/g, '[details redacted]')
    .replace(/(["']?(?:token|otp|password|secret|authkey|authorization|phone|email|access[-_]?token|refresh[-_]?token)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,}]+)/gi, '$1[redacted]')
    .replace(/https?:\/\/[^\s"'<>]+/gi, (url) => {
      try { const parsed = new URL(url); return parsed.origin + parsed.pathname; }
      catch { return '[url]'; }
    })
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/\+?\b\d[\d ()-]{8,}\d\b/g, '[phone]')
    .slice(0, max);
}

export function crashPath(value: unknown): string {
  if (typeof value !== 'string') return '/';
  try { return redactCrashText(new URL(value, 'https://cigarro.in').pathname, 500); }
  catch { return '/'; }
}
