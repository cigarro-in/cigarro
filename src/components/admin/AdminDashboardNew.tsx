import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { AdminLayout } from './layout/AdminLayout';
import { DashboardOverview } from './dashboard/DashboardOverview';
import { ProductsManager } from './products/ProductsManager';
import { OrdersManager } from './orders/OrdersManager';
import { CustomersManager } from './customers/CustomersManager';
import { CategoriesManager } from './categories/CategoriesManager';
import { CombosManager } from './combos/CombosManager';
import { DiscountsManager } from './discounts/DiscountsManager';
import HomepageManager from './HomepageManager';
import { BlogManager } from './BlogManager';
import { AssetManager } from './AssetManager';
import { SiteSettingsPage } from '../SiteSettingsPage';

export function AdminDashboardNew() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState('dashboard');

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return <DashboardOverview />;
      case 'products':
        return <ProductsManager />;
      case 'orders':
        return <OrdersManager />;
      case 'customers':
        return <CustomersManager />;
      case 'categories':
        return <CategoriesManager />;
      case 'combos':
        return <CombosManager />;
      case 'discounts':
        return <DiscountsManager />;
      case 'homepage':
        return <HomepageManager />;
      case 'blog':
        return <BlogManager />;
      case 'assets':
        return <AssetManager />;
      case 'settings':
        return <SiteSettingsPage />;
      default:
        return <DashboardOverview />;
    }
  };

  return (
    <AdminLayout
      activeSection={activeSection}
      onSectionChange={setActiveSection}
    >
      {renderContent()}
    </AdminLayout>
  );
}
