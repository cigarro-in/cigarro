import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, ShoppingCart, User, Grid3X3, Home, Package } from 'lucide-react';
import { useCart } from '../../hooks/useCart';
import { useAuth } from '../../hooks/useAuth';
import { PhoneAuthDialog } from '../../components/auth/PhoneAuthDialog';

interface Props {
  children: ReactNode;
}

export function VividShell({ children }: Props) {
  const { totalItems } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [authOpen, setAuthOpen] = useState(false);

  const hideBottomNav =
    location.pathname.startsWith('/checkout') ||
    location.pathname.startsWith('/mobile-checkout') ||
    location.pathname.startsWith('/desktop-checkout');

  const onSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get('q')?.toString().trim();
    if (q) navigate(`/products?search=${encodeURIComponent(q)}`);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-background)' }}>
      <header className="sticky top-0 z-40 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
        <div className="max-w-[1280px] mx-auto px-4 h-16 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
            <span className="w-9 h-9 rounded-full bg-[var(--color-foreground)] text-[var(--color-surface)] grid place-items-center text-sm font-black">
              C
            </span>
            <span className="hidden sm:inline font-bold text-[var(--color-foreground)] tracking-tight">
              Cigarro
            </span>
          </Link>

          <form onSubmit={onSearchSubmit} className="flex-1 max-w-xl mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)]" />
              <input
                name="q"
                placeholder="Search for products..."
                className="w-full bg-[var(--color-surface-2)] border border-transparent rounded-lg pl-10 pr-4 h-10 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] focus:outline-none focus:bg-[var(--color-surface)] focus:border-[var(--color-primary)]"
              />
            </div>
          </form>

          <nav className="flex items-center gap-2 flex-shrink-0">
            <HeaderLink to="/categories" icon={<Grid3X3 className="w-4 h-4" />} label="Categories" />
            <HeaderLink
              to="/cart"
              icon={<ShoppingCart className="w-4 h-4" />}
              label="Cart"
              badge={totalItems}
            />
            {user ? (
              <HeaderLink to="/profile" icon={<User className="w-4 h-4" />} label="Account" />
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="relative px-3 py-2 rounded-lg text-sm text-[var(--color-foreground)] hover:bg-[var(--color-surface-2)] flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                <span className="hidden md:inline">Sign in</span>
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className={`flex-1 ${hideBottomNav ? '' : 'pb-20 md:pb-0'}`}>{children}</main>

      <footer className="hidden md:block mt-12 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-[1280px] mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div>
            <h4 className="text-[var(--color-foreground)] font-bold mb-3">Cigarro</h4>
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
          © {new Date().getFullYear()} Cigarro. All rights reserved.
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
              <BottomButton onClick={() => setAuthOpen(true)} icon={<Package className="w-5 h-5" />} label="Orders" />
            )}
            {user ? (
              <BottomLink to="/profile" icon={<User className="w-5 h-5" />} label="Me" active={location.pathname.startsWith('/profile')} />
            ) : (
              <BottomButton onClick={() => setAuthOpen(true)} icon={<User className="w-5 h-5" />} label="Sign in" />
            )}
          </div>
        </nav>
      )}

      <PhoneAuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}

function BottomButton({ onClick, icon, label }: { onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-0.5 text-[10px] text-[var(--color-muted-foreground)]"
    >
      {icon}
      {label}
    </button>
  );
}

function HeaderLink({
  to,
  icon,
  label,
  badge,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <Link
      to={to}
      className="relative px-3 py-2 rounded-lg text-sm text-[var(--color-foreground)] hover:bg-[var(--color-surface-2)] flex items-center gap-2"
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-bold grid place-items-center">
          {badge}
        </span>
      )}
    </Link>
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
      className={`flex flex-col items-center justify-center gap-0.5 text-[10px] ${
        active ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted-foreground)]'
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
