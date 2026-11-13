import { useLayoutEffect, type ReactNode } from 'react';
import './styles/admin.css';

/**
 * Root of every admin-host surface (store admin, admin login, super-admin).
 *
 * Puts `admin-root` on <html> before first paint so the admin tokens in
 * styles/admin.css apply to the page and to Radix portals, and strips any
 * storefront `data-theme` so classic/vivid tokens never reach the admin.
 * This module (and its CSS) is only loaded by the admin host bundles.
 */
export function AdminRoot({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    const html = document.documentElement;
    html.classList.add('admin-root');
    html.removeAttribute('data-theme');
    document.body.classList.add('admin-page');
    return () => {
      html.classList.remove('admin-root');
    };
  }, []);
  return <>{children}</>;
}
