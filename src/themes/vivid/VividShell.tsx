import { useCallback, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Grid3X3, Home, Search, ShoppingCart, User } from 'lucide-react';
import { useCart } from '../../hooks/useCart';
import { useAuth, useAuthDialog } from '../../hooks/useAuth';
import { VividMobileHeader } from './VividMobileHeader';
import { VividDesktopHeader } from './VividDesktopHeader';
import { VividSearchBar } from './VividSearchBar';
import { VividNavDrawer } from './VividNavDrawer';
import { VividCartDrawer } from './VividCartDrawer';
import { useLandedCartCount } from './cartFlight';

interface Props {
  children: ReactNode;
  storeName: string;
  logoUrl: string;
  legalName: string;
  brandColor?: string;
}

// Settings default for brand.brandColor (src/config/site.ts). A store that keeps
// the default keeps vivid's own blue; any other valid color becomes the brand.
const DEFAULT_SETTINGS_BRAND = '#8b4513';

/** Scoped token overrides for a store's brand color. Pure: safe during SSR render. */
export function vividBrandStyle(brandColor: string | undefined): Record<string, string> | undefined {
  const c = (brandColor ?? '').trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(c) || c === DEFAULT_SETTINGS_BRAND) return undefined;
  return {
    '--vv-brand': c,
    '--vv-brand-hover': c,
    '--vv-brand-active': c,
    '--vv-brand-soft': `color-mix(in srgb, ${c} 10%, #ffffff)`,
  };
}

export function VividShell({ children, storeName, logoUrl, legalName, brandColor }: Props) {
  const { totalItems } = useCart();
  // Bottom-bar badge: counts up when a product drop lands (see cartFlight.ts).
  const cartCount = useLandedCartCount(totalItems);
  const { user } = useAuth();
  const location = useLocation();
  const { requestAuth } = useAuthDialog();
  const [navOpen, setNavOpen] = useState(false);
  // Mobile cart sheet. Desktop uses the header dropdown (VividMiniCart) instead.
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const closeNav = useCallback(() => setNavOpen(false), []);
  const closeCart = useCallback(() => setCartOpen(false), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const toggleSearch = useCallback(() => setSearchOpen((open) => !open), []);
  const openCart = useCallback(() => setCartOpen(true), []);

  // Fullscreen payment flow: no bottom bar, so no bottom padding either.
  const hideBottomNav =
    location.pathname.startsWith('/checkout') ||
    location.pathname.startsWith('/mobile-checkout') ||
    location.pathname.startsWith('/desktop-checkout') ||
    location.pathname.startsWith('/transaction');

  const headerProps = {
    storeName,
    logoUrl,
    navOpen,
    searchOpen,
    onMenu: () => setNavOpen(true),
    onSearch: toggleSearch,
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-background)', ...vividBrandStyle(brandColor) }}>
      {/* Mobile and desktop headers are separate layouts, switched by CSS (md:). */}
      <div className="sticky top-0 z-40">
        <VividMobileHeader {...headerProps} />
        <VividDesktopHeader {...headerProps} />
        <VividSearchBar open={searchOpen} onClose={closeSearch} />
      </div>

      <VividNavDrawer open={navOpen} onClose={closeNav} storeName={storeName} logoUrl={logoUrl} />
      <VividCartDrawer open={cartOpen} onClose={closeCart} />

      <main className={`flex-1 ${hideBottomNav ? '' : 'pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0'}`}>{children}</main>

      <footer className="hidden md:block mt-12 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-[1280px] mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div>
            <h4 className="text-[var(--color-foreground)] font-bold mb-3">{storeName}</h4>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed">
              Premium tobacco marketplace. 18+ only.
            </p>
          </div>
          <FooterCol
            title="Shop"
            links={[
              { to: '/products', label: 'All products' },
              { to: '/categories', label: 'Categories' },
              { to: '/brands', label: 'Brands' },
            ]}
          />
          <FooterCol
            title="Help"
            links={[
              { to: '/contact', label: 'Contact' },
              { to: '/shipping', label: 'Shipping' },
              { to: '/terms', label: 'Terms' },
              { to: '/privacy', label: 'Privacy' },
            ]}
          />
          <FooterCol
            title="Account"
            links={[
              { to: '/profile', label: 'Profile' },
              { to: '/orders', label: 'Orders' },
              { to: '/wishlist', label: 'Wishlist' },
            ]}
          />
        </div>
        <div className="border-t border-[var(--color-border)] py-4 text-center text-xs text-[var(--color-muted-foreground)]">
          © {new Date().getFullYear()} {legalName}. All rights reserved.
        </div>
      </footer>

      {!hideBottomNav && (
        <nav
          aria-label="Shop navigation"
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--color-surface)] border-t border-[var(--color-border)] pb-[env(safe-area-inset-bottom)]"
        >
          <div className="grid grid-cols-5 h-16">
            <BottomLink to="/" icon={<Home className="w-5 h-5" />} label="Home" active={location.pathname === '/'} />
            <BottomLink to="/categories" icon={<Grid3X3 className="w-5 h-5" />} label="Categories" active={location.pathname.startsWith('/categor')} />
            <BottomCart count={cartCount} onClick={openCart} expanded={cartOpen} />
            <BottomButton onClick={toggleSearch} icon={<Search className="w-5 h-5" />} label="Search" active={searchOpen} expanded={searchOpen} controls="vv-search-bar" />
            {user ? (
              <BottomLink to="/profile" icon={<User className="w-5 h-5" />} label="Account" active={location.pathname.startsWith('/profile')} />
            ) : (
              <BottomButton onClick={() => requestAuth()} icon={<User className="w-5 h-5" />} label="Account" />
            )}
          </div>
        </nav>
      )}

      {/* Auth dialog is hosted once in AppContent via the shared controller. */}
    </div>
  );
}

