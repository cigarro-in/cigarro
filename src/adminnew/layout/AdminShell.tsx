import { ReactNode } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '../../components/ui/sidebar';
import { AdminSidebar } from './AdminSidebar';

interface AdminShellProps {
  children: ReactNode;
}

/**
 * Admin Shell - Main layout wrapper
 * Provides consistent sidebar and header across all admin pages
 * Shell stays mounted during navigation to prevent flickering
 */
export function AdminShell({ children }: AdminShellProps) {
  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset className="min-h-screen flex flex-col">
        {/* Mobile-only top bar with hamburger trigger */}
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-3 bg-white/95 backdrop-blur border-b border-[var(--color-coyote)]/30">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2">
            <div className="flex aspect-square size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <span className="font-bold text-sm">A</span>
            </div>
            <span className="font-semibold text-sm">Admin Panel</span>
          </div>
        </header>
        <main className="flex-1">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
