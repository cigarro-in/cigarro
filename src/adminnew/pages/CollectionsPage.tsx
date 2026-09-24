import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Trash2, FolderOpen, LayoutGrid, ArrowUpRight, Plus } from 'lucide-react';
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
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
          {collection.image_url ? (
            <ImageWithFallback
              src={collection.image_url}
              alt="Collection"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <LayoutGrid className="h-6 w-6 text-gray-400" />
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
          <div className="font-medium text-gray-900">{title}</div>
          <div className="text-sm text-gray-500">{collection.slug}</div>
        </div>
      )
    },
    {
      key: 'description',
      label: 'Description',
      render: (description: string | undefined) => (
        <div className="max-w-xs truncate text-sm text-gray-600">
          {description || 'No description'}
        </div>
      )
    },
    {
      key: 'products_count',
      label: 'Products',
      render: (count: number) => (
        <Badge variant="outline" className="bg-gray-50">
          {count} products
        </Badge>
      )
    },
    {
      key: 'display_order',
      label: 'Order',
      render: (order: number) => (
        <Badge variant="outline" className="bg-gray-50">
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
    {
      key: 'actions',
      label: 'Homepage',
      render: (_: any, collection: Collection) => (
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate('/admin/homepage');
            }}
            title="Link this collection to a homepage section"
            className="border-[var(--color-coyote)] hover:bg-[var(--color-creme)] text-[var(--color-dark)]"
          >
            <ArrowUpRight className="w-4 h-4" />
          </Button>
        </div>
      )
    }
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
    <div className="min-h-screen bg-[var(--color-creme)]">
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
        <Button onClick={handleAddCollection} className="bg-[var(--color-canyon)] hover:bg-[var(--color-canyon)]/90 text-[var(--color-creme)]">
          <Plus className="mr-2 h-4 w-4" />
          Add Collection
        </Button>
      </PageHeader>

      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
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
