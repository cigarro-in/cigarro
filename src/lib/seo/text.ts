// Pure text helpers for SEO copy. No React, no Convex.

const META_MAX = 160;

/**
 * Collapse whitespace and cut to at most `max` characters at a word boundary.
 * Never cuts mid-word and never adds an ellipsis: the result is a complete
 * sentence fragment, so the snippet is not truncated mid-word.
 */
export function truncateAtWord(input: string, max: number = META_MAX): string {
  const text = input.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const window = text.slice(0, max + 1);
  const cut = window.lastIndexOf(' ');
  const head = cut > 0 ? window.slice(0, cut) : text.slice(0, max);
  return head.replace(/[\s,;:\-–—&/]+$/, '');
}
