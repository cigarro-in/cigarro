// Shared helpers for the blog and store page editors (Content section).

export const META_TITLE_MAX = 60;
export const META_DESCRIPTION_MAX = 160;
const WORDS_PER_MINUTE = 200;

/** "Summer Sale: 20% off!" -> "summer-sale-20-off". */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Plain text of an HTML body (tags and entities dropped). */
export function plainText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function wordCount(html: string): number {
  const text = plainText(html);
  return text ? text.split(' ').length : 0;
}

export function readingMinutes(html: string): number {
  return Math.max(1, Math.ceil(wordCount(html) / WORDS_PER_MINUTE));
}

/** Parse "a, b ,c" into unique non-empty tags. */
export function parseTags(text: string): string[] {
  const seen = new Set<string>();
  for (const raw of text.split(',')) {
    const tag = raw.trim().toLowerCase();
    if (tag) seen.add(tag);
  }
  return [...seen];
}

/** Stable JSON of an editor form, used to detect unsaved changes. */
export function snapshot(value: unknown): string {
  return JSON.stringify(value);
}

export type FormatKind = 'bold' | 'italic' | 'h2' | 'h3' | 'link' | 'list' | 'quote' | 'paragraph';

/**
 * Apply one formatting action to the selected text. Returns the new body and
 * the selection to restore (the inserted text is selected so it can be typed over).
 */
export function applyFormat(
  value: string,
  start: number,
  end: number,
  kind: FormatKind,
): { value: string; selStart: number; selEnd: number } {
  const sel = value.slice(start, end);
  const pick = (fallback: string) => sel || fallback;
  let before: string;
  let after: string;
  let inner: string;
  let placeholder: string;
  switch (kind) {
    case 'bold':
      before = '<strong>'; after = '</strong>'; placeholder = 'bold text'; break;
    case 'italic':
      before = '<em>'; after = '</em>'; placeholder = 'italic text'; break;
    case 'h2':
      before = '\n<h2>'; after = '</h2>\n'; placeholder = 'Heading'; break;
    case 'h3':
      before = '\n<h3>'; after = '</h3>\n'; placeholder = 'Subheading'; break;
    case 'link':
      before = '<a href="https://">'; after = '</a>'; placeholder = 'link text'; break;
    case 'quote':
      before = '\n<blockquote>'; after = '</blockquote>\n'; placeholder = 'Quote'; break;
    case 'paragraph':
      before = '\n<p>'; after = '</p>\n'; placeholder = 'Paragraph text'; break;
    case 'list':
      before = '\n<ul>\n  <li>'; after = '</li>\n</ul>\n'; placeholder = 'List item'; break;
  }
  inner = pick(placeholder);
  const insert = before + inner + after;
  const next = value.slice(0, start) + insert + value.slice(end);
  // Select the placeholder/inner text (not the tags) so typing replaces it.
  const selStart = start + before.length;
  return { value: next, selStart, selEnd: selStart + inner.length };
}
