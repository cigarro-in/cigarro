import React, { useState, useEffect } from 'react';
import { Settings, Package, Tags, Building2, FileText, BarChart3, Users, ShoppingCart, Percent, Settings as SettingsIcon } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

// Import refactored components
import { DashboardAnalyticsCards } from './components/dashboard/analytics/DashboardAnalyticsCards';
import { DashboardOverviewTab } from './components/dashboard/overview/DashboardOverviewTab';
import { DashboardProductsTab } from './components/dashboard/products/DashboardProductsTab';
import { VariantFormDialog } from './components/dashboard/variants/VariantFormDialog';

// Import admin modules
import { AssetManager } from './modules/assets';
import { BrandManager } from './modules/brands';
import { CombosManager } from './modules/combos';
import { BlogManager, HomepageManager } from './modules/content';
import { CustomersManager } from './modules/customers';
import { DiscountsManager } from './modules/discounts';
import { OrdersManager } from './modules/orders';
import { VariantsManager } from './modules/variants';
import CategoryManager from './categories/CategoryManager';
import { SiteSettingsPage } from './pages/SiteSettingsPage';

// Import types and hooks
import {
  AdminDashboardProps,
  DashboardTab,
  ProductVariant,
  VariantFormData
} from './components/dashboard/types/index';
import { useDashboardData } from './components/dashboard/hooks/useDashboardData';

export function AdminDashboard({ onStatsUpdate }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showVariantDialog, setShowVariantDialog] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [variantForm, setVariantForm] = useState<VariantFormData>({
    product_id: '',
    variant_name: '',
    variant_type: 'packaging',
    price: 0,
    stock: 0,
    is_active: true,
    sort_order: 0,
    attributes: {},
    variant_images: []
  });

  // Data management hook
  const {
    products,
    variants,
    analytics,
    loading,
    loadDashboardData,
    saveVariant,
    deleteVariant
  } = useDashboardData();

  // Load data on component mount
  useEffect(() => {
    loadDashboardData();
  }, []);

  // Reset variant form
  const resetVariantForm = () => {
    setVariantForm({
      product_id: '',
      variant_name: '',
      variant_type: 'packaging',
      price: 0,
      stock: 0,
      is_active: true,
      sort_order: 0,
      attributes: {},
      variant_images: []
    });
    setEditingVariant(null);
  };

  // Handle add variant
  const handleAddVariant = () => {
    resetVariantForm();
    setShowVariantDialog(true);
  };

  // Handle edit variant
  const handleEditVariant = (variant: ProductVariant) => {
    setEditingVariant(variant);
    setVariantForm({
      product_id: variant.product_id,
      variant_name: variant.variant_name,
      variant_type: variant.variant_type,
      price: variant.price,
      stock: variant.stock,
      is_active: variant.is_active,
      sort_order: variant.sort_order,
      attributes: variant.attributes,
      variant_images: variant.variant_images?.map(img => img.image_url) || []
    });
    setShowVariantDialog(true);
  };

  // Handle delete variant
  const handleDeleteVariant = async (variantId: string) => {
    const success = await deleteVariant(variantId);
    if (success && onStatsUpdate) {
      onStatsUpdate();
    }
  };

  // Handle save variant
  const handleSaveVariant = async () => {
    const success = await saveVariant(variantForm, editingVariant);
    if (success) {
      setShowVariantDialog(false);
      resetVariantForm();
      if (onStatsUpdate) {
        onStatsUpdate();
      }
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-10">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Products
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <Tags className="h-4 w-4" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="brands" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Brands
            </TabsTrigger>
            <TabsTrigger value="content" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Content
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="customers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="discounts" className="flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Discounts
            </TabsTrigger>
            <TabsTrigger value="assets" className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              Assets
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="mt-6">
            {/* Analytics Cards */}
            <DashboardAnalyticsCards analytics={analytics} loading={loading} />
            
            <div className="mt-6">
              <DashboardOverviewTab
                products={products}
                onTabChange={() => {}}
                onAddVariant={handleAddVariant}
              />
            </div>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="mt-6">
            <DashboardProductsTab
              products={products}
              variants={variants}
              onAddVariant={handleAddVariant}
              onEditVariant={handleEditVariant}
              onDeleteVariant={handleDeleteVariant}
              onRefresh={loadDashboardData}
            />
          </TabsContent>
          {/* Categories Tab */}
          <TabsContent value="categories" className="mt-6">
            <CategoryManager onStatsUpdate={onStatsUpdate} />
          </TabsContent>

          {/* Brands Tab */}
          <TabsContent value="brands" className="mt-6">
            <BrandManager onStatsUpdate={onStatsUpdate} />
          </TabsContent>

          {/* Content Tab */}
          <TabsContent value="content" className="mt-6">
            <Tabs defaultValue="homepage">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="homepage">Homepage</TabsTrigger>
                <TabsTrigger value="blogs">Blogs</TabsTrigger>
              </TabsList>
              <TabsContent value="homepage" className="mt-4">
                <HomepageManager />
              </TabsContent>
              <TabsContent value="blogs" className="mt-4">
                <BlogManager />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="mt-6">
            <OrdersManager />
          </TabsContent>

          {/* Customers Tab */}
          <TabsContent value="customers" className="mt-6">
            <CustomersManager />
          </TabsContent>

          {/* Discounts Tab */}
          <TabsContent value="discounts" className="mt-6">
            <DiscountsManager />
          </TabsContent>

          {/* Assets Tab */}
          <TabsContent value="assets" className="mt-6">
            <AssetManager />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-6">
            <SiteSettingsPage />
          </TabsContent>
        </Tabs>

        {/* Variant Form Dialog */}
        <VariantFormDialog
          open={showVariantDialog}
          onOpenChange={setShowVariantDialog}
          editingVariant={editingVariant}
          variantForm={variantForm}
          onVariantFormChange={setVariantForm}
          onSave={handleSaveVariant}
          products={products}
          loading={loading}
        />
      </div>
    </div>
  );
}

export { AdminDashboard as default };