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
    <SidebarProvider data-admin-shell>
      <AdminSidebar />
      <SidebarInset className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-background px-3 md:hidden">
          <SidebarTrigger />
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">C</span>
            <span className="text-sm font-semibold">Cigarro</span>
          </div>
        </header>
        <main className="flex-1">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
