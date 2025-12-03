import { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Package,
  Tags,
  Building2,
  FolderOpen,
  Home,
  ShoppingCart,
  Users,
  Percent,
  Settings,
  Image as ImageIcon,
  FileText,
  LogOut
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '../../components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { useAdminAuth } from '../../hooks/useAdminAuth';

/**
 * Navigation item configuration
 * Abstract structure for dynamic menu generation
 */
interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  section: string;
}

/**
 * Admin navigation configuration
 * Easily extendable for future website builder features
 */
const NAVIGATION_CONFIG: NavItem[] = [
  { id: 'overview', label: 'Overview', path: '/admin', icon: LayoutDashboard, section: 'platform' },
  { id: 'products', label: 'Products', path: '/admin/products', icon: Package, section: 'platform' },
  { id: 'categories', label: 'Categories', path: '/admin/categories', icon: Tags, section: 'platform' },
  { id: 'brands', label: 'Brands', path: '/admin/brands', icon: Building2, section: 'platform' },
  { id: 'collections', label: 'Collections', path: '/admin/collections', icon: FolderOpen, section: 'platform' },
  { id: 'orders', label: 'Orders', path: '/admin/orders', icon: ShoppingCart, section: 'platform' },
  { id: 'customers', label: 'Customers', path: '/admin/customers', icon: Users, section: 'platform' },
  { id: 'discounts', label: 'Discounts', path: '/admin/discounts', icon: Percent, section: 'platform' },
  { id: 'homepage', label: 'Homepage', path: '/admin/homepage', icon: Home, section: 'platform' },
  { id: 'blogs', label: 'Blogs', path: '/admin/blogs', icon: FileText, section: 'platform' },
  { id: 'assets', label: 'Assets', path: '/admin/assets', icon: ImageIcon, section: 'platform' },
  { id: 'settings', label: 'Settings', path: '/admin/settings', icon: Settings, section: 'platform' },
];

/**
 * Section labels - can be customized per deployment
 */
const SECTION_LABELS: Record<string, string> = {
  platform: 'Platform',
};

/**
 * Branding configuration - easily customizable
 */
const BRANDING_CONFIG = {
  name: 'Admin Panel',
  subtitle: 'Enterprise',
  logo: 'A', // Single character or could be replaced with image
};

export function AdminSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, adminProfile, signOut } = useAdminAuth();

  const isActive = (path: string) => {
    if (path === '/admin' && location.pathname === '/admin') return true;
    if (path !== '/admin' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
      navigate('/');
    }
  };

  console.log('[AdminSidebar] render', location.pathname);

  // Group items by section
  const sections = NAVIGATION_CONFIG.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {} as Record<string, NavItem[]>);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="font-bold">{BRANDING_CONFIG.logo}</span>
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">{BRANDING_CONFIG.name}</span>
            <span className="truncate text-xs text-muted-foreground">{BRANDING_CONFIG.subtitle}</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {Object.entries(sections).map(([sectionKey, items]) => (
          <SidebarGroup key={sectionKey}>
            <SidebarGroupLabel>{SECTION_LABELS[sectionKey] || sectionKey}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton 
                      isActive={isActive(item.path)}
                      onClick={() => {
                        console.log('[AdminSidebar] navigate ->', item.path);
                        navigate(item.path);
                      }}
                      tooltip={item.label}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="rounded-lg bg-canyon text-creme">
                  {adminProfile?.full_name?.charAt(0) || 'A'}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{adminProfile?.full_name || 'Admin'}</span>
                <span className="truncate text-xs">{user?.email}</span>
              </div>
              <LogOut className="ml-auto size-4" onClick={handleSignOut} />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