/**
 * Cart tab, centred in the bottom bar. A raised primary disc with the count, so
 * it reads as the main action. data-cart-target is where product drops land.
 */
function BottomCart({ count, onClick, expanded }: { count: number; onClick: () => void; expanded: boolean }) {
  const label = count > 0 ? `Open cart, ${count} item${count === 1 ? '' : 's'}` : 'Open cart';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
      aria-controls="vv-cart-sheet"
      className="min-h-[44px] flex flex-col items-center justify-end gap-0.5 text-[10px] font-semibold text-[var(--color-foreground)]"
    >
      <span
        data-cart-target
        className="relative -mt-5 w-14 h-14 rounded-full bg-[var(--color-primary)] text-white grid place-items-center shadow-[var(--vv-shadow-md)] ring-4 ring-[var(--color-surface)]"
      >
        <ShoppingCart className="w-6 h-6" strokeWidth={1.75} />
        {count > 0 && (
          <span
            key={count}
            className="vv-bump absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-white text-[var(--color-primary)] text-[10px] font-bold leading-5 text-center ring-2 ring-[var(--color-surface)]"
            aria-hidden="true"
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </span>
      Cart
    </button>
  );
}

function BottomButton({
  onClick,
  icon,
  label,
  active = false,
  badge,
  expanded,
  controls,
}: {
  onClick: () => void;
  icon: ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
  expanded?: boolean;
  controls?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-controls={controls}
      className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] ${
        active ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted-foreground)]'
      }`}
    >
      <BottomIcon icon={icon} badge={badge} />
      {label}
    </button>
  );
}

/** Bottom bar icon with an optional count badge (cart). */
function BottomIcon({ icon, badge }: { icon: ReactNode; badge?: number }) {
  return (
    <span className="relative inline-flex">
      {icon}
      {badge !== undefined && badge > 0 && (
        <span
          key={badge}
          className="vv-bump absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-bold leading-[18px] text-center"
          aria-hidden="true"
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </span>
  );
}

function FooterCol({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <h5 className="text-[var(--color-foreground)] font-semibold mb-3">{title}</h5>
      <ul className="space-y-2 text-[var(--color-muted-foreground)]">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="hover:text-[var(--color-primary)]">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BottomLink({
  to,
  icon,
  label,
  active,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] ${
        active ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted-foreground)]'
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
