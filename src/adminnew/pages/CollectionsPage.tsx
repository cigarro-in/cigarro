import { useMemo } from 'react';
import { LayoutGrid, Plus } from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { ORG_SLUG } from '../../lib/convex/org';
import { CatalogListView, type CatalogListRow } from '../features/catalog/CatalogListView';
import { Badge, type Column } from '../ui';

interface CollectionRow extends CatalogListRow {
  sortOrder: number;
}

const orderColumn: Column<CollectionRow> = {
  id: 'order',
  header: 'Order',
  width: 'w-20',
  hideBelow: 'md',
  cell: (r) => <Badge>#{r.sortOrder}</Badge>,
};

export function CollectionsPage() {
  const rows = useQuery(api.adminCatalog.listCollectionsForAdmin, { orgSlug: ORG_SLUG });
  const removeCollection = useMutation(api.adminCatalog.deleteCollection);
  const setActive = useMutation(api.adminCatalog.setCollectionsActive);

  const list = useMemo<CollectionRow[] | undefined>(
    () =>
      rows?.map((c: any) => ({
        id: c.supabaseId,
        name: c.title,
        slug: c.slug,
        image: c.imageUrl ?? null,
        productCount: c.product_count ?? 0,
        isActive: c.isActive !== false,
        sortOrder: c.sortOrder ?? 0,
      })),
    [rows],
  );

  return (
    <CatalogListView<CollectionRow>
      noun="collection"
      plural="collections"
      title="Collections"
      icon={<LayoutGrid />}
      rows={list}
      columns={[orderColumn]}
      openPath={(id) => `/collections/${id}`}
      newAction={{ label: 'Add collection', to: '/collections/new', icon: <Plus /> }}
      secondaryActions={[{ label: 'Homepage', to: '/homepage' }]}
      searchPlaceholder="Search collections"
      onRemove={(id) => removeCollection({ supabaseId: id, orgSlug: ORG_SLUG })}
      onSetActive={(ids, isActive) => setActive({ supabaseIds: ids, isActive, orgSlug: ORG_SLUG })}
    />
  );
}
