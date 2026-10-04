import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Trash2, LayoutGrid, Plus } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { ORG_SLUG } from '../../lib/convex/org';
import { useInlineStatus, InlineStatus } from '../../components/common/InlineStatus';
import { DataTable } from '../components/shared/DataTable';
import { BulkActionsMenu } from '../components/shared/BulkActionsMenu';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback';
import { PageHeader } from '../components/shared/PageHeader';

interface Collection {
  id: string;
  title: string;
  slug: string;
  description?: string;
  image_url?: string;
  is_active: boolean;
  display_order: number;
  products_count?: number;
}

export function CollectionsPage() {
  const navigate = useNavigate();
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const { status: opStatus, setError: setOpError, setOk: setOpOk } = useInlineStatus();

  const rows = useQuery(api.adminCatalog.listCollectionsForAdmin, { orgSlug: ORG_SLUG });
  const removeCollection = useMutation(api.adminCatalog.deleteCollection);
  const setActive = useMutation(api.adminCatalog.setCollectionsActive);

  const collections: Collection[] = (rows || []).map((c: any) => ({
    id: c.supabaseId,
    title: c.title,
    slug: c.slug,
    description: c.description,
    image_url: c.imageUrl,
    is_active: c.isActive,
    display_order: c.sortOrder ?? 0,
    products_count: c.product_count,
  }));
  const loading = rows === undefined;

  const handleAddCollection = () => {
    navigate('/admin/collections/new');
  };

  const handleEditCollection = (collection: Collection) => {
    navigate(`/admin/collections/${collection.id}`);
  };

  const handleBulkDelete = async (collectionIds: string[]) => {
    if (!confirm(`Delete ${collectionIds.length} collections?`)) return;
    try {
      for (const supabaseId of collectionIds) {
        await removeCollection({ supabaseId, orgSlug: ORG_SLUG });
      }
      setOpOk(`${collectionIds.length} collections deleted`);
      setSelectedCollections([]);
    } catch (error: any) {
      setOpError(error?.data?.code === 'NOT_CATALOG_ADMIN' ? 'Admin access required' : 'Failed to delete collections');
    }
  };

  const handleBulkStatusChange = async (collectionIds: string[], isActive: boolean) => {
    try {
      await setActive({ supabaseIds: collectionIds, isActive, orgSlug: ORG_SLUG });
      setOpOk(`${collectionIds.length} collections ${isActive ? 'activated' : 'deactivated'}`);
      setSelectedCollections([]);
    } catch (error: any) {
      setOpError(error?.data?.code === 'NOT_CATALOG_ADMIN' ? 'Admin access required' : 'Failed to update status');
    }
  };

  const columns = [
    {
      key: 'image_url',
      label: 'Image',
      render: (_: any, collection: Collection) => (
        <div className="size-10 overflow-hidden rounded-md bg-muted">
          {collection.image_url ? (
            <ImageWithFallback
              src={collection.image_url}
              alt="Collection"
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <LayoutGrid className="size-4 text-muted-foreground" />
            </div>
          )}
        </div>
      )
    },
    {
      key: 'title',
      label: 'Collection Name',
      render: (title: string, collection: Collection) => (
        <div>
          <div className="font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">{collection.slug}</div>
        </div>
      )
    },
    {
      key: 'products_count',
      label: 'Products',
      render: (count: number) => (
        <Badge variant="secondary">
          {count}
        </Badge>
      )
    },
    {
      key: 'display_order',
      label: 'Order',
      render: (order: number) => (
        <Badge variant="outline">
          #{order}
        </Badge>
      )
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (isActive: boolean) => (
        <Badge variant={isActive ? 'default' : 'secondary'}>
          {isActive ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
  ];

  const bulkActions = [
    {
      label: 'Activate Selected',
      icon: Eye,
      onClick: (collectionIds: string[]) => handleBulkStatusChange(collectionIds, true)
    },
    {
      label: 'Deactivate Selected',
      icon: EyeOff,
      onClick: (collectionIds: string[]) => handleBulkStatusChange(collectionIds, false)
    },
    {
      label: 'Delete Selected',
      icon: Trash2,
      onClick: handleBulkDelete,
      variant: 'destructive' as const
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader 
        title="Collections" 
        description="Manage your product collections"
        search={{
          value: searchTerm,
          onChange: setSearchTerm,
          placeholder: "Search collections..."
        }}
      >
        <BulkActionsMenu selectedIds={selectedCollections} actions={bulkActions} />
        <Button variant="outline" onClick={() => navigate('/admin/homepage')}>Homepage</Button>
        <Button onClick={handleAddCollection}>
          <Plus className="mr-2 h-4 w-4" />
          Add Collection
        </Button>
      </PageHeader>

      <div className="mx-auto flex max-w-400 flex-col gap-4 px-4 py-4 sm:px-6">
        <InlineStatus status={opStatus} />
        <DataTable
          data={collections}
          columns={columns}
          loading={loading}
          selectedItems={selectedCollections}
          onSelectionChange={setSelectedCollections}
          onRowClick={handleEditCollection}
          searchTerm={searchTerm}
        />
      </div>
    </div>
  );
}
