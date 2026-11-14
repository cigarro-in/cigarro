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

const ALLOWED_TAGS = new Set([
  'p', 'br', 'h2', 'h3', 'h4', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li', 'a', 'img',
  'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'figure', 'figcaption', 'hr', 'span',
]);
const VOID_TAGS = new Set(['br', 'img', 'hr']);
// Elements whose content is dropped entirely (not just the tag).
const DROP_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'textarea', 'title', 'svg', 'math', 'template']);
const ATTRS_BY_TAG: Record<string, Set<string>> = {
  a: new Set(['href', 'title']),
  img: new Set(['src', 'alt', 'width', 'height', 'loading']),
};

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// href: http(s), mailto, or relative. External links get rel="noopener nofollow".
function safeHref(raw: string): { href: string; external: boolean } | null {
  const value = raw.trim();
  if (!value || /[\u0000-\u001f\s]/.test(value.replace(/ /g, ''))) return null;
  if (value.startsWith('//')) return { href: value, external: true };
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(value);
  if (!scheme) return { href: value, external: false }; // relative, #anchor, ?query
  const proto = scheme[1].toLowerCase();
  if (proto === 'http' || proto === 'https') return { href: value, external: true };
  if (proto === 'mailto') return { href: value, external: true };
  return null;
}

function safeSrc(raw: string): string | null {
  const value = raw.trim();
  return /^https:\/\/[^\s"'<>]+$/i.test(value) ? value : null;
}

function parseAttrs(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const name = m[1].toLowerCase();
    out[name] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return out;
}

// id on h2/h3 only (anchor target for the in-article table of contents).
const HEADING_ID_RE = /^[\p{L}\p{N}_-]{1,100}$/u;

function renderTag(tag: string, attrs: Record<string, string>, imgPrefix?: string): string {
  if (tag === 'h2' || tag === 'h3') {
    const id = attrs.id !== undefined && HEADING_ID_RE.test(attrs.id.trim()) ? attrs.id.trim() : null;
    return `<${tag}${id ? ` id="${id}"` : ''}>`;
  }
  const allowed = ATTRS_BY_TAG[tag];
  if (!allowed) return `<${tag}>`;
  const parts: string[] = [];
  if (tag === 'a') {
    const href = attrs.href !== undefined ? safeHref(attrs.href) : null;
    if (href) {
      parts.push(`href="${escapeAttr(href.href)}"`);
      if (href.external) parts.push('rel="noopener nofollow"');
    }
    if (attrs.title) parts.push(`title="${escapeAttr(attrs.title)}"`);
    return `<a${parts.length ? ' ' + parts.join(' ') : ''}>`;
  }
  // img
  const src = attrs.src !== undefined ? safeSrc(attrs.src) : null;
  if (!src) return '';
  if (imgPrefix && !src.startsWith(imgPrefix)) return '';
  parts.push(`src="${escapeAttr(src)}"`);
  if (attrs.alt !== undefined) parts.push(`alt="${escapeAttr(attrs.alt)}"`);
  if (attrs.width && /^\d{1,5}$/.test(attrs.width)) parts.push(`width="${attrs.width}"`);
  if (attrs.height && /^\d{1,5}$/.test(attrs.height)) parts.push(`height="${attrs.height}"`);
  if (attrs.loading === 'lazy' || attrs.loading === 'eager') parts.push(`loading="${attrs.loading}"`);
  return `<img ${parts.join(' ')}>`;
}

// Blog body sanitizer, ALLOWLIST. Pure string code (no DOM), so the server render
// and the browser produce the same markup. Only the tags below survive; each one
// keeps only its allowed attributes (a: href, title; img: https src, alt, size,
// loading; h2/h3: id). Everything else is dropped: all on* handlers, style, script/iframe
// (with their content), comments and unknown tags. Text is kept, with a stray "<"
// escaped.
// opts.imgPrefix: when set, an <img> is kept only if its src starts with this
// prefix (product and category descriptions pass the CDN origin). Unset = any https src.
export function sanitizeBlogBody(html: string | null | undefined, opts?: { imgPrefix?: string }): string {
  if (!html) return '';
  const input = String(html).replace(/<!--[\s\S]*?-->/g, '').replace(/<![^>]*>/g, '');
  const tokens = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)|(<)/g;
  let out = '';
  let skipUntil: string | null = null; // tag name whose closing tag ends a dropped block
  let m: RegExpExecArray | null;
  while ((m = tokens.exec(input))) {
    if (m[3] !== undefined) {
      if (!skipUntil) out += m[3];
      continue;
    }
    if (m[4] !== undefined) {
      if (!skipUntil) out += '&lt;';
      continue;
    }
    const closing = m[0].startsWith('</');
    const name = m[1].toLowerCase();
    if (skipUntil) {
      if (closing && name === skipUntil) skipUntil = null;
      continue;
    }
    if (!closing && DROP_CONTENT.has(name)) {
      if (!/\/\s*>$/.test(m[0])) skipUntil = name;
      continue;
    }
    if (!ALLOWED_TAGS.has(name)) continue;
    if (closing) {
      if (!VOID_TAGS.has(name)) out += `</${name}>`;
      continue;
    }
    out += renderTag(name, parseAttrs(m[2] ?? ''), opts?.imgPrefix);
  }
  return out;
}
