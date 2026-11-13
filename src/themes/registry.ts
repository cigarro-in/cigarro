import type { ThemeManifest } from './types';
import { classicTheme } from './classic';
import { vividTheme } from './vivid';

export const themes: ThemeManifest[] = [classicTheme, vividTheme];

export const DEFAULT_THEME_ID = classicTheme.id;

export function getTheme(id: string): ThemeManifest | undefined {
  return themes.find((t) => t.id === id);
}

/** Returns `id` if it names a registered theme, otherwise the default. Pure; safe on the server. */
export function resolveThemeId(id: string | null | undefined): string {
  return id && getTheme(id) ? id : DEFAULT_THEME_ID;
}

/** Attributes to put on <html> for a theme. Pure; the server entry can use it to render the same markup. */
export function themeHtmlAttrs(themeId: string): { 'data-theme': string } {
  return { 'data-theme': resolveThemeId(themeId) };
}
