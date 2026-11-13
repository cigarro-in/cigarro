import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X, LogOut } from 'lucide-react';
import { useAuth, useAuthDialog } from '../../hooks/useAuth';
import { useCategoriesHub } from '../../hooks/data/useCatalog';
import { VividBrandMark } from './VividHeaderParts';

interface Props {
  open: boolean;
  onClose: () => void;
  storeName: string;
  logoUrl: string;
}

const PAGE_LINKS = [
  { to: '/about', label: 'About us' },
  { to: '/blogs', label: 'Blog' },
  { to: '/contact', label: 'Contact' },
  { to: '/shipping', label: 'Shipping' },
  { to: '/terms', label: 'Terms' },
  { to: '/privacy', label: 'Privacy' },
];

/** Left sidebar: categories, pages and account links. Opened by the header's menu button. */
export function VividNavDrawer({ open, onClose, storeName, logoUrl }: Props) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { requestAuth } = useAuthDialog();
  const { categories } = useCategoriesHub();

  // Browser back/forward changes the page: the drawer closes with it.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const firstName = user?.name?.split(' ')[0];

  return (
    <div className={`fixed inset-0 z-[70] ${open ? '' : 'invisible pointer-events-none'}`} aria-hidden={!open}>
      <div
        className={`absolute inset-0 bg-[var(--vv-bg-overlay)] transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      <aside
        id="vv-nav-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        className={`absolute left-0 top-0 bottom-0 w-[min(340px,88vw)] flex flex-col bg-[var(--color-surface)] border-r border-[var(--color-border)] shadow-[var(--vv-shadow-lg)] transition-transform duration-200 ease-out ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between gap-3 h-16 px-4 border-b border-[var(--color-border)]">
          <VividBrandMark storeName={storeName} logoUrl={logoUrl} className="min-w-0" />
          <button type="button" onClick={onClose} className="vv-icon-btn -mr-2" aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 space-y-6">
          <div className="px-2 py-2 rounded-[var(--vv-radius-md)] bg-[var(--color-surface-2)]">
            {user ? (
              <p className="text-sm text-[var(--color-foreground)] font-semibold px-1">
                Hi{firstName ? `, ${firstName}` : ''}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  requestAuth();
                }}
                className="vv-btn-primary w-full"
              >
                Sign in
              </button>
            )}
          </div>

          <Section title="Shop">
            <NavLink to="/products" onNavigate={onClose}>All products</NavLink>
            <NavLink to="/brands" onNavigate={onClose}>Brands</NavLink>
          </Section>

          <Section title="Categories">
            <NavLink to="/categories" onNavigate={onClose}>All categories</NavLink>
            {categories.map((cat) => (
              <NavLink key={cat.id} to={`/category/${cat.slug}`} onNavigate={onClose} indent>
                {cat.name}
              </NavLink>
            ))}
          </Section>

          {user && (
            <Section title="Account">
              <NavLink to="/orders" onNavigate={onClose}>My orders</NavLink>
              <NavLink to="/wishlist" onNavigate={onClose}>Wishlist</NavLink>
              <NavLink to="/addresses" onNavigate={onClose}>Addresses</NavLink>
              <NavLink to="/profile" onNavigate={onClose}>Profile</NavLink>
            </Section>
          )}

          <Section title="Information">
            {PAGE_LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} onNavigate={onClose}>{l.label}</NavLink>
            ))}
          </Section>
        </div>

        {user && (
          <div className="p-3 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => {
                onClose();
                void signOut();
              }}
              className="w-full h-11 px-3 rounded-[var(--vv-radius-md)] flex items-center gap-3 text-sm font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-2)]"
            >
              <LogOut className="w-4 h-4 text-[var(--color-muted-foreground)]" />
              Sign out
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="px-2 mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-muted-foreground)]">{title}</h2>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

function NavLink({ to, children, onNavigate, indent = false }: { to: string; children: ReactNode; onNavigate: () => void; indent?: boolean }) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={`min-h-[44px] flex items-center rounded-[var(--vv-radius-md)] text-[15px] text-[var(--color-foreground)] hover:bg-[var(--color-surface-2)] ${indent ? 'pl-6 pr-2 text-sm text-[var(--color-muted-foreground)]' : 'px-2 font-medium'}`}
    >
      <span className="min-w-0 truncate">{children}</span>
    </Link>
  );
}
