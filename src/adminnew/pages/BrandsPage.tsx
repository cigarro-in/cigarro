import { useMemo } from 'react';
import { Building2, Plus } from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { ORG_SLUG } from '../../lib/convex/org';
import { CatalogListView, type CatalogListRow } from '../features/catalog/CatalogListView';

export function BrandsPage() {
  const rows = useQuery(api.adminCatalog.listBrandsForAdmin, { orgSlug: ORG_SLUG });
  const removeBrand = useMutation(api.adminCatalog.deleteBrand);
  const setActive = useMutation(api.adminCatalog.setBrandsActive);

  const list = useMemo<CatalogListRow[] | undefined>(
    () =>
      rows?.map((b: any) => ({
        id: b.supabaseId,
        name: b.name,
        slug: b.slug,
        image: b.logoUrl ?? null,
        productCount: b.product_count ?? 0,
        isActive: b.isActive !== false,
      })),
    [rows],
  );

  return (
    <CatalogListView<CatalogListRow>
      noun="brand"
      plural="brands"
      title="Brands"
      icon={<Building2 />}
      rows={list}
      openPath={(id) => `/brands/${id}`}
      newAction={{ label: 'Add brand', to: '/brands/new', icon: <Plus /> }}
      searchPlaceholder="Search brands"
      onRemove={(id) => removeBrand({ supabaseId: id, orgSlug: ORG_SLUG })}
      onSetActive={(ids, isActive) => setActive({ supabaseIds: ids, isActive, orgSlug: ORG_SLUG })}
    />
  );
}
