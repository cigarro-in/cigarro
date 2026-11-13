import type { ReactNode } from 'react';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '../../components/ui/sidebar';
import { useStoreSettings } from '../../hooks/data/useStoreSettings';
import { useOrg } from '../../lib/convex/useOrg';
import { AdminSidebar } from './AdminSidebar';
import { GmailBanner } from './GmailBanner';
import { StoreIcon } from './AdminStoreMenu';

/**
 * Admin shell: persistent sidebar (drawer on phones), a slim mobile top bar,
 * the Gmail connection banner, and the routed page. The shell stays mounted
 * across navigation so route changes never flash the frame.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const { settings: store } = useStoreSettings();
  const org = useOrg();
  const name = org?.name || store.name;
  return (
    <SidebarProvider data-admin-shell>
      <AdminSidebar />
      <SidebarInset className="flex min-h-svh min-w-0 flex-col bg-[var(--admin-bg)]">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 md:hidden">
          <SidebarTrigger className="size-9" aria-label="Open navigation" />
          <StoreIcon name={name} iconUrl={store.brand.faviconUrl || store.brand.logoUrl || undefined} size="sm" />
          <span className="min-w-0 truncate text-sm font-semibold">{name}</span>
        </header>
        <GmailBanner />
        <main className="min-w-0 flex-1">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
