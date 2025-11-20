import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function SmoothScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Use requestAnimationFrame to ensure the DOM has updated
    // and to make the scroll happen in the next paint frame
    requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'instant' // Use instant to avoid fighting with animations, or 'smooth' if preferred
      });
    });
  }, [pathname]);

  return null;
}
