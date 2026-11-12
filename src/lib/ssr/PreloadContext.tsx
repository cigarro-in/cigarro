import { createContext, useMemo, type ReactNode } from 'react';
import type { PreloadMap } from './preload';

// Request-scoped preload map. Server render wraps the app in this provider;
// on the client there is no provider and hooks fall back to window.__PRELOAD__.
export const PreloadContext = createContext<{ map: PreloadMap | null }>({ map: null });

export function PreloadProvider({ map, children }: { map: PreloadMap; children: ReactNode }) {
  const value = useMemo(() => ({ map }), [map]);
  return <PreloadContext.Provider value={value}>{children}</PreloadContext.Provider>;
}
