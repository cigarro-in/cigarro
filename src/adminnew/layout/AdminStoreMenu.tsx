import { useState } from 'react';
import { Check, ChevronsUpDown, ExternalLink, LogOut, UserRound } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuItem } from '../../components/ui/sidebar';
import { useAuth } from '../../hooks/useAuth';
import { useOrgInfo } from '../../lib/org/OrgContext';
import { useAdminStores } from '../hooks/useAdminStores';
import { maskPhone, signOutOfAdmin, switchAdminStore } from '../lib/adminAuth';
import { Dialog, ErrorBanner, toActionError, type ActionError } from '../ui';

function getInitial(value?: string | null) {
  return value?.trim().charAt(0).toUpperCase() || 'C';
}

/** Store icon: logo/favicon from site settings, else the first letter. */
export function StoreIcon({ name, iconUrl, size = 'md' }: { name: string; iconUrl?: string; size?: 'sm' | 'md' }) {
  const [broken, setBroken] = useState(false);
  const box = size === 'sm' ? 'size-6 text-xs rounded-[5px]' : 'size-9 text-base rounded-[8px]';
  if (iconUrl && !broken) {
    return (
      <img
        src={iconUrl}
        alt=""
        onError={() => setBroken(true)}
        className={`${box} shrink-0 border border-[var(--admin-border)] bg-white object-contain`}
      />
    );
  }
  return (
    <span className={`${box} flex shrink-0 items-center justify-center bg-[var(--admin-primary)] font-semibold text-white`}>
      {getInitial(name)}
    </span>
  );
}

/**
 * Top-left store + account menu (desktop sidebar header and mobile drawer).
 * Shows the store icon, store name and the signed-in admin. Opens: Profile,
 * Switch store (no new OTP), View store, Log out.
 */
export function AdminStoreMenu({ storeName, iconUrl }: { storeName: string; iconUrl?: string }) {
  const { user } = useAuth();
  const { stores } = useAdminStores();
  const info = useOrgInfo();
  const [switching, setSwitching] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<ActionError | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const adminLabel = user?.name || maskPhone(user?.phone) || 'Admin';

  const handleSwitch = async (targetSlug: string) => {
    setSwitchError(null);
    setSwitching(targetSlug);
    try {
      // Navigates to the target store on success.
      await switchAdminStore(targetSlug);
    } catch (error) {
      setSwitchError(toActionError(error, 'Could not switch store.'));
      setSwitching(null);
    }
  };

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            {/* A native button, not SidebarMenuButton: that component is not
                forwardRef, so Radix never received the trigger ref. Without the
                anchor, Radix keeps the menu at translate(0, -200%), off-screen,
                and the click appears to do nothing. */}
            <DropdownMenuTrigger
              aria-label="Store and account menu"
              className="flex h-16 w-full items-center gap-3 overflow-hidden rounded-md px-3 text-left text-[15px] outline-hidden ring-sidebar-ring transition-[background-color,transform] duration-150 hover:bg-sidebar-accent focus-visible:ring-2 active:scale-[0.99] data-[state=open]:bg-sidebar-accent motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              <StoreIcon name={storeName} iconUrl={iconUrl} />
              <span className="grid min-w-0 flex-1 text-left leading-snug">
                <span className="truncate text-base font-semibold">{storeName}</span>
                <span className="truncate text-sm text-[var(--admin-text-muted)]">{adminLabel}</span>
              </span>
              <ChevronsUpDown className="ml-auto size-5 shrink-0 text-[var(--admin-text-muted)]" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="start" className="w-[17rem] p-1">
              <div className="flex items-center gap-2.5 px-2 py-2">
                <StoreIcon name={storeName} iconUrl={iconUrl} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{storeName}</p>
                  <p className="truncate text-xs text-[var(--admin-text-muted)]">{info.primaryHost}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem className="gap-2" onSelect={() => setProfileOpen(true)}>
                  <UserRound className="size-4" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">Profile</span>
                  <span className="text-xs tabular-nums text-[var(--admin-text-subtle)]">{maskPhone(user?.phone)}</span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="gap-2">
                  <a href={`https://${info.primaryHost}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4" aria-hidden />
                    View store
                  </a>
                </DropdownMenuItem>
              </DropdownMenuGroup>

              {stores.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs font-medium text-[var(--admin-text-muted)]">Switch store</DropdownMenuLabel>
                  <DropdownMenuGroup>
                    {stores.map((store) => {
                      const current = store.slug === info.slug;
                      return (
                        <DropdownMenuItem
                          key={store.slug}
                          className="gap-2"
                          disabled={current || switching !== null}
                          onSelect={(e) => {
                            e.preventDefault();
                            void handleSwitch(store.slug);
                          }}
                        >
                          <StoreIcon name={store.name} size="sm" />
                          <span className="min-w-0 flex-1 truncate">{store.name}</span>
                          {current && <Check className="size-4 text-[var(--admin-primary)]" aria-label="Current store" />}
                          {switching === store.slug && <span className="text-xs text-[var(--admin-text-subtle)]">Opening...</span>}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuGroup>
                  {switchError && (
                    <div className="p-1">
                      <ErrorBanner error={switchError} />
                    </div>
                  )}
                </>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2" onSelect={() => signOutOfAdmin()}>
                <LogOut className="size-4" aria-hidden />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen} title="Profile" size="sm">
        <dl className="grid grid-cols-[6rem_1fr] gap-y-2 text-sm">
          <dt className="text-[var(--admin-text-muted)]">Name</dt>
          <dd className="truncate">{user?.name || 'Not set'}</dd>
          <dt className="text-[var(--admin-text-muted)]">Phone</dt>
          <dd className="tabular-nums">{user?.phone || 'Not set'}</dd>
          <dt className="text-[var(--admin-text-muted)]">Store</dt>
          <dd className="truncate">{storeName}</dd>
          <dt className="text-[var(--admin-text-muted)]">Stores</dt>
          <dd>{stores.length || 1}</dd>
        </dl>
      </Dialog>
    </>
  );
}
