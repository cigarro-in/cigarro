import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  // Initialize synchronously from matchMedia so the first render is already
  // correct (mobile clients must not flash the desktop dialog on mount).
  const [matches, setMatches] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
    // Safari before 14 exposes only the legacy MediaQueryList API.
    media.addListener(listener);
    return () => media.removeListener(listener);
  }, [query]);

  return matches;
}
