// Request-scoped store identity. The SPA receives it from the provider in
// main.tsx; on the server (SSR, later slices) each request supplies its own
// value, so nothing here is a module singleton.
//
// getClientOrgInfo() derives the value from window.__ORG__ (injected by the
// edge, functions/_middleware.js) and window.location. It is the client's
// source of truth and must not be called on the server.

import { createContext, useContext, type ReactNode } from 'react';
import { LEGACY_ORG_SLUG } from './legacyOrg';

export interface OrgInfo {
  slug: string;
  id?: string;
  name: string;
  primaryHost: string;
  siteName?: string;
  /** admin.<root> host (store admin, or the /sa super-admin app). */
  isAdminHost: boolean;
  /** Citadel super-admin app (/sa on the admin host). No store. */
  isSa: boolean;
  /** React Router basename ('' everywhere except the admin store path). */
  basename: string;
}

const ADMIN_RESERVED_SEGMENTS = new Set(['api', 'assets', 'icons', 'fonts', 'functions', 'admin', 'sa']);
const STORE_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;

export function getClientOrgInfo(): OrgInfo {
  const hasWindow = typeof window !== 'undefined';
  const org = hasWindow ? window.__ORG__ : undefined;
  const loc = hasWindow ? window.location : undefined;

  const isAdminHost = !!loc && loc.hostname.split('.')[0] === 'admin';
  const isSa = isAdminHost && !!loc && (loc.pathname === '/sa' || loc.pathname.startsWith('/sa/'));

  // Admin host (admin.<root>/<storeSlug>/...): the store is the first path
  // segment, read from the URL so an offline-cached shell still resolves it.
  // Mirrors adminStoreFromPath in functions/lib/org.js.
  let adminPathStore: string | null = null;
  if (isAdminHost && loc) {
    const first = loc.pathname.split('/')[1] || '';
    adminPathStore = STORE_SLUG_RE.test(first) && !ADMIN_RESERVED_SEGMENTS.has(first) ? first : null;
  }

  const slug =
    adminPathStore ||
    org?.slug ||
    import.meta.env?.VITE_ORG_SLUG ||
    LEGACY_ORG_SLUG;

  const primaryHost = org?.primaryHost || (loc ? loc.host : '');

  return {
    slug,
    id: org?.id ?? undefined,
    name: org?.name ?? '',
    primaryHost,
    siteName: (org as { siteName?: string | null } | undefined)?.siteName ?? undefined,
    isAdminHost,
    isSa,
    basename: adminPathStore ? `/${adminPathStore}` : '',
  };
}

const OrgInfoContext = createContext<OrgInfo | null>(null);

export function OrgProvider({ org, children }: { org: OrgInfo; children: ReactNode }) {
  return <OrgInfoContext.Provider value={org}>{children}</OrgInfoContext.Provider>;
}

export function useOrgInfo(): OrgInfo {
  const value = useContext(OrgInfoContext);
  if (!value) throw new Error('useOrgInfo() must be used inside <OrgProvider>');
  return value;
}
