import React, { useEffect, useState } from 'react';
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
 * One page instance. Whether it fades in is decided once, when it mounts, and
 * kept for its lifetime. Reading the module flag on every render made the first
 * page gain `animate-fade-in` on its first re-render after hydration (store
 * settings, age-gate check), which blanked the whole page to opacity 0 and
 * faded it back in on every page load.
 */
function PageFrame({ children }: PageTransitionProps) {
  const [animate] = useState(() => firstPageMounted);

  useEffect(() => {
    firstPageMounted = true;
  }, []);

  return <div className={animate ? 'w-full relative animate-fade-in' : 'w-full relative'}>{children}</div>;
}

/**
 * Remounts the page on each pathname change and fades later pages in with a
 * CSS opacity animation (compositor-only; no animation library on the boot path).
 */
export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();

  return (
    <>
      <SmoothScrollToTop />
      <PageFrame key={location.pathname}>{children}</PageFrame>
    </>
  );
}
