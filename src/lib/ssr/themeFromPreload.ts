import { DEFAULT_THEME_ID, resolveThemeId } from '../../themes/registry';
import { preloadKey, type PreloadMap } from './preload';

// Theme for a page render: the store's active_theme from its preloaded site
// settings. Used by the server render and by the client hydrate, so both start
// from the same theme (hydration must match). Pure; runs on server and client.
export function themeIdFromPreload(preload: PreloadMap, slug: string): string {
  // Raw Convex row (camelCase): the field useSiteSettings maps to active_theme.
  const settings = preload[preloadKey('content:getSiteSettings', { orgSlug: slug })] as
    | { activeTheme?: string | null }
    | null
    | undefined;
  return resolveThemeId(settings?.activeTheme ?? DEFAULT_THEME_ID);
}
