import { useStoreSettings } from '../../hooks/data/useStoreSettings';
import type { LucideIcon } from 'lucide-react';
import {
  Boxes,
  Building2,
  ChevronUp,
  CreditCard,
  FileText,
  FolderOpen,
  Home,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Package,
  Percent,
  ReceiptIndianRupee,
  Settings,
  ShoppingCart,
  ArrowRightLeft,
  Star,
  Tags,
  Users,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
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
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '../../components/ui/sidebar';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { useAuth } from '../../hooks/useAuth';
import { useOrg } from '../../lib/convex/useOrg';
import { AdminStoreMenu } from './AdminStoreMenu';
import { signOutOfAdmin } from '../lib/adminAuth';

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

interface NavSection {
  label?: string;
  items: NavItem[];
}

export const ADMIN_NAVIGATION: NavSection[] = [
  {
    items: [{ label: 'Overview', path: '/', icon: LayoutDashboard }],
  },
  {
    label: 'Sales',
    items: [
      { label: 'Orders', path: '/orders', icon: ShoppingCart },
      { label: 'Customers', path: '/customers', icon: Users },
      { label: 'Payments', path: '/payments', icon: CreditCard },
      { label: 'Invoices', path: '/invoices', icon: ReceiptIndianRupee },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { label: 'Products', path: '/products', icon: Package },
      { label: 'Inventory', path: '/inventory', icon: Boxes },
      { label: 'Collections', path: '/collections', icon: FolderOpen },
      { label: 'Categories', path: '/categories', icon: Tags },
      { label: 'Brands', path: '/brands', icon: Building2 },
    ],
  },
  {
    label: 'Growth',
    items: [
      { label: 'Marketing', path: '/marketing', icon: Megaphone },
      { label: 'Discounts', path: '/discounts', icon: Percent },
    ],
  },
  {
    label: 'Storefront',
    items: [
      { label: 'Homepage', path: '/homepage', icon: Home },
      { label: 'Reviews', path: '/reviews', icon: Star },
      { label: 'Blogs', path: '/blogs', icon: FileText },
      { label: 'Assets', path: '/assets', icon: ImageIcon },
    ],
  },
  {
    label: 'SEO',
    items: [{ label: 'Redirects', path: '/seo/redirects', icon: ArrowRightLeft }],
  },
];

function getInitial(value?: string | null) {
  return value?.trim().charAt(0).toUpperCase() || 'C';
}

export function AdminSidebar() {
  const { settings: store } = useStoreSettings();
  const location = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const { user } = useAuth();
  const org = useOrg();

  const isActive = (path: string) =>
    path === '/'
      ? location.pathname === path
      : location.pathname.startsWith(path);

  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <AdminStoreMenu storeName={org?.name || store.name} />
      </SidebarHeader>

      <SidebarContent>
        {ADMIN_NAVIGATION.map((section, sectionIndex) => (
          <SidebarGroup key={section.label || 'overview'} className={sectionIndex === 0 ? 'pb-0' : undefined}>
            {section.label && <SidebarGroupLabel>{section.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.path)}
                      tooltip={item.label}
                    >
                      <NavLink to={item.path} end={item.path === '/'} onClick={closeMobileSidebar}>
                        <item.icon aria-hidden />
                        <span>{item.label}</span>
                      </NavLink>
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
              asChild
              isActive={isActive('/settings')}
              tooltip="Settings"
            >
              <NavLink to="/settings" onClick={closeMobileSidebar}>
                <Settings aria-hidden />
                <span>Settings</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" tooltip="Account">
                  <Avatar className="size-8 rounded-md">
                    <AvatarFallback className="rounded-md">
                      {getInitial(user?.name || user?.email || user?.phone)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="grid min-w-0 flex-1 text-left leading-tight">
                    <span className="truncate font-medium">{user?.name || 'Admin'}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user?.phone || user?.email || 'Account'}
                    </span>
                  </span>
                  <ChevronUp className="ml-auto" aria-hidden />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side={isMobile ? 'top' : 'right'} align="end" className="w-56">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onSelect={() => signOutOfAdmin()}>
                    <LogOut aria-hidden />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
