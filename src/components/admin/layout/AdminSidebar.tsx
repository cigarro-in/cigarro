import { 
  BarChart3, 
  Package, 
  ShoppingBag, 
  Users, 
  Crown, 
  FileText, 
  Settings, 
  Image as ImageIcon,
  Layers,
  Gift,
  Percent,
  X
} from 'lucide-react';
import { Button } from '../../ui/button';
import { cn } from '../../ui/utils';

interface AdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const navigationGroups = [
  {
    title: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: BarChart3 }
    ]
  },
  {
    title: 'Catalog Management',
    items: [
      { id: 'products', label: 'Products', icon: Package },
      { id: 'categories', label: 'Categories', icon: Layers },
      { id: 'variants', label: 'Variants', icon: Layers },
      { id: 'combos', label: 'Combos', icon: Gift }
    ]
  },
  {
    title: 'Sales & Marketing',
    items: [
      { id: 'orders', label: 'Orders', icon: ShoppingBag },
      { id: 'customers', label: 'Customers', icon: Users },
      { id: 'discounts', label: 'Discounts', icon: Percent }
    ]
  },
  {
    title: 'Content Management',
    items: [
      { id: 'homepage', label: 'Homepage', icon: Crown },
      { id: 'blog', label: 'Blog', icon: FileText },
      { id: 'assets', label: 'Media Assets', icon: ImageIcon }
    ]
  },
  {
    title: 'System',
    items: [
      { id: 'settings', label: 'Settings', icon: Settings }
    ]
  }
];

export function AdminSidebar({ activeSection, onSectionChange, isOpen, onClose }: AdminSidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-16 left-0 z-50 w-64 h-[calc(100vh-4rem)] bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Close button for mobile */}
          <div className="flex justify-end p-4 lg:hidden">
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 pb-4 space-y-6 overflow-y-auto">
            {navigationGroups.map((group) => (
              <div key={group.title}>
                <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {group.title}
                </h3>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onSectionChange(item.id);
                          onClose();
                        }}
                        className={cn(
                          "w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                          isActive
                            ? "bg-blue-50 text-blue-700 border-r-2 border-blue-700"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        )}
                      >
                        <Icon className={cn(
                          "mr-3 h-4 w-4",
                          isActive ? "text-blue-700" : "text-gray-400"
                        )} />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}
