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
