import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SmoothScrollToTop } from './SmoothScrollToTop';

interface PageTransitionProps {
  children: React.ReactNode;
}

// Set once the first page has mounted. The first page (server-rendered or the
// initial SPA mount) gets no fade, so its markup matches the server render and
// nothing delays first paint; later client navigations fade in.
let firstPageMounted = false;

/**
 * Remounts the page on each pathname change and fades later pages in with a
 * CSS opacity animation (compositor-only; no animation library on the boot path).
 */
export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const animate = firstPageMounted;

  useEffect(() => {
    firstPageMounted = true;
  }, []);

  return (
    <>
      <SmoothScrollToTop />
      <div key={location.pathname} className={animate ? 'w-full relative animate-fade-in' : 'w-full relative'}>
        {children}
      </div>
    </>
  );
}
