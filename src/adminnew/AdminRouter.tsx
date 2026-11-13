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
  ReviewsPage,
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
  StorePagesPage,
  StorePageFormPage,
  HeroSlideFormPage,
  PaymentsPage,
  MarketingPage,
  InventoryPage,
  InvoicesPage,
  InvoiceFormPage,
  RedirectsPage,
  SeoHealthPage,
} from './pages';

/**
 * Admin navigation configuration
 * Abstract structure for future website builder conversion
 * Paths are router-relative: the basename is `/<store>` on the admin host,
 * so '/orders' serves https://admin.cigarro.in/<store>/orders.
 */
export const ADMIN_ROUTES = [
  { path: '/', element: DashboardPage, label: 'Overview', section: 'platform' },
  { path: '/products', element: ProductsPage, label: 'Products', section: 'platform' },
  { path: '/categories', element: CategoriesPage, label: 'Categories', section: 'platform' },
  { path: '/brands', element: BrandsPage, label: 'Brands', section: 'platform' },
  { path: '/collections', element: CollectionsPage, label: 'Collections', section: 'platform' },
  { path: '/orders', element: OrdersPage, label: 'Orders', section: 'platform' },
  { path: '/inventory', element: InventoryPage, label: 'Inventory', section: 'commerce' },
  { path: '/invoices', element: InvoicesPage, label: 'Invoices', section: 'commerce' },
  { path: '/customers', element: CustomersPage, label: 'Customers', section: 'platform' },
  { path: '/discounts', element: DiscountsPage, label: 'Discounts', section: 'platform' },
  { path: '/homepage', element: HomepagePage, label: 'Homepage', section: 'platform' },
  { path: '/blogs', element: BlogsPage, label: 'Blogs', section: 'platform' },
  { path: '/pages', element: StorePagesPage, label: 'Pages', section: 'platform' },
  { path: '/reviews', element: ReviewsPage, label: 'Reviews', section: 'platform' },
  { path: '/assets', element: AssetsPage, label: 'Assets', section: 'platform' },
  { path: '/seo', element: SeoHealthPage, label: 'SEO health', section: 'seo' },
  { path: '/seo/redirects', element: RedirectsPage, label: 'Redirects', section: 'seo' },
  { path: '/settings', element: SettingsPage, label: 'Settings', section: 'platform' },
  // Settings sections: one page component, the section is read from the path.
  { path: '/settings/store', element: SettingsPage, label: 'Store details', section: 'platform' },
  { path: '/settings/checkout', element: SettingsPage, label: 'Checkout & shipping', section: 'platform' },
  { path: '/settings/referral', element: SettingsPage, label: 'Refer & earn', section: 'platform' },
  { path: '/settings/legal', element: SettingsPage, label: 'Legal & age gate', section: 'platform' },
  { path: '/settings/advanced', element: SettingsPage, label: 'Advanced', section: 'platform' },
  { path: '/payments', element: PaymentsPage, label: 'Payments', section: 'payments' },
  { path: '/marketing', element: MarketingPage, label: 'Marketing', section: 'marketing' },
  // Deep links into the Payments tabs (single page, tab picked from the path).
  // /payments/unmatched is retired: PaymentsPage redirects it to the statement.
  { path: '/payments/emails', element: PaymentsPage, label: 'Payments', section: 'payments' },
  { path: '/payments/unmatched', element: PaymentsPage, label: 'Payments', section: 'payments' },
  { path: '/payments/settings', element: PaymentsPage, label: 'Payments', section: 'payments' },
] as const;

/**
 * Old bookmarks: /<store>/admin/<rest> -> /<store>/<rest>. The edge middleware
 * issues the 301 first; this covers client-side arrivals (in-app links, cached shells).
 */
function LegacyAdminRedirect() {
  const { pathname, search, hash } = useLocation();
  const rest = pathname.replace(/^\/admin(?=\/|$)/, '') || '/';
  return <Navigate to={`${rest}${search}${hash}`} replace />;
}

export function AdminRouter() {
  return (
    <AdminShell>
      <Routes>
        <Route path="/admin/*" element={<LegacyAdminRedirect />} />

        {/* Form routes - must come before list routes to match :id properly */}
        <Route path="/products/new" element={<ProductFormPage />} />
        <Route path="/products/:id" element={<ProductFormPage />} />
        <Route path="/categories/new" element={<CategoryFormPage />} />
        <Route path="/categories/:id" element={<CategoryFormPage />} />
        <Route path="/brands/new" element={<BrandFormPage />} />
        <Route path="/brands/:id" element={<BrandFormPage />} />
        <Route path="/collections/new" element={<CollectionFormPage />} />
        <Route path="/collections/:id" element={<CollectionFormPage />} />
        <Route path="/orders/:id" element={<OrderFormPage />} />
        <Route path="/invoices/new" element={<InvoiceFormPage />} />
        <Route path="/invoices/:id" element={<InvoiceFormPage />} />
        <Route path="/customers/:id" element={<CustomerFormPage />} />
        <Route path="/discounts/new" element={<DiscountFormPage />} />
        <Route path="/discounts/:id" element={<DiscountFormPage />} />
        <Route path="/hero-slides/new" element={<HeroSlideFormPage />} />
        <Route path="/hero-slides/:id" element={<HeroSlideFormPage />} />
        <Route path="/blogs/new" element={<BlogFormPage />} />
        <Route path="/blogs/:id" element={<BlogFormPage />} />
        <Route path="/pages/:slug" element={<StorePageFormPage />} />
        
        {/* List routes */}
        {ADMIN_ROUTES.map(({ path, element: Element }) => (
          <Route key={path} path={path} element={<Element />} />
        ))}
        
        {/* Catch all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AdminShell>
  );
}
