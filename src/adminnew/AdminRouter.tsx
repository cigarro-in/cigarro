import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AdminShell } from './layout/AdminShell';
import {
  DashboardPage,
  ProductsPage,
  CategoriesPage,
  BrandsPage,
  CollectionsPage,
  OrdersPage,
  CustomersPage,
  DiscountsPage,
  BlogsPage,
  HomepagePage,
  AssetsPage,
  SettingsPage,
  ProductFormPage,
  CategoryFormPage,
  BrandFormPage,
  CollectionFormPage,
  OrderFormPage,
  CustomerFormPage,
  DiscountFormPage,
  BlogFormPage,
  HeroSlideFormPage,
} from './pages';

/**
 * Admin navigation configuration
 * Abstract structure for future website builder conversion
 * Paths are absolute so they match the BrowserRouter location directly.
 */
export const ADMIN_ROUTES = [
  { path: '/admin', element: DashboardPage, label: 'Overview', section: 'platform' },
  { path: '/admin/products', element: ProductsPage, label: 'Products', section: 'platform' },
  { path: '/admin/categories', element: CategoriesPage, label: 'Categories', section: 'platform' },
  { path: '/admin/brands', element: BrandsPage, label: 'Brands', section: 'platform' },
  { path: '/admin/collections', element: CollectionsPage, label: 'Collections', section: 'platform' },
  { path: '/admin/orders', element: OrdersPage, label: 'Orders', section: 'platform' },
  { path: '/admin/customers', element: CustomersPage, label: 'Customers', section: 'platform' },
  { path: '/admin/discounts', element: DiscountsPage, label: 'Discounts', section: 'platform' },
  { path: '/admin/homepage', element: HomepagePage, label: 'Homepage', section: 'platform' },
  { path: '/admin/blogs', element: BlogsPage, label: 'Blogs', section: 'platform' },
  { path: '/admin/assets', element: AssetsPage, label: 'Assets', section: 'platform' },
  { path: '/admin/settings', element: SettingsPage, label: 'Settings', section: 'platform' },
] as const;

interface AdminRouterProps {
  onStatsUpdate?: () => void;
}

export function AdminRouter(_props: AdminRouterProps) {
  const location = useLocation();
  console.log('[AdminRouter] render', location.pathname);

  return (
    <AdminShell>
      <Routes>
        {/* Form routes - must come before list routes to match :id properly */}
        <Route path="/admin/products/new" element={<ProductFormPage />} />
        <Route path="/admin/products/:id" element={<ProductFormPage />} />
        <Route path="/admin/categories/new" element={<CategoryFormPage />} />
        <Route path="/admin/categories/:id" element={<CategoryFormPage />} />
        <Route path="/admin/brands/new" element={<BrandFormPage />} />
        <Route path="/admin/brands/:id" element={<BrandFormPage />} />
        <Route path="/admin/collections/new" element={<CollectionFormPage />} />
        <Route path="/admin/collections/:id" element={<CollectionFormPage />} />
        <Route path="/admin/orders/:id" element={<OrderFormPage />} />
        <Route path="/admin/customers/:id" element={<CustomerFormPage />} />
        <Route path="/admin/discounts/new" element={<DiscountFormPage />} />
        <Route path="/admin/discounts/:id" element={<DiscountFormPage />} />
        <Route path="/admin/hero-slides/new" element={<HeroSlideFormPage />} />
        <Route path="/admin/hero-slides/:id" element={<HeroSlideFormPage />} />
        <Route path="/admin/blogs/new" element={<BlogFormPage />} />
        <Route path="/admin/blogs/:id" element={<BlogFormPage />} />
        
        {/* List routes */}
        {ADMIN_ROUTES.map(({ path, element: Element }) => (
          <Route key={path} path={path} element={<Element />} />
        ))}
        
        {/* Catch all redirect */}
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminShell>
  );
}
