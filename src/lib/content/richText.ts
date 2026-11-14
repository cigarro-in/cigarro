// Pure helpers for rich-text fields (product, category, brand and collection
// descriptions, blog and store page bodies). No DOM, no React: the admin editor
// and the storefront both import this, so they read and write the same format.
//
// Storage format: HTML, limited to the sanitizer allowlist in
// src/lib/blog/blogRender.ts (sanitizeBlogBody). Legacy plain text (no markup)
// is still accepted and rendered as paragraphs.

import { sanitizeBlogBody } from '../blog/blogRender';

export const CDN_IMG_PREFIX = 'https://cdn.cigarro.in/';

const HAS_MARKUP = /<[a-z][\s\S]*>/i;

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Plain text becomes paragraphs (blank line = new paragraph, newline = <br>). Markup passes through. */
export function plainTextToHtml(value: string | null | undefined): string {
  if (!value) return '';
  if (HAS_MARKUP.test(value)) return value;
  return value
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeText(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Safe HTML for dangerouslySetInnerHTML. opts.imgPrefix limits <img> to that origin. */
export function renderRichText(
  value: string | null | undefined,
  opts?: { imgPrefix?: string },
): string {
  return sanitizeBlogBody(plainTextToHtml(value), opts);
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };

/** One line of plain text (tags dropped, entities decoded). For cards, meta tags and subtitles. */
export function richTextToPlain(value: string | null | undefined): string {
  const html = renderRichText(value);
  return html
    .replace(/<img\b[^>]*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|h2|h3|li|blockquote)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m, name: string) => ENTITIES[name] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}
