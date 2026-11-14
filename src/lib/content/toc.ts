// Pure table-of-contents helper for blog bodies. No DOM, no React: it runs in the
// server render (SSR, so heading ids are in the HTML crawlers read) and in the
// browser, and gives both the same markup.
//
// Input is the sanitized blog HTML (src/lib/blog/blogRender.ts). Only h2 and h3
// are indexed. Every h2/h3 gets a stable id derived from its text, deduplicated
// with -2, -3, ... in document order. Any id the content already carried is
// replaced, so the ids are always the ones listed in `items`.

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface TocResult {
  /** The input HTML with id attributes set on every h2/h3. */
  html: string;
  items: TocItem[];
}

/** A TOC is shown only from this many headings. */
export const TOC_MIN_ITEMS = 3;

const HEADING_RE = /<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi;
const ENTITY_RE = /&(amp|lt|gt|quot|apos|#39|#x27|nbsp|#\d+|#x[0-9a-f]+);/gi;
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", '#x27': "'", nbsp: ' ',
};

function decodeEntities(value: string): string {
  return value.replace(ENTITY_RE, (match, name: string) => {
    const key = name.toLowerCase();
    if (key in NAMED_ENTITIES) return NAMED_ENTITIES[key];
    const code = key.startsWith('#x') ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
    if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
    return String.fromCodePoint(code);
  });
}

/** Visible text of a heading: tags dropped, entities decoded, whitespace collapsed. */
export function headingText(inner: string): string {
  return decodeEntities(inner.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** URL-safe slug that keeps letters and digits from any script (Hindi headings stay readable). */
export function slugifyHeading(text: string): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return slug || 'section';
}

export function buildToc(html: string | null | undefined): TocResult {
  if (!html) return { html: '', items: [] };
  const used = new Set<string>();
  const items: TocItem[] = [];

  const out = String(html).replace(HEADING_RE, (_whole, level: string, attrs: string | undefined, inner: string) => {
    const text = headingText(inner);
    const base = slugifyHeading(text);
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    const lvl = level === '2' ? 2 : 3;
    items.push({ id, text: text || 'Section', level: lvl });
    // Drop any id the content carried; the generated one is the only one.
    const cleanAttrs = (attrs ?? '').replace(/\sid\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    return `<h${lvl}${cleanAttrs} id="${id}">${inner}</h${lvl}>`;
  });

  return { html: out, items };
}
