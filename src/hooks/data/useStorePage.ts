import { api } from '../../../convex/_generated/api';
import { usePreloadedOrLive } from '../../lib/ssr/preload';
import { useOrgInfo } from '../../lib/org/OrgContext';
import type { StorePageSlug } from '../../lib/storePages/catalog';

// Published admin override for a built-in store page, or null when the page
// should render its built-in content (no row, unpublished, or still loading).
export interface StoredPage {
  slug: string;
  title: string;
  body: string;
  metaTitle: string | null;
  metaDescription: string | null;
  updatedAt: number;
}

export function useStorePage(slug: StorePageSlug): StoredPage | null {
  const { slug: orgSlug } = useOrgInfo();
  const row = usePreloadedOrLive(api.storePages.getBySlug, { orgSlug, slug });
  return (row as StoredPage | null | undefined) ?? null;
}
