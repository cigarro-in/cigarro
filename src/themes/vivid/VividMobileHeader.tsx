import { Menu, Search } from 'lucide-react';
import { VividBrandMark, VividCartButton, VividHeaderFrame, VividHomeLink } from './VividHeaderParts';

export interface VividHeaderProps {
  storeName: string;
  logoUrl: string;
  cartCount: number;
  navOpen: boolean;
  searchOpen: boolean;
  onMenu: () => void;
  onSearch: () => void;
  onCart: () => void;
}

/** Phone header: menu on the left, brand centred, search and cart on the right. */
export function VividMobileHeader({ storeName, logoUrl, cartCount, navOpen, searchOpen, onMenu, onSearch, onCart }: VividHeaderProps) {
  return (
    <VividHeaderFrame className="md:hidden">
      <div className="h-14 px-2 grid grid-cols-[44px_minmax(0,1fr)_88px] items-center gap-1">
        <button
          type="button"
          onClick={onMenu}
          className="vv-icon-btn"
          aria-label="Open menu"
          aria-expanded={navOpen}
          aria-controls="vv-nav-drawer"
        >
          <Menu className="w-5 h-5" strokeWidth={1.75} />
        </button>

        <VividHomeLink className="justify-center">
          <VividBrandMark storeName={storeName} logoUrl={logoUrl} className="max-w-full" />
        </VividHomeLink>

        <div className="flex items-center justify-end">
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
      </div>
    </VividHeaderFrame>
  );
}
