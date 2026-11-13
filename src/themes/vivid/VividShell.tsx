import { useCallback, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Grid3X3, Home, Package, User } from 'lucide-react';
import { useCart } from '../../hooks/useCart';
import { useAuth, useAuthDialog } from '../../hooks/useAuth';
import { VividMobileHeader } from './VividMobileHeader';
import { VividDesktopHeader } from './VividDesktopHeader';
import { VividSearchBar } from './VividSearchBar';
import { VividNavDrawer } from './VividNavDrawer';
import { VividCartDrawer } from './VividCartDrawer';

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
  const { user } = useAuth();
  const location = useLocation();
  const { requestAuth } = useAuthDialog();
  const [navOpen, setNavOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const closeNav = useCallback(() => setNavOpen(false), []);
  const closeCart = useCallback(() => setCartOpen(false), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const toggleSearch = useCallback(() => setSearchOpen((open) => !open), []);

  const hideBottomNav =
    location.pathname.startsWith('/checkout') ||
    location.pathname.startsWith('/mobile-checkout') ||
    location.pathname.startsWith('/desktop-checkout') ||
    location.pathname.startsWith('/transaction');

  const headerProps = {
    storeName,
    logoUrl,
    cartCount: totalItems,
    navOpen,
    searchOpen,
    onMenu: () => setNavOpen(true),
    onSearch: toggleSearch,
    onCart: () => setCartOpen(true),
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

      <main className={`flex-1 ${hideBottomNav ? '' : 'pb-20 md:pb-0'}`}>{children}</main>

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
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--color-surface)] border-t border-[var(--color-border)] pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-4 h-14">
            <BottomLink to="/" icon={<Home className="w-5 h-5" />} label="Home" active={location.pathname === '/'} />
            <BottomLink to="/categories" icon={<Grid3X3 className="w-5 h-5" />} label="Categories" active={location.pathname.startsWith('/categor')} />
            {user ? (
              <BottomLink to="/orders" icon={<Package className="w-5 h-5" />} label="Orders" active={location.pathname.startsWith('/orders')} />
            ) : (
              <BottomButton onClick={() => requestAuth()} icon={<Package className="w-5 h-5" />} label="Orders" />
            )}
            {user ? (
              <BottomLink to="/profile" icon={<User className="w-5 h-5" />} label="Me" active={location.pathname.startsWith('/profile')} />
            ) : (
              <BottomButton onClick={() => requestAuth()} icon={<User className="w-5 h-5" />} label="Sign in" />
            )}
          </div>
        </nav>
      )}

      {/* Auth dialog is hosted once in AppContent via the shared controller. */}
    </div>
  );
}

function BottomButton({ onClick, icon, label }: { onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] text-[var(--color-muted-foreground)]"
    >
      {icon}
      {label}
    </button>
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
