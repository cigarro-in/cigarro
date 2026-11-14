import { useEffect, useState } from 'react';

// Client-only helpers for the in-article table of contents. Shared by the theme
// views (classic, vivid); they never run on the server (effects and event
// handlers only), so the SSR markup is unaffected.

/** Height of the sticky store header plus a little air, in px. Falls back to 88 when none is found. */
export function stickyHeaderOffset(): number {
  if (typeof document === 'undefined') return 88;
  const candidates = document.querySelectorAll<HTMLElement>('header, .sticky');
  for (const el of Array.from(candidates)) {
    const pos = window.getComputedStyle(el).position;
    if ((pos === 'fixed' || pos === 'sticky') && el.offsetHeight > 0) {
      return el.offsetHeight + 16;
    }
  }
  return 88;
}

/** Smooth-scrolls so the heading sits just below the sticky header. */
export function scrollToHeading(id: string): void {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const top = el.getBoundingClientRect().top + window.scrollY - stickyHeaderOffset();
  window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
}

/**
 * Id of the section currently being read: the last heading whose top has passed
 * the sticky header. IntersectionObserver fires when a heading crosses the band
 * under the header; the position is then read from the DOM.
 */
export function useActiveHeading(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join('|');

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
    const list = key ? key.split('|') : [];
    const els = list
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;

    const compute = () => {
      const offset = stickyHeaderOffset();
      let current = els[0].id;
      for (const el of els) {
        if (el.getBoundingClientRect().top - offset <= 1) current = el.id;
        else break;
      }
      setActive(current);
    };

    const observer = new IntersectionObserver(compute, {
      rootMargin: '-90px 0px -55% 0px',
      threshold: [0],
    });
    els.forEach((el) => observer.observe(el));
    compute();
    return () => observer.disconnect();
  }, [key]);

  return active;
}
