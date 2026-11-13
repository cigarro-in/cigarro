import { useMemo } from 'react';
import { FolderTree, Plus } from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { ORG_SLUG } from '../../lib/convex/org';
import { CatalogListView, type CatalogListRow } from '../features/catalog/CatalogListView';

export function CategoriesPage() {
  const rows = useQuery(api.adminCatalog.listCategoriesForAdmin, { orgSlug: ORG_SLUG });
  const removeCategory = useMutation(api.adminCatalog.deleteCategory);
  const setActive = useMutation(api.adminCatalog.setCategoriesActive);

  const list = useMemo<CatalogListRow[] | undefined>(
    () =>
      rows?.map((c: any) => ({
        id: c.supabaseId,
        name: c.name,
        slug: c.slug,
        image: c.image ?? null,
        productCount: c.product_count ?? 0,
        isActive: c.isActive !== false,
      })),
    [rows],
  );

  return (
    <CatalogListView<CatalogListRow>
      noun="category"
      plural="categories"
      title="Categories"
      icon={<FolderTree />}
      rows={list}
      openPath={(id) => `/categories/${id}`}
      newAction={{ label: 'Add category', to: '/categories/new', icon: <Plus /> }}
      searchPlaceholder="Search categories"
      onRemove={(id) => removeCategory({ supabaseId: id, orgSlug: ORG_SLUG })}
      onSetActive={(ids, isActive) => setActive({ supabaseIds: ids, isActive, orgSlug: ORG_SLUG })}
    />
  );
}
