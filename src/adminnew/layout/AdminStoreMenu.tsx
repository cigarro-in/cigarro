import { useState } from 'react';
import { Check, ChevronsUpDown, LogOut } from 'lucide-react';
import { InlineStatus, useInlineStatus } from '../../components/common/InlineStatus';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '../../components/ui/sidebar';
import { useAuth } from '../../hooks/useAuth';
import { useOrgInfo } from '../../lib/org/OrgContext';
import { useAdminStores } from '../hooks/useAdminStores';
import { maskPhone, signOutOfAdmin, switchAdminStore } from '../lib/adminAuth';

function getInitial(value?: string | null) {
  return value?.trim().charAt(0).toUpperCase() || 'C';
}

/**
 * Top-left profile and store menu for the admin shell (desktop sidebar header
 * and mobile drawer). Shows the current store, the other stores this phone
 * administers (switch without OTP), the masked phone, and sign out.
 */
export function AdminStoreMenu({ storeName }: { storeName: string }) {
  const { isMobile } = useSidebar();
  const { user } = useAuth();
  const { stores } = useAdminStores();
  const currentSlug = useOrgInfo().slug;
  const status = useInlineStatus();
  const [switching, setSwitching] = useState(false);

  const others = stores.filter((store) => store.slug !== currentSlug);

  const handleSwitch = async (targetSlug: string) => {
    status.clear();
    setSwitching(true);
    try {
      // Navigates to the target store on success.
      await switchAdminStore(targetSlug);
    } catch (error) {
      status.setError(error instanceof Error ? error.message : 'Could not switch store.');
      setSwitching(false);
    }
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" tooltip={storeName} aria-label="Store and account menu">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                {getInitial(storeName)}
              </span>
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold">{storeName}</span>
                <span className="truncate text-xs text-muted-foreground">Admin</span>
              </span>
              <ChevronsUpDown className="ml-auto" aria-hidden />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side={isMobile ? 'bottom' : 'right'} align="start" className="w-64">
            <DropdownMenuLabel>Current store</DropdownMenuLabel>
            <DropdownMenuGroup>
              <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
                <Check className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{storeName}</span>
              </div>
            </DropdownMenuGroup>

            {others.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Switch store</DropdownMenuLabel>
                <DropdownMenuGroup>
                  {others.map((store) => (
                    <DropdownMenuItem
                      key={store.slug}
                      disabled={switching}
                      onSelect={() => void handleSwitch(store.slug)}
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded bg-muted text-xs font-semibold">
                        {getInitial(store.name)}
                      </span>
                      <span className="truncate">{store.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </>
            )}

            {status.status.kind && (
              <div className="p-2">
                <InlineStatus status={status.status} />
              </div>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Signed in as</DropdownMenuLabel>
            <div className="px-2 pb-1.5 text-sm tabular-nums">{maskPhone(user?.phone)}</div>
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
  );
}
