import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Globe, LayoutDashboard, LogOut, Settings, Store } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '../components/ui/sidebar';
import { Banner, Button } from '../adminnew/ui';

// Super-admin shell, mirroring the store admin frame (src/adminnew/layout):
// floating island sidebar on desktop, edge drawer on phones, read-only notice
// above the routed page. Navigation is fixed to platform pages.
const NAV = [
  { label: 'Overview', path: '/sa/overview', icon: LayoutDashboard },
  { label: 'Stores', path: '/sa/stores', icon: Store },
  { label: 'Domains', path: '/sa/domains', icon: Globe },
  { label: 'Platform config', path: '/sa/platform', icon: Settings },
] as const;

const noop = () => {};

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  return (
    <SidebarMenu className="gap-1">
      {NAV.map((item) => {
        const active = pathname === item.path || pathname.startsWith(`${item.path}/`);
        return (
          <SidebarMenuItem key={item.path}>
            <SidebarMenuButton
              asChild
              isActive={active}
              className="h-10 gap-3 px-3 text-[15px] font-medium [&>svg]:size-5 data-[active=true]:bg-[var(--admin-sidebar-active)] data-[active=true]:font-semibold"
            >
              <NavLink to={item.path} onClick={onNavigate}>
                <item.icon aria-hidden />
                <span>{item.label}</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

function Mark() {
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--admin-primary)] text-sm font-semibold text-[var(--admin-text-on-primary)]"
    >
      C
    </span>
  );
}

function SaSidebar({ adminId, onSignOut }: { adminId: string; onSignOut: () => void }) {
  const { pathname } = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const close = () => {
    if (isMobile) setOpenMobile(false);
  };
  return (
    <Sidebar variant="floating" className="p-3" style={{ '--sidebar-width': '17rem' } as React.CSSProperties}>
      <SidebarHeader className="p-2">
        <div className="flex items-center gap-3 px-1 py-1">
          <Mark />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--admin-text)]">Cigarro Platform</p>
            <p className="truncate text-xs text-[var(--admin-text-muted)]">Super admin</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="pt-1">
          <SidebarGroupContent>
            <NavList pathname={pathname} onNavigate={close} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-2 p-2">
        <div className="flex items-center gap-3 rounded-[var(--admin-radius-sm)] border border-[var(--admin-border)] px-3 py-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--admin-neutral-soft)] text-xs font-semibold text-[var(--admin-text-muted)]">
            SA
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--admin-text)]">Signed in via Citadel</p>
            <p className="truncate font-mono text-[11px] text-[var(--admin-text-subtle)]">{adminId.slice(0, 12)}</p>
          </div>
        </div>
        <Button variant="plain" size="sm" fullWidth icon={<LogOut aria-hidden />} onClick={onSignOut} className="justify-start">
          Sign out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

export function SaShell({
  adminId,
  writeOpen,
  onSignOut,
  children,
}: {
  adminId: string;
  writeOpen: boolean;
  onSignOut: () => void;
  children: ReactNode;
}) {
  return (
    <SidebarProvider data-admin-shell open onOpenChange={noop}>
      <SaSidebar adminId={adminId} onSignOut={onSignOut} />
      <SidebarInset className="flex min-h-svh min-w-0 flex-col bg-[var(--admin-bg)]">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 md:hidden">
          <SidebarTrigger className="size-9" aria-label="Open navigation" />
          <Mark />
          <span className="min-w-0 truncate text-sm font-semibold">Cigarro Platform</span>
        </header>
        {!writeOpen && (
          <div className="px-3 pt-3 sm:px-4">
            <Banner tone="warning" title="Read-only">
              Write access expired. Re-launch from Citadel to edit.
            </Banner>
          </div>
        )}
        <main className="min-w-0 flex-1">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
