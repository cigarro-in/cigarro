import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronsUpDown, ExternalLink, Keyboard, LogOut, Settings, UserRound } from 'lucide-react';
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
import { useOrg } from '../../lib/convex/useOrg';
import { adminPath } from '../lib/paths';
import { maskPhone, signOutOfAdmin, switchAdminStore } from '../lib/adminAuth';
import { useAdminStores } from '../hooks/useAdminStores';
import { ErrorBanner, toActionError, type ActionError } from '../ui';
import { ProfileDialog } from '../features/account/ProfileDialog';
import { ShortcutsDialog } from '../features/account/ShortcutsDialog';
import { roleLabel, useMyStoreProfile, useStoreHostname } from '../features/account/useStoreAccount';

// Shared row: 40px tall, icon + label.
const ROW = 'min-h-10 gap-3 rounded-[var(--admin-radius-sm)] px-2.5 text-sm';
const ICON = 'size-4 shrink-0 text-[var(--admin-text-muted)]';

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
 * Top-left store and account menu (desktop sidebar header and mobile drawer).
 * The trigger shows store icon, store name and the admin's own name. The menu
 * opens on the admin's name and role, then Profile, Store settings, View
 * store, Keyboard shortcuts, Switch store (only with 2+ stores) and Log out.
 */
export function AdminStoreMenu({ storeName, iconUrl }: { storeName: string; iconUrl?: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { stores } = useAdminStores();
  const org = useOrg();
  const orgId = org?._id;
  const profile = useMyStoreProfile(orgId);
  const address = useStoreHostname(orgId);
  const [switching, setSwitching] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<ActionError | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const adminName = profile?.name || user?.name || maskPhone(user?.phone) || 'Admin';
  const role = profile?.role;
  const currentSlug = org?.slug;
  const hostname = address?.hostname ?? null;

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
                forwardRef, so Radix never received the trigger ref and the menu
                rendered off-screen. */}
            <DropdownMenuTrigger
              aria-label="Store and account menu"
              className="flex h-16 w-full items-center gap-3 overflow-hidden rounded-md px-3 text-left text-[15px] outline-hidden ring-sidebar-ring transition-[background-color,transform] duration-150 hover:bg-sidebar-accent focus-visible:ring-2 active:scale-[0.99] data-[state=open]:bg-sidebar-accent motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              <StoreIcon name={storeName} iconUrl={iconUrl} />
              <span className="grid min-w-0 flex-1 text-left leading-snug">
                <span className="truncate text-base font-semibold">{storeName}</span>
                <span className="truncate text-sm text-[var(--admin-text-muted)]">{adminName}</span>
              </span>
              <ChevronsUpDown className="ml-auto size-5 shrink-0 text-[var(--admin-text-muted)]" aria-hidden />
            </DropdownMenuTrigger>

            <DropdownMenuContent side="bottom" align="start" className="w-[17rem] p-1">
              <DropdownMenuLabel className="flex flex-col gap-0.5 px-2.5 py-2 font-normal">
                <span className="truncate text-sm font-semibold text-[var(--admin-text)]">{adminName}</span>
                <span className="truncate text-xs text-[var(--admin-text-muted)]">{roleLabel(role)}</span>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem className={ROW} onSelect={() => setProfileOpen(true)}>
                  <UserRound className={ICON} aria-hidden />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem className={ROW} onSelect={() => navigate(adminPath('/settings'))}>
                  <Settings className={ICON} aria-hidden />
                  Store settings
                </DropdownMenuItem>
                {hostname ? (
                  <DropdownMenuItem asChild className={ROW}>
                    <a href={`https://${hostname}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className={ICON} aria-hidden />
                      <span className="min-w-0 flex-1">
                        View store
                        <span className="block truncate text-xs text-[var(--admin-text-muted)]">{hostname}</span>
                      </span>
                    </a>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem disabled className={ROW}>
                    <ExternalLink className={ICON} aria-hidden />
                    <span className="min-w-0 flex-1">
                      View store
                      <span className="block truncate text-xs text-[var(--admin-text-muted)]">
                        {address === undefined ? 'Loading address' : 'No live domain yet'}
                      </span>
                    </span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className={ROW} onSelect={() => setShortcutsOpen(true)}>
                  <Keyboard className={ICON} aria-hidden />
                  Keyboard shortcuts
                </DropdownMenuItem>
              </DropdownMenuGroup>

              {stores.length > 1 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="px-2.5 py-1.5 text-xs font-medium text-[var(--admin-text-muted)]">
                    Switch store
                  </DropdownMenuLabel>
                  <DropdownMenuGroup>
                    {stores.map((store) => {
                      const current = store.slug === currentSlug;
                      return (
                        <DropdownMenuItem
                          key={store.slug}
                          className={ROW}
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
              <DropdownMenuItem
                className={`${ROW} text-[var(--admin-critical)] focus:text-[var(--admin-critical)]`}
                onSelect={() => signOutOfAdmin()}
              >
                <LogOut className="size-4 shrink-0" aria-hidden />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      {orgId && (
        <ProfileDialog
          open={profileOpen}
          onOpenChange={setProfileOpen}
          orgId={orgId}
          name={profile?.name ?? user?.name ?? null}
          phone={profile?.phone ?? user?.phone ?? null}
          role={role}
          storeName={storeName}
        />
      )}
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  );
}
