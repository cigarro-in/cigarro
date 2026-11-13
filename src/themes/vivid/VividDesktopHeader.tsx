import { Menu, Search } from 'lucide-react';
import { VividBrandMark, VividCartButton, VividHeaderFrame, VividHomeLink } from './VividHeaderParts';
import type { VividHeaderProps } from './VividMobileHeader';

/** Desktop header: menu and logo on the left, search and cart on the right. */
export function VividDesktopHeader({ storeName, logoUrl, cartCount, navOpen, searchOpen, onMenu, onSearch, onCart }: VividHeaderProps) {
  return (
    <VividHeaderFrame className="hidden md:block">
      <div className="max-w-[1280px] mx-auto px-4 h-16 flex items-center gap-3">
        <button
          type="button"
          onClick={onMenu}
          className="h-11 px-3 rounded-[var(--vv-radius-md)] flex items-center gap-2 text-sm font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-2)]"
          aria-label="Open menu"
          aria-expanded={navOpen}
          aria-controls="vv-nav-drawer"
        >
          <Menu className="w-5 h-5" strokeWidth={1.75} />
          <span>Menu</span>
        </button>

        <VividHomeLink>
          <VividBrandMark storeName={storeName} logoUrl={logoUrl} />
        </VividHomeLink>

        <div className="flex-1" />

        <button
          type="button"
          onClick={onSearch}
          className="vv-icon-btn"
          aria-label="Search products"
          aria-expanded={searchOpen}
          aria-controls="vv-search-bar"
        >
          <Search className="w-5 h-5" strokeWidth={1.75} />
        </button>
        <VividCartButton count={cartCount} onClick={onCart} />
      </div>
    </VividHeaderFrame>
  );
}
