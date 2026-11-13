// Pure helpers for blog pages, shared by the server render and the client so
// the markup is identical on both (no DOM, no runtime locale, no Date.now).

// Dates in the store's timezone and a fixed locale: the same string on the
// Worker and in the browser, whatever the visitor's locale.
export function formatBlogDate(ms: number, style: 'long' | 'short' = 'long'): string {
  const opts: Intl.DateTimeFormatOptions =
    style === 'long'
      ? { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' }
      : { month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' };
  return new Intl.DateTimeFormat('en-US', opts).format(new Date(ms));
}

const DROP_BLOCKS = /<(script|style|iframe|object|embed|form|link|meta|base)\b[\s\S]*?<\/\1\s*>|<(script|style|iframe|object|embed|form|link|meta|base)\b[^>]*\/?>/gi;
const EVENT_ATTR = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const UNSAFE_URL_ATTR = /\s+(href|src|xlink:href|action|formaction)\s*=\s*("|')?\s*(javascript|vbscript|data):[^"'\s>]*\2?/gi;

// Blog body sanitizer. A blocklist, not an allowlist: active content (script,
// style, frames, embeds, forms), inline event handlers and javascript:/data:/
// vbscript: URLs are removed. Authored content only; the rest of the markup is kept.
export function sanitizeBlogBody(html: string | null | undefined): string {
  if (!html) return '';
  return String(html)
    .replace(DROP_BLOCKS, '')
    .replace(EVENT_ATTR, '')
    .replace(UNSAFE_URL_ATTR, '');
}
