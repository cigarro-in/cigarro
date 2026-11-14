// Homepage section order, shared by the storefront (themes render in this order)
// and the admin Homepage editor. Pure data and functions: no Convex, no React.
//
// The store keeps one ordered list of keys (siteSettings.homepageSectionOrder).
// A missing list means the default order below. Keys the active theme does not
// use are ignored; keys missing from a saved list are placed right after their
// default predecessor, so a new section never jumps to the end by accident.

export type HomepageThemeId = 'classic' | 'vivid';

export const DEFAULT_SECTION_ORDER: Record<HomepageThemeId, readonly string[]> = {
  // Classic renders the category strip, the category showcases and the category
  // grid as three separate blocks, so each has its own key.
  classic: [
    'hero_section',
    'categories_section',
    'featured_products',
    'brands_section',
    'category_showcases',
    'product_showcase',
    'categories_grid',
    'blog_section',
  ],
  // Vivid: the hero is pinned above the sidebar layout (see resolveSectionOrder).
  vivid: [
    'hero_section',
    'featured_products',
    'product_showcase',
    'categories_section',
    'brands_section',
    'blog_section',
  ],
};

// Classic-only blocks whose on/off state falls back to the category strip row
// when the store has never set their own row (keeps existing stores unchanged).
const ENABLED_FALLBACK: Record<string, string> = {
  category_showcases: 'categories_section',
  categories_grid: 'categories_section',
};

export function toHomepageThemeId(themeId: string): HomepageThemeId {
  return themeId === 'vivid' ? 'vivid' : 'classic';
}

export function resolveSectionOrder(themeId: string, saved?: readonly string[] | null): string[] {
  const theme = toHomepageThemeId(themeId);
  const defaults = DEFAULT_SECTION_ORDER[theme];
  const allowed = new Set<string>(defaults);

  const out: string[] = [];
  for (const key of saved ?? []) {
    if (allowed.has(key) && !out.includes(key)) out.push(key);
  }

  // Insert keys missing from the saved list after their default predecessor.
  defaults.forEach((key, index) => {
    if (out.includes(key)) return;
    const prev = index > 0 ? defaults[index - 1] : null;
    const at = prev ? out.indexOf(prev) + 1 : 0;
    out.splice(at, 0, key);
  });

  if (theme === 'vivid') {
    // Vivid draws the hero above the sidebar layout, so it always leads.
    const hero = out.indexOf('hero_section');
    if (hero > 0) {
      out.splice(hero, 1);
      out.unshift('hero_section');
    }
  }
  return out;
}

export interface HomepageComponentRow {
  componentName: string;
  isEnabled?: boolean;
}

// Absent row = shown. Some blocks fall back to another row (see ENABLED_FALLBACK).
export function isHomepageSectionEnabled(
  rows: readonly HomepageComponentRow[] | null | undefined,
  key: string,
): boolean {
  const find = (name: string) => (rows ?? []).find((r) => r.componentName === name);
  const own = find(key);
  if (own) return own.isEnabled !== false;
  const fallback = ENABLED_FALLBACK[key];
  if (fallback) return find(fallback)?.isEnabled !== false;
  return true;
}
