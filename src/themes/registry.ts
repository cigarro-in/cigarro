import type { ThemeManifest } from './types';
import { classicTheme } from './classic';
import { vividTheme } from './vivid';

export const themes: ThemeManifest[] = [classicTheme, vividTheme];

export const DEFAULT_THEME_ID = classicTheme.id;

export function getTheme(id: string): ThemeManifest | undefined {
  return themes.find((t) => t.id === id);
}
