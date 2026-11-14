import { useMemo } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { useOrgInfo } from '../../../lib/org/OrgContext';
import { useOrg } from '../../../lib/convex/useOrg';
import { useTheme } from '../../../themes';
import { invalidateStorefront } from '../../../lib/cache/invalidateStorefront';
import { homepageSectionsFor, type HomepageSectionKey } from './sections';

// Single source for the homepage editor: live reads plus the write handlers.
// Every write purges the storefront cache once it lands.
export function useHomepageAdmin() {
  const { slug } = useOrgInfo();
  const { themeId } = useTheme();
  const org = useOrg();

  const componentRows = useQuery(api.content.listHomepageComponents, { orgSlug: slug });
  const slideRows = useQuery(api.adminCatalog.listHeroSlidesForAdmin, { orgSlug: slug });
  const collections = useQuery(api.catalog.listCollections, { orgSlug: slug });

  const setComponent = useMutation(api.adminCatalog.saveHomepageComponent);
  const saveSectionConfig = useMutation(api.adminCatalog.saveSectionConfig);
  const saveSlide = useMutation(api.adminCatalog.saveHeroSlide);
  const deleteSlide = useMutation(api.adminCatalog.deleteHeroSlide);

  const sections = useMemo(() => {
    return homepageSectionsFor(themeId).map((def) => {
      const row = (componentRows ?? []).find((c) => c.componentName === def.key);
      return {
        def,
        // Absent row = shown (the storefront treats a missing row as enabled).
        enabled: row?.isEnabled !== false,
        collectionId: row?.sectionId ?? null,
      };
    });
  }, [componentRows, themeId]);

  const setSectionEnabled = async (key: HomepageSectionKey, enabled: boolean) => {
    await setComponent({ orgSlug: slug, componentName: key, patch: { isEnabled: enabled } });
    void invalidateStorefront();
  };

  // null = latest products (the default). Explicit null clears the link.
  const setSectionCollection = async (key: HomepageSectionKey, collectionId: string | null) => {
    await setComponent({ orgSlug: slug, componentName: key, patch: { sectionId: collectionId } });
    void invalidateStorefront();
  };

  const setSectionHeading = async (key: HomepageSectionKey, title: string) => {
    await saveSectionConfig({ orgSlug: slug, sectionName: key, patch: { title } });
    void invalidateStorefront();
  };

  // Side image of the product showcase (Classic). Empty string clears it.
  const setSectionImage = async (key: HomepageSectionKey, backgroundImage: string) => {
    await saveSectionConfig({ orgSlug: slug, sectionName: key, patch: { backgroundImage } });
    void invalidateStorefront();
  };

  const setSlideActive = async (slide: { _id: Id<'heroSlides'>; sortOrder: number }, isActive: boolean) => {
    await saveSlide({ orgSlug: slug, id: slide._id, slide: { isActive, sortOrder: slide.sortOrder } });
    void invalidateStorefront();
  };

  // Writes only the order fields of each slide; every other field is left alone.
  const setSlideOrder = async (ordered: { _id: Id<'heroSlides'>; isActive: boolean }[]) => {
    await Promise.all(
      ordered.map((s, i) =>
        saveSlide({ orgSlug: slug, id: s._id, slide: { sortOrder: i, isActive: s.isActive } }),
      ),
    );
    void invalidateStorefront();
  };

  const removeSlide = async (id: Id<'heroSlides'>) => {
    await deleteSlide({ orgSlug: slug, id });
    void invalidateStorefront();
  };

  return {
    slug,
    themeId,
    storeId: org?._id,
    loading: componentRows === undefined || slideRows === undefined || collections === undefined,
    sections,
    slides: slideRows ?? [],
    collections: collections ?? [],
    saveSlide,
    setSectionEnabled,
    setSectionCollection,
    setSectionHeading,
    setSectionImage,
    setSlideActive,
    setSlideOrder,
    removeSlide,
  };
}
