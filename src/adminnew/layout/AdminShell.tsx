import { ReactNode } from 'react';
import { SidebarProvider, SidebarInset } from '../../components/ui/sidebar';
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
  console.log('[AdminShell] render');
  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset className="min-h-screen flex flex-col">
        <main className="flex-1">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
