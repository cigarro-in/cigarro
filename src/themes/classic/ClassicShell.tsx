import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import { BreadcrumbNav } from '../../components/layout/BreadcrumbNav';
import { MobileHeader } from '../../components/layout/MobileHeader';
import { MobileMenu } from '../../components/layout/MobileMenu';
import { MobileBottomNav } from '../../components/layout/MobileBottomNav';

interface ClassicShellProps {
  children: ReactNode;
}

// Classic storefront shell. Desktop and mobile chrome are CSS-switched (md:),
// but the page content is rendered ONCE and sits between them. Before this,
// App rendered the whole route tree twice (desktop + mobile), which doubled
// the markup on every page and the SSR payload with it.
export function ClassicShell({ children }: ClassicShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Hide bottom nav on checkout + transaction pages (fullscreen payment flow)
  const hideBottomNav =
    location.pathname === '/checkout' ||
    location.pathname === '/mobile-checkout' ||
    location.pathname.startsWith('/transaction');

  return (
    <div className="min-h-screen bg-creme font-sans">
      <div className="hidden md:block">
        <Header />
        <BreadcrumbNav />
      </div>

      <div className="md:hidden">
        <MobileHeader
          onMenuToggle={() => setIsMobileMenuOpen((open) => !open)}
          isMenuOpen={isMobileMenuOpen}
        />
        <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      </div>

      <main>{children}</main>

      <div className="hidden md:block">
        <Footer />
      </div>

      {!hideBottomNav && <MobileBottomNav />}
    </div>
  );
}
