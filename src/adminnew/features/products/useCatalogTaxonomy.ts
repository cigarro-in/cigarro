import { useCallback, useMemo } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { generateSlug } from '../../../types/product';

export interface TaxonomyOption {
  /** supabaseId: what product rows and joins reference. */
  id: string;
  label: string;
  active: boolean;
}

/**
 * Brands, categories and collections of the active store as picker options,
 * plus in-place creators (slug derived from the typed name). Each creator
 * resolves to the new entity's supabaseId; Convex errors propagate with
 * their `data.code` so callers can show them inline.
 */
export function useCatalogTaxonomy(orgSlug: string) {
  const brandRows = useQuery(api.catalog.listBrands, { activeOnly: false, orgSlug });
  const categoryRows = useQuery(api.catalog.listCategories, { orgSlug });
  const collectionRows = useQuery(api.catalog.listCollections, { orgSlug });

  const createBrandM = useMutation(api.adminCatalog.createBrand);
  const createCategoryM = useMutation(api.adminCatalog.createCategory);
  const saveCollectionM = useMutation(api.adminCatalog.saveCollection);

  const brands = useMemo<TaxonomyOption[] | undefined>(
    () =>
      brandRows
        ?.map((b: any) => ({ id: b.supabaseId as string, label: b.name as string, active: b.isActive !== false }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [brandRows],
  );
  const categories = useMemo<TaxonomyOption[] | undefined>(
    () =>
      categoryRows
        ?.map((c: any) => ({ id: c.supabaseId as string, label: c.name as string, active: c.isActive !== false }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [categoryRows],
  );
  const collections = useMemo<TaxonomyOption[] | undefined>(
    () =>
      collectionRows
        ?.map((c: any) => ({ id: c.supabaseId as string, label: c.title as string, active: c.isActive !== false }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [collectionRows],
  );

  const createBrand = useCallback(
    async (name: string) => {
      const clean = name.trim();
      const res = await createBrandM({ orgSlug, name: clean, slug: generateSlug(clean), isActive: true });
      return res.supabaseId;
    },
    [createBrandM, orgSlug],
  );
  const createCategory = useCallback(
    async (name: string) => {
      const clean = name.trim();
      const res = await createCategoryM({ orgSlug, name: clean, slug: generateSlug(clean) });
      return res.supabaseId;
    },
    [createCategoryM, orgSlug],
  );
  const createCollection = useCallback(
    async (title: string) => {
      const clean = title.trim();
      const res = await saveCollectionM({
        orgSlug,
        collection: { title: clean, slug: generateSlug(clean), isActive: true },
      });
      return res.supabaseId;
    },
    [saveCollectionM, orgSlug],
  );

  return { brands, categories, collections, createBrand, createCategory, createCollection };
}
