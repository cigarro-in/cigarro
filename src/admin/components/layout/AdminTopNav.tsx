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
  Percent
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { cn } from '../../components/ui/utils';

interface AdminTopNavProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const navigationItems = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'products', label: 'Products' },
  { id: 'categories', label: 'Categories' },
  { id: 'combos', label: 'Combos' },
  { id: 'orders', label: 'Orders' },
  { id: 'customers', label: 'Customers' },
  { id: 'discounts', label: 'Discounts' },
  { id: 'homepage', label: 'Homepage' },
  { id: 'blog', label: 'Blog' },
  { id: 'assets', label: 'Assets' },
  { id: 'settings', label: 'Settings' }
];

export function AdminTopNav({ activeSection, onSectionChange }: AdminTopNavProps) {
  return (
    <div className="border-t border-coyote/30 bg-dark/95 backdrop-blur-sm">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center space-x-1 overflow-x-auto scrollbar-hide py-2">
          {navigationItems.map((item) => {
            const isActive = activeSection === item.id;
            
            return (
              <Button
                key={item.id}
                variant="ghost"
                size="sm"
                onClick={() => onSectionChange(item.id)}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all duration-200",
                  isActive
                    ? "bg-canyon text-creme shadow-sm border border-canyon/50"
                    : "text-creme/80 hover:text-creme hover:bg-canyon/20 border border-transparent"
                )}
              >
                {item.label}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
