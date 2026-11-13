import type { LucideIcon } from 'lucide-react';
import {
  CreditCard,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  Package,
  Percent,
  Search,
  Settings,
  ShoppingCart,
  Star,
  Users,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '../../components/ui/sidebar';
import { useStoreSettings } from '../../hooks/data/useStoreSettings';
import { useOrg } from '../../lib/convex/useOrg';
import { AdminStoreMenu } from './AdminStoreMenu';

export interface NavChild {
  label: string;
  path: string;
}

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  /** Shown under the item while any of its paths is active. */
  children?: NavChild[];
}

export interface NavSection {
  /** 'main' renders in the scrolling list; 'bottom' sits above the footer edge. */
  placement: 'main' | 'bottom';
  items: NavItem[];
}

/**
 * Sidebar navigation. Paths are router-relative (basename is /<store>).
 * Hidden from nav but still routed (see ADMIN_ROUTES): Invoices, Inventory,
 * Marketing, Homepage, Redirects.
 */
export const ADMIN_NAVIGATION: NavSection[] = [
  {
    placement: 'main',
    items: [
      { label: 'Overview', path: '/', icon: LayoutDashboard },
      { label: 'Orders', path: '/orders', icon: ShoppingCart },
      {
        label: 'Products',
        path: '/products',
        icon: Package,
        children: [
          { label: 'Collections', path: '/collections' },
          { label: 'Categories', path: '/categories' },
          { label: 'Brands', path: '/brands' },
        ],
      },
      { label: 'Customers', path: '/customers', icon: Users },
      { label: 'Discounts', path: '/discounts', icon: Percent },
      { label: 'Reviews', path: '/reviews', icon: Star },
      { label: 'Content', path: '/blogs', icon: FileText, children: [{ label: 'Blogs', path: '/blogs' }, { label: 'Pages', path: '/pages' }] },
      { label: 'SEO', path: '/seo', icon: Search },
      { label: 'Assets', path: '/assets', icon: ImageIcon },
    ],
  },
  {
    placement: 'bottom',
    items: [
      { label: 'Payments', path: '/payments', icon: CreditCard },
      { label: 'Settings', path: '/settings', icon: Settings },
    ],
  },
];

function matches(pathname: string, path: string) {
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(`${path}/`);
}

function NavList({ items, pathname, onNavigate }: { items: NavItem[]; pathname: string; onNavigate: () => void }) {
  return (
    <SidebarMenu className="gap-1">
      {items.map((item) => {
        const childPaths = item.children?.map((c) => c.path) ?? [];
        const ownActive = matches(pathname, item.path);
        const childActive = childPaths.some((p) => p !== item.path && matches(pathname, p));
        const groupActive = ownActive || childActive;
        // Only show sub items when there is more than the item itself.
        const subItems = item.children?.filter((c) => c.path !== item.path) ?? [];
        return (
          <SidebarMenuItem key={item.path}>
            <SidebarMenuButton
              asChild
              isActive={ownActive && !childActive}
              className="h-10 gap-3 px-3 text-[15px] font-medium [&>svg]:size-5 data-[active=true]:bg-[var(--admin-sidebar-active)] data-[active=true]:font-semibold"
            >
              <NavLink to={item.path} end={item.path === '/'} onClick={onNavigate}>
                <item.icon aria-hidden />
                <span>{item.label}</span>
              </NavLink>
            </SidebarMenuButton>
            {groupActive && subItems.length > 0 && (
              <SidebarMenuSub className="mr-0 border-l-0 pr-0 pb-1">
                {subItems.map((child) => (
                  <SidebarMenuSubItem key={child.path}>
                    <SidebarMenuSubButton
                      asChild
                      isActive={matches(pathname, child.path)}
                      className="h-9 text-[14px] data-[active=true]:bg-[var(--admin-sidebar-active)] data-[active=true]:font-medium"
                    >
                      <NavLink to={child.path} onClick={onNavigate}>
                        {child.label}
                      </NavLink>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            )}
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

export function AdminSidebar() {
  const { settings: store } = useStoreSettings();
  const { pathname } = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const org = useOrg();
  const close = () => {
    if (isMobile) setOpenMobile(false);
  };
  const main = ADMIN_NAVIGATION.filter((s) => s.placement === 'main').flatMap((s) => s.items);
  const bottom = ADMIN_NAVIGATION.filter((s) => s.placement === 'bottom').flatMap((s) => s.items);

  // Desktop sidebar is always expanded (AdminShell pins `open`). It is not
  // collapsible; only the phone drawer (Sheet) opens and closes.
  return (
    <Sidebar variant="floating" className="p-3" style={{ '--sidebar-width': '17rem' } as React.CSSProperties}>
      <SidebarHeader className="p-2">
        <AdminStoreMenu storeName={org?.name || store.name} iconUrl={store.brand.faviconUrl || store.brand.logoUrl || undefined} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="pt-1">
          <SidebarGroupContent>
            <NavList items={main} pathname={pathname} onNavigate={close} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <NavList items={bottom} pathname={pathname} onNavigate={close} />
      </SidebarFooter>
    </Sidebar>
  );
}
