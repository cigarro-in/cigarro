import { writeStoredPreference } from '../lib/browserStorage';
import { createContext, startTransition, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSiteSettings } from '../hooks/data/useContent';
import { themes, DEFAULT_THEME_ID, getTheme, themeHtmlAttrs } from './registry';
import type { ThemeManifest } from './types';

const STORAGE_KEY = 'activeTheme';

interface ThemeContextValue {
  theme: ThemeManifest;
  themeId: string;
  availableThemes: ThemeManifest[];
  setTheme: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ProviderProps {
  children: ReactNode;
  /** Theme chosen by the server render. Wins over the edge-injected and default themes. */
  initialThemeId?: string;
  /**
   * Write the theme to <html data-theme>. False on the admin host: the admin
   * still reads/sets the store's theme (Settings) but never wears it.
   */
  applyToDocument?: boolean;
}

/**
 * Edge-injected theme id (window.__ORG__.themeId). Read synchronously so that a
 * client-only render gets the right theme before the Convex query resolves.
 * Returns undefined on the server, where there is no window.
 */
function readEdgeThemeId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const org = (window as Window & { __ORG__?: { themeId?: string | null } }).__ORG__;
  return org?.themeId ?? undefined;
}

export function ThemeProvider({ children, initialThemeId, applyToDocument = true }: ProviderProps) {
  // Render-safe: no storage access here. The first valid candidate wins, else the default.
  const [themeId, setThemeIdState] = useState<string>(() => {
    const candidates = [initialThemeId, readEdgeThemeId()];
    const found = candidates.find((id) => id && getTheme(id));
    return found ?? DEFAULT_THEME_ID;
  });

  const { settings } = useSiteSettings();

  // Live switch to the Convex active theme after mount. Only changes state when it differs.
  useEffect(() => {
    const remote = settings?.active_theme;
    if (!remote || !getTheme(remote)) return;
    // Transition: runs during/after hydration; see App.tsx AppContent (#421).
    startTransition(() => setThemeIdState((current) => (current === remote ? current : remote)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on the remote value only
  }, [settings?.active_theme]);

  // Client-only side effects.
  useEffect(() => {
    if (!applyToDocument) return;
    const attrs = themeHtmlAttrs(themeId);
    for (const [name, value] of Object.entries(attrs)) {
      document.documentElement.setAttribute(name, value);
    }
    writeStoredPreference(STORAGE_KEY, themeId);
  }, [themeId, applyToDocument]);

  const setTheme = (id: string) => {
    if (!getTheme(id)) return;
    setThemeIdState(id);
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: getTheme(themeId) || getTheme(DEFAULT_THEME_ID)!,
      themeId,
      availableThemes: themes,
      setTheme,
    }),
    [themeId]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
