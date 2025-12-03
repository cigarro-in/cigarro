import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Trash2, FolderTree, Plus, ChevronDown } from 'lucide-react';
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select(`
          *,
          product_categories(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const categoriesWithCount = data?.map(category => ({
        ...category,
        product_count: category.product_categories?.length || 0
      })) || [];

      setCategories(categoriesWithCount);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = () => {
    navigate('/admin/categories/new');
  };

  const handleEditCategory = (category: Category) => {
    navigate(`/admin/categories/${category.id}`);
  };

  const handleBulkDelete = async (categoryIds: string[]) => {
    if (!confirm(`Delete ${categoryIds.length} categories?`)) return;
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .in('id', categoryIds);

      if (error) throw error;
      toast.success(`${categoryIds.length} categories deleted`);
      setSelectedCategories([]);
      fetchCategories();
    } catch (error) {
      toast.error('Failed to delete categories');
    }
  };

  const handleBulkStatusChange = async (categoryIds: string[], isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ is_active: isActive })
        .in('id', categoryIds);

      if (error) throw error;
      toast.success(`${categoryIds.length} categories ${isActive ? 'activated' : 'deactivated'}`);
      setSelectedCategories([]);
      fetchCategories();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const columns = [
    {
      key: 'image',
      label: 'Image',
      render: (_: any, category: Category) => (
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
          {category.image ? (
            <ImageWithFallback
              src={category.image}
              alt="Category"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <FolderTree className="h-6 w-6 text-gray-400" />
            </div>
          )}
        </div>
      )
    },
    {
      key: 'name',
      label: 'Category Name',
      sortable: true,
      render: (name: string, category: Category) => (
        <div>
          <div className="font-medium text-gray-900">{name}</div>
          <div className="text-sm text-gray-500">{category.slug}</div>
        </div>
      )
    },
    {
      key: 'description',
      label: 'Description',
      render: (description: string | null) => (
        <div className="max-w-xs truncate text-sm text-gray-600">
          {description || 'No description'}
        </div>
      )
    },
    {
      key: 'product_count',
      label: 'Products',
      sortable: true,
      render: (count: number) => (
        <Badge variant="outline" className="bg-gray-50">
          {count} products
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
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (date: string) => new Date(date).toLocaleDateString()
    }
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
    <div className="min-h-screen bg-[var(--color-creme)]">
      <PageHeader 
        title="Categories" 
        description="Manage your product categories"
        search={{
          value: searchTerm,
          onChange: setSearchTerm,
          placeholder: "Search categories..."
        }}
      >
        {selectedCategories.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Actions ({selectedCategories.length})
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {bulkActions.map((action, idx) => (
                <DropdownMenuItem
                  key={idx}
                  onClick={() => action.onClick(selectedCategories)}
                  className={action.variant === 'destructive' ? 'text-red-600' : ''}
                >
                  {action.icon && <action.icon className="mr-2 h-4 w-4" />}
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button onClick={handleAddCategory} className="bg-[var(--color-canyon)] hover:bg-[var(--color-canyon)]/90 text-[var(--color-creme)]">
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </PageHeader>

      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <DataTable
          data={categories}
          columns={columns}
          loading={loading}
          selectedItems={selectedCategories}
          onSelectionChange={setSelectedCategories}
          bulkActions={bulkActions}
          onRowClick={handleEditCategory}
          searchTerm={searchTerm}
          hideToolbar={true}
        />
      </div>
    </div>
  );
}
