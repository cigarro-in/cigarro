import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Package, MapPin, Heart, Wallet, Star, Gift, Settings, LogOut, Phone } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { SEOHead } from '../../components/seo/SEOHead';

const initials = (name?: string | null) => {
  if (!name) return 'C';
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

interface MenuItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  hint?: string;
}

const MENU: MenuItem[] = [
  { to: '/orders', icon: <Package className="w-[18px] h-[18px]" />, label: 'Orders', hint: 'Track & reorder' },
  { to: '/addresses', icon: <MapPin className="w-[18px] h-[18px]" />, label: 'Addresses', hint: 'Delivery locations' },
  { to: '/wishlist', icon: <Heart className="w-[18px] h-[18px]" />, label: 'Wishlist', hint: 'Saved items' },
  { to: '/wallet', icon: <Wallet className="w-[18px] h-[18px]" />, label: 'Wallet', hint: 'Credits & cashback' },
  { to: '/reviews', icon: <Star className="w-[18px] h-[18px]" />, label: 'Reviews', hint: 'Your ratings' },
  { to: '/referrals', icon: <Gift className="w-[18px] h-[18px]" />, label: 'Refer & earn', hint: 'Invite friends' },
  { to: '/profile/settings', icon: <Settings className="w-[18px] h-[18px]" />, label: 'Settings', hint: 'Name, preferences' },
];

export function VividProfile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <>
      <SEOHead title="Your account" description="Manage your account" url="https://cigarro.in/profile" type="website" />

      <div className="max-w-[880px] mx-auto px-4 py-6">
        {/* Identity card */}
        <div className="vv-surface p-5 mb-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[var(--vv-brand-soft)] text-[var(--vv-brand)] grid place-items-center text-lg font-bold">
            {initials(user?.name)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-[var(--vv-fg)] truncate">
              {user?.name || 'Customer'}
            </h1>
            {user?.phone && (
              <p className="text-sm text-[var(--vv-fg-muted)] flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />
                {user.phone.startsWith('+') ? user.phone : `+${user.phone}`}
              </p>
            )}
          </div>
          <button
            onClick={handleSignOut}
            className="vv-btn vv-btn-outline vv-btn--sm"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>

        {/* Menu */}
        <div className="vv-surface overflow-hidden">
          {MENU.map((item, i) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-5 py-3.5 hover:bg-[var(--vv-bg-inset)] transition-colors ${
                i > 0 ? 'border-t border-[var(--vv-border)]' : ''
              }`}
            >
              <span className="w-9 h-9 rounded-[10px] bg-[var(--vv-bg-inset)] text-[var(--vv-fg-muted)] grid place-items-center">
                {item.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-[var(--vv-fg)] leading-tight">
                  {item.label}
                </p>
                {item.hint && (
                  <p className="text-xs text-[var(--vv-fg-muted)] mt-0.5">{item.hint}</p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--vv-fg-subtle)]" />
            </Link>
          ))}
        </div>

        <p className="text-center text-xs text-[var(--vv-fg-subtle)] mt-8">
          Cigarro · 18+ only
        </p>
      </div>
    </>
  );
}
