import React from 'react';
import { Settings, Package, Users, BarChart3, ShoppingCart, ExternalLink } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

interface AdminDashboardProps {
  onStatsUpdate?: (stats: any) => void;
}

export function AdminDashboard({ onStatsUpdate }: AdminDashboardProps = {}) {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage your premium cigarette marketplace</p>
        </div>

        {/* Temporary Notice */}
        <Card className="mb-8 border-orange-200 bg-orange-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-orange-600" />
              <div>
                <h3 className="font-semibold text-orange-800">Dashboard Under Maintenance</h3>
                <p className="text-orange-700 mt-1">
                  The advanced dashboard components are being refactored. Use the alternative admin tools below.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">Use Product Manager</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">Check orders section</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">Customer management</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Analytics</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">Coming soon</p>
            </CardContent>
          </Card>
        </div>

        {/* Alternative Admin Tools */}
        <Card>
          <CardHeader>
            <CardTitle>Available Admin Tools</CardTitle>
            <p className="text-sm text-muted-foreground">
              Use these alternative admin interfaces while the dashboard is being updated.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="h-auto p-4 justify-start"
                onClick={() => window.location.href = '/admin/products'}
              >
                <Package className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Product Manager</div>
                  <div className="text-sm text-muted-foreground">Manage products and variants</div>
                </div>
                <ExternalLink className="h-4 w-4 ml-auto" />
              </Button>

              <Button 
                variant="outline" 
                className="h-auto p-4 justify-start"
                onClick={() => window.location.href = '/admin/orders'}
              >
                <ShoppingCart className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Order Management</div>
                  <div className="text-sm text-muted-foreground">Process and track orders</div>
                </div>
                <ExternalLink className="h-4 w-4 ml-auto" />
              </Button>

              <Button 
                variant="outline" 
                className="h-auto p-4 justify-start"
                onClick={() => window.location.href = '/admin/customers'}
              >
                <Users className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Customer Management</div>
                  <div className="text-sm text-muted-foreground">View and manage customers</div>
                </div>
                <ExternalLink className="h-4 w-4 ml-auto" />
              </Button>

              <Button 
                variant="outline" 
                className="h-auto p-4 justify-start"
                onClick={() => window.location.href = '/admin/settings'}
              >
                <Settings className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Site Settings</div>
                  <div className="text-sm text-muted-foreground">Configure site settings</div>
                </div>
                <ExternalLink className="h-4 w-4 ml-auto" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export { AdminDashboard as default };

  // Load data on component mount
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

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
      attributes: variant.attributes || {},
      variant_images: variant.variant_images?.map(img => img.image_url) || []
    });
    setShowVariantDialog(true);
  };

  // Handle save variant
  const handleSaveVariant = async () => {
    const success = await saveVariant(variantForm, editingVariant);
    if (success) {
      setShowVariantDialog(false);
      resetVariantForm();
      onStatsUpdate();
    }
  };

  // Handle delete variant
  const handleDeleteVariant = async (variantId: string) => {
    const success = await deleteVariant(variantId);
    if (success) {
      onStatsUpdate();
    }
  };

  // Update analytics to include variants count
  const enhancedAnalytics = {
    ...analytics,
    totalVariants: variants.length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={loadDashboardData} disabled={loading}>
            <Settings className="h-4 w-4 mr-2" />
            {loading ? 'Loading...' : 'Refresh Data'}
          </Button>
        </div>
      </div>

      {/* Analytics Cards */}
      <DashboardAnalyticsCards analytics={enhancedAnalytics} loading={loading} />

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={(value: string) => setActiveTab(value as DashboardTab)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="variants">Variants</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <DashboardOverviewTab
            products={products}
            onTabChange={setActiveTab}
            onAddVariant={handleAddVariant}
          />
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-6">
          <DashboardProductsTab />
        </TabsContent>

        {/* Variants Tab */}
        <TabsContent value="variants" className="space-y-6">
          <DashboardVariantsTab
            variants={variants}
            onAddVariant={handleAddVariant}
            onEditVariant={handleEditVariant}
            onDeleteVariant={handleDeleteVariant}
          />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <DashboardAnalyticsTab analytics={enhancedAnalytics} />
        </TabsContent>
      </Tabs>

      {/* Variant Form Dialog */}
      <VariantFormDialog
        open={showVariantDialog}
        onOpenChange={setShowVariantDialog}
        editingVariant={editingVariant}
        variantForm={variantForm}
        onVariantFormChange={setVariantForm}
        products={products}
        onSave={handleSaveVariant}
        loading={loading}
      />
    </div>
  );
}
