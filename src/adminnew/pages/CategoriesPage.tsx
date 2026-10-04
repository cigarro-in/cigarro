import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Trash2, FolderTree, Plus } from 'lucide-react';
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

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  created_at: string;
  is_active: boolean;
  product_count?: number;
}

export function CategoriesPage() {
  const navigate = useNavigate();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const { status: opStatus, setError: setOpError, setOk: setOpOk } = useInlineStatus();

  const rows = useQuery(api.adminCatalog.listCategoriesForAdmin, { orgSlug: ORG_SLUG });
  const removeCategory = useMutation(api.adminCatalog.deleteCategory);
  const setActive = useMutation(api.adminCatalog.setCategoriesActive);

  const categories: Category[] = (rows || []).map((c: any) => ({
    id: c.supabaseId,
    name: c.name,
    slug: c.slug,
    description: c.description ?? null,
    image: c.image ?? null,
    created_at: c.createdAt ? new Date(c.createdAt).toISOString() : '',
    is_active: c.isActive ?? true,
    product_count: c.product_count,
  }));
  const loading = rows === undefined;

  const handleAddCategory = () => {
    navigate('/admin/categories/new');
  };

  const handleEditCategory = (category: Category) => {
    navigate(`/admin/categories/${category.id}`);
  };

  const handleBulkDelete = async (categoryIds: string[]) => {
    if (!confirm(`Delete ${categoryIds.length} categories?`)) return;
    try {
      for (const supabaseId of categoryIds) {
        await removeCategory({ supabaseId, orgSlug: ORG_SLUG });
      }
      setOpOk(`${categoryIds.length} categories deleted`);
      setSelectedCategories([]);
    } catch (error: any) {
      setOpError(error?.data?.code === 'NOT_CATALOG_ADMIN' ? 'Admin access required' : 'Failed to delete categories');
    }
  };

  const handleBulkStatusChange = async (categoryIds: string[], isActive: boolean) => {
    try {
      await setActive({ supabaseIds: categoryIds, isActive, orgSlug: ORG_SLUG });
      setOpOk(`${categoryIds.length} categories ${isActive ? 'activated' : 'deactivated'}`);
      setSelectedCategories([]);
    } catch (error: any) {
      setOpError(error?.data?.code === 'NOT_CATALOG_ADMIN' ? 'Admin access required' : 'Failed to update status');
    }
  };

  const columns = [
    {
      key: 'image',
      label: 'Image',
      render: (_: any, category: Category) => (
        <div className="size-10 overflow-hidden rounded-md bg-muted">
          {category.image ? (
            <ImageWithFallback
              src={category.image}
              alt="Category"
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <FolderTree className="size-4 text-muted-foreground" />
            </div>
          )}
        </div>
      )
    },
    {
      key: 'name',
      label: 'Category Name',
      render: (name: string, category: Category) => (
        <div>
          <div className="font-medium">{name}</div>
          <div className="text-xs text-muted-foreground">{category.slug}</div>
        </div>
      )
    },
    {
      key: 'product_count',
      label: 'Products',
      render: (count: number) => (
        <Badge variant="secondary">
          {count}
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
      onClick: (categoryIds: string[]) => handleBulkStatusChange(categoryIds, true)
    },
    {
      label: 'Deactivate Selected',
      icon: EyeOff,
      onClick: (categoryIds: string[]) => handleBulkStatusChange(categoryIds, false)
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
        title="Categories" 
        description="Manage your product categories"
        search={{
          value: searchTerm,
          onChange: setSearchTerm,
          placeholder: "Search categories..."
        }}
      >
        <BulkActionsMenu selectedIds={selectedCategories} actions={bulkActions} />
        <Button onClick={handleAddCategory}>
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </PageHeader>

      <div className="mx-auto flex max-w-400 flex-col gap-4 px-4 py-4 sm:px-6">
        <InlineStatus status={opStatus} />
        <DataTable
          data={categories}
          columns={columns}
          loading={loading}
          selectedItems={selectedCategories}
          onSelectionChange={setSelectedCategories}
          onRowClick={handleEditCategory}
          searchTerm={searchTerm}
        />
      </div>
    </div>
  );
}
