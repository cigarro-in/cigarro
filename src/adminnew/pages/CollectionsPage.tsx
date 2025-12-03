import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Trash2, FolderOpen, LayoutGrid, ArrowUpRight, Plus, ChevronDown } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';
import { DataTable } from '../components/shared/DataTable';
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
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('collections')
        .select(`
          *,
          collection_products(count)
        `)
        .order('title', { ascending: true });

      if (error) throw error;

      const collectionsWithCount = data?.map(collection => ({
        ...collection,
        products_count: collection.collection_products?.length || 0
      })) || [];

      setCollections(collectionsWithCount);
    } catch (error) {
      console.error('Error fetching collections:', error);
      toast.error('Failed to load collections');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCollection = () => {
    navigate('/admin/collections/new');
  };

  const handleEditCollection = (collection: Collection) => {
    navigate(`/admin/collections/${collection.id}`);
  };

  const handleBulkDelete = async (collectionIds: string[]) => {
    if (!confirm(`Delete ${collectionIds.length} collections?`)) return;
    try {
      const { error } = await supabase
        .from('collections')
        .delete()
        .in('id', collectionIds);

      if (error) throw error;
      toast.success(`${collectionIds.length} collections deleted`);
      setSelectedCollections([]);
      fetchCollections();
    } catch (error) {
      toast.error('Failed to delete collections');
    }
  };

  const handleBulkStatusChange = async (collectionIds: string[], isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('collections')
        .update({ is_active: isActive })
        .in('id', collectionIds);

      if (error) throw error;
      toast.success(`${collectionIds.length} collections ${isActive ? 'activated' : 'deactivated'}`);
      setSelectedCollections([]);
      fetchCollections();
    } catch (error) {
      toast.error('Failed to update status');
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
      sortable: true,
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
      sortable: true,
      render: (count: number) => (
        <Badge variant="outline" className="bg-gray-50">
          {count} products
        </Badge>
      )
    },
    {
      key: 'display_order',
      label: 'Order',
      sortable: true,
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
      label: 'Actions',
      render: (_: any, collection: Collection) => (
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`/collections/${collection.slug}`, '_blank');
            }}
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
        {selectedCollections.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Actions ({selectedCollections.length})
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {bulkActions.map((action, idx) => (
                <DropdownMenuItem
                  key={idx}
                  onClick={() => action.onClick(selectedCollections)}
                  className={action.variant === 'destructive' ? 'text-red-600' : ''}
                >
                  {action.icon && <action.icon className="mr-2 h-4 w-4" />}
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button onClick={handleAddCollection} className="bg-[var(--color-canyon)] hover:bg-[var(--color-canyon)]/90 text-[var(--color-creme)]">
          <Plus className="mr-2 h-4 w-4" />
          Add Collection
        </Button>
      </PageHeader>

      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <DataTable
          data={collections}
          columns={columns}
          loading={loading}
          selectedItems={selectedCollections}
          onSelectionChange={setSelectedCollections}
          bulkActions={bulkActions}
          onRowClick={handleEditCollection}
          searchTerm={searchTerm}
          hideToolbar={true}
        />
      </div>
    </div>
  );
}
