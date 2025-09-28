import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff, Layers, Image as ImageIcon } from 'lucide-react';
import { Switch } from '../../../components/ui/switch';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '../../../utils/supabase/client';
import { DataTable } from '../../components/shared/DataTable';
import { StandardModal } from '../../components/shared/StandardModal';
import { CategoryForm } from './index';
import { ImageWithFallback } from '../../../components/figma/ImageWithFallback';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  image_alt_text: string;
  is_active: boolean;
  product_count: number;
  created_at: string;
  updated_at: string;
}

export function CategoriesManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categoryIsActive, setCategoryIsActive] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get product count for each category
      const categoriesWithCount = await Promise.all(
        (data || []).map(async (category) => {
          const { count } = await supabase
            .from('product_categories')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', category.id);

          return {
            ...category,
            product_count: count || 0
          };
        })
      );

      setCategories(categoriesWithCount);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = () => {
    setEditingCategory(null);
    setShowCategoryModal(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setShowCategoryModal(true);
  };

  const handleDeleteCategory = async (category: Category) => {
    if (!confirm(`Are you sure you want to delete "${category.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', category.id);

      if (error) throw error;
      
      toast.success('Category deleted successfully');
      fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Failed to delete category');
    }
  };

  const handleToggleStatus = async (category: Category) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ is_active: !category.is_active })
        .eq('id', category.id);

      if (error) throw error;
      
      toast.success(`Category ${category.is_active ? 'deactivated' : 'activated'} successfully`);
      fetchCategories();
    } catch (error) {
      console.error('Error updating category status:', error);
      toast.error('Failed to update category status');
    }
  };

  const handleBulkDelete = async (categoryIds: string[]) => {
    if (!confirm(`Are you sure you want to delete ${categoryIds.length} categories?`)) return;

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .in('id', categoryIds);

      if (error) throw error;
      
      toast.success(`${categoryIds.length} categories deleted successfully`);
      setSelectedCategories([]);
      fetchCategories();
    } catch (error) {
      console.error('Error deleting categories:', error);
      toast.error('Failed to delete categories');
    }
  };

  const columns = [
    {
      key: 'image',
      label: 'Image',
      render: (image: string, category: Category) => (
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
          {image ? (
            <ImageWithFallback
              src={image}
              alt={category.image_alt_text || category.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-6 w-6 text-gray-400" />
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
          <div className="text-sm text-gray-500">/{category.slug}</div>
        </div>
      )
    },
    {
      key: 'description',
      label: 'Description',
      render: (description: string) => (
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
        <Badge variant="outline">
          {count} product{count !== 1 ? 's' : ''}
        </Badge>
      )
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (isActive: boolean, category: Category) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleStatus(category)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              isActive 
                ? 'bg-canyon/20 text-canyon hover:bg-canyon/30' 
                : 'bg-coyote/20 text-dark/70 hover:bg-coyote/30'
            }`}
          >
            {isActive ? 'Active' : 'Inactive'}
          </Button>
        </div>
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
      label: 'Delete Selected',
      icon: Trash2,
      onClick: handleBulkDelete,
      variant: 'destructive' as const
    }
  ];

  const filters = [
    {
      key: 'is_active',
      label: 'Status',
      options: [
        { value: 'true', label: 'Active' },
        { value: 'false', label: 'Inactive' }
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark">Categories</h1>
          <p className="text-dark/70">Organize your products into categories</p>
        </div>
      </div>

      <DataTable
        title="Category Management"
        data={categories}
        columns={columns}
        onAdd={handleAddCategory}
        addButtonLabel="Add Category"
        searchPlaceholder="Search categories..."
        filters={filters}
        loading={loading}
        selectedItems={selectedCategories}
        onSelectionChange={setSelectedCategories}
        bulkActions={bulkActions}
        onRowClick={handleEditCategory}
      />

      <StandardModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title={editingCategory ? 'Edit Category' : 'Add New Category'}
        size="lg"
      >
        <CategoryForm
          category={editingCategory}
          onSave={() => {
            setShowCategoryModal(false);
            fetchCategories();
          }}
          onCancel={() => setShowCategoryModal(false)}
          onDelete={handleDeleteCategory}
        />
      </StandardModal>
    </div>
  );
}
