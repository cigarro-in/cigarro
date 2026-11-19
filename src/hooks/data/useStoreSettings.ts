import { useMemo } from 'react';
import { usePreloadedOrLive } from '../../lib/ssr/preload';
import { api } from '../../../convex/_generated/api';
import { useOrgInfo } from '../../lib/org/OrgContext';
import { resolveShareImage, resolveStoreSettings, type RawStoreSettings, type StoreSettings } from '../../lib/storeSettings';
import { useHeroSlides } from './useContent';

export type { StoreSettings, StoreAddress, StoreStateMinAge, RawStoreSettings } from '../../lib/storeSettings';
export { resolveStoreSettings } from '../../lib/storeSettings';

// Per-store settings for pages. Reads the public siteSettings fields via
// api.content.getSiteSettings; every missing value falls back to the defaults
// in src/config/site.ts (see resolveStoreSettings). Themes must not import
// this file: pass the settings down as props instead.

export function useStoreSettings(): { settings: StoreSettings; loading: boolean } {
  const org = useOrgInfo();
  const orgSlug = org.slug;
  const row = usePreloadedOrLive(api.content.getSiteSettings, { orgSlug: orgSlug });
  const storeName = org.siteName || org.name;
  return useMemo(
    () => ({
      settings: resolveStoreSettings(row as RawStoreSettings | null | undefined, {
        slug: orgSlug,
        storeName,
      }),
      loading: row === undefined,
    }),
    [row, orgSlug, storeName],
  );
}

// The store's link-preview image (absolute https URL or null). Resolution order
// lives in resolveShareImage (src/lib/storeSettings.ts): brand.shareImageUrl, the
// first hero slide, the logo, the site icon; /og-default.jpg only for the legacy store.
export function useStoreShareImage(): string | null {
  const org = useOrgInfo();
  const { settings } = useStoreSettings();
  const { slides } = useHeroSlides();
  return useMemo(
    () =>
      resolveShareImage(
        {
          shareImageUrl: settings.brand.shareImageUrl,
          heroImageUrl: slides[0]?.image_url ?? null,
          logoUrl: settings.brand.logoUrl,
          faviconUrl: settings.brand.faviconUrl,
        },
        { slug: org.slug, primaryHost: org.primaryHost },
      ),
    [settings.brand.shareImageUrl, settings.brand.logoUrl, settings.brand.faviconUrl, slides, org.slug, org.primaryHost],
  );
}
