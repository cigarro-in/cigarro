import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase/client';
import { themes, DEFAULT_THEME_ID, getTheme } from './registry';
import type { ThemeManifest } from './types';

const STORAGE_KEY = 'activeTheme';

interface ThemeContextValue {
  theme: ThemeManifest;
  themeId: string;
  availableThemes: ThemeManifest[];
  setTheme: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_THEME_ID;
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME_ID;
  });

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('site_settings')
      .select('active_theme')
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        const remote = (data as any)?.active_theme;
        if (remote && remote !== themeId && getTheme(remote)) {
          setThemeIdState(remote);
          localStorage.setItem(STORAGE_KEY, remote);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeId);
  }, [themeId]);

  const setTheme = (id: string) => {
    if (!getTheme(id)) return;
    setThemeIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
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
