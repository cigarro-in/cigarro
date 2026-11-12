import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrgInfo } from '../../lib/org/OrgContext';
import { resolveStoreSettings, type RawStoreSettings, type StoreSettings } from '../../lib/storeSettings';

export type { StoreSettings, StoreAddress, StoreStateMinAge, RawStoreSettings } from '../../lib/storeSettings';
export { resolveStoreSettings } from '../../lib/storeSettings';

// Per-store settings for pages. Reads the public siteSettings fields via
// api.content.getSiteSettings; every missing value falls back to the defaults
// in src/config/site.ts (see resolveStoreSettings). Themes must not import
// this file: pass the settings down as props instead.

export function useStoreSettings(): { settings: StoreSettings; loading: boolean } {
  const { slug: orgSlug } = useOrgInfo();
  const row = useQuery(api.content.getSiteSettings, { orgSlug: orgSlug });
  return useMemo(
    () => ({
      settings: resolveStoreSettings(row as RawStoreSettings | null | undefined),
      loading: row === undefined,
    }),
    [row],
  );
}
