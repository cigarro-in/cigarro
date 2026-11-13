import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useStoreSettings } from '../../hooks/data/useStoreSettings';
import { getProductImageUrl } from '../../lib/images/urls';
import { ROUTES } from '../../config/routes';

// Storefront chrome in the reference layout: a left-aligned brand, a plain link row
// and a search box on the right, then a four-column footer. Visuals only; the
// shop data comes from hooks.

interface MinimalShellProps {
  children: ReactNode;
}

const NAV = [
  { to: ROUTES.HOME, label: 'Home', end: true },
  { to: ROUTES.PRODUCTS, label: 'Shop all' },
  { to: ROUTES.CATEGORIES, label: 'Collections' },
  { to: ROUTES.BLOGS, label: 'Blog' },
];

export function MinimalShell({ children }: MinimalShellProps) {
  const { settings } = useStoreSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const logo = settings.brand.logoUrl ? getProductImageUrl(settings.brand.logoUrl) : '';
  const address = settings.business.address;
  const addressLine = [address.line1, address.line2, address.city, address.state, address.pincode]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="dk">
      <header className="dk-header">
        <div className="dk-wrap dk-header-inner">
          <Link to={ROUTES.HOME} className="dk-brand" aria-label={settings.name}>
            {logo && <img src={logo} alt="" width={40} height={40} className="dk-brand-logo" />}
            <span className="dk-brand-name">{settings.name}</span>
          </Link>
          <button
            type="button"
            className="dk-menu-btn"
            aria-expanded={menuOpen}
            aria-controls="dk-nav"
            onClick={() => setMenuOpen((o) => !o)}
          >
            Menu
          </button>
          <nav id="dk-nav" className={`dk-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Main">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? 'dk-nav-link is-active' : 'dk-nav-link')}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <form className="dk-search" role="search" action={ROUTES.PRODUCTS} method="get">
            <input type="search" name="q" placeholder="Search cigarettes, tobacco, papers" aria-label="Search products" />
          </form>
        </div>
      </header>

      <main className="dk-main">{children}</main>

      <footer className="dk-footer">
        <div className="dk-wrap dk-footer-grid">
          <div>
            <p className="dk-footer-name">{settings.business.legalName || settings.name}</p>
            {addressLine && <p className="dk-muted">{addressLine}</p>}
          </div>
          <div>
            <p className="dk-footer-head">Help</p>
            <ul className="dk-footer-list">
              <li><Link to={ROUTES.CONTACT}>Contact</Link></li>
              <li><Link to={ROUTES.SHIPPING}>Shipping</Link></li>
              <li><Link to={ROUTES.RETURNS}>Returns &amp; refunds</Link></li>
            </ul>
          </div>
          <div>
            <p className="dk-footer-head">Legal</p>
            <ul className="dk-footer-list">
              <li><Link to={ROUTES.PRIVACY}>Privacy policy</Link></li>
              <li><Link to={ROUTES.TERMS}>Terms &amp; conditions</Link></li>
              <li><Link to={ROUTES.ABOUT}>About us</Link></li>
            </ul>
          </div>
          <div>
            <p className="dk-footer-head">Follow</p>
            <ul className="dk-footer-list">
              {settings.socials.instagram && <li><a href={settings.socials.instagram} rel="noopener">Instagram</a></li>}
              {settings.socials.facebook && <li><a href={settings.socials.facebook} rel="noopener">Facebook</a></li>}
              {settings.socials.youtube && <li><a href={settings.socials.youtube} rel="noopener">YouTube</a></li>}
              {settings.business.supportEmail && <li><a href={`mailto:${settings.business.supportEmail}`}>{settings.business.supportEmail}</a></li>}
            </ul>
          </div>
        </div>
        <div className="dk-wrap dk-copy">© {settings.name}. All rights reserved.</div>
      </footer>
    </div>
  );
}
