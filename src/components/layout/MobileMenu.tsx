import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useWishlist } from '../../hooks/useWishlist';
import { 
  ShoppingBag, 
  Heart, 
  Package, 
  User, 
  LogOut, 
  Grid3x3,
  Info,
  Phone,
  FileText,
  Shield,
  Truck,
  BookOpen,
  Star,
  X
} from 'lucide-react';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileMenu = ({ isOpen, onClose }: MobileMenuProps) => {
  const { user, signOut } = useAuth();
  const { wishlistCount } = useWishlist();

  const menuSections = [
    {
      title: 'Shop',
      items: [
        { icon: Grid3x3, label: 'All Products', path: '/products' },
        { icon: Star, label: 'Categories', path: '/categories' },
        { icon: Heart, label: 'Wishlist', path: '/wishlist', badge: wishlistCount },
        { icon: ShoppingBag, label: 'Shopping Cart', path: '/cart' },
      ]
    },
    {
      title: 'Account',
      items: user ? [
        { icon: Package, label: 'My Orders', path: '/orders' },
        { icon: Heart, label: 'My Wishlist', path: '/wishlist' },
        ...(user.isAdmin ? [{ icon: User, label: 'Admin Dashboard', path: '/admin' }] : []),
      ] : [
        { icon: User, label: 'Sign In / Register', path: '/auth', action: 'auth' },
      ]
    },
    {
      title: 'Information',
      items: [
        { icon: Info, label: 'About Us', path: '/about' },
        { icon: BookOpen, label: 'Blog', path: '/blogs' },
        { icon: Phone, label: 'Contact Us', path: '/contact' },
        { icon: Truck, label: 'Shipping Info', path: '/shipping' },
      ]
    },
    {
      title: 'Legal',
      items: [
        { icon: Shield, label: 'Privacy Policy', path: '/privacy' },
        { icon: FileText, label: 'Terms of Service', path: '/terms' },
      ]
    }
  ];

  // Keep mounted for smooth animations
  return (
    <div
      className={`md:hidden fixed inset-0 z-[99999] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      aria-hidden={!isOpen}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Left-side drawer - Standardized Mobile Sidebar */}
      <div
        className={`fixed left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-background border-r border-border shadow-xl transform transition-transform duration-300 ease-out will-change-transform flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* FROZEN HEADER */}
        <div className="flex-shrink-0 sticky top-0 z-10 p-6 border-b border-border bg-background/95 backdrop-blur-sm">
          <div className="text-foreground font-serif font-normal tracking-tight leading-none text-2xl uppercase mb-2">
            CIGARRO
          </div>
          {user && (
            <div>
              <p className="font-medium text-foreground text-base">{user.name}</p>
            </div>
          )}
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto overscroll-y-bounce">
          {menuSections.map((section) => (
            <div key={section.title} className="py-4">
              <div className="px-6 mb-3">
                <h3 className="text-foreground font-sans font-semibold uppercase text-sm tracking-wider">
                  {section.title}
                </h3>
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className="flex items-center gap-4 px-6 py-3 text-foreground hover:bg-muted/50 transition-colors duration-200"
                      onClick={onClose}
                    >
                      <Icon className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
                      <span className="flex-1 font-sans text-base">{item.label}</span>
                      {'badge' in item && item.badge !== undefined && item.badge > 0 && (
                        <span className="bg-primary text-primary-foreground text-xs font-medium rounded-full w-6 h-6 flex items-center justify-center">
                          {item.badge > 9 ? '9+' : item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

        </div>

        {/* FROZEN FOOTER WITH SIGN OUT */}
        {user && (
          <div className="flex-shrink-0 sticky bottom-0 z-10 bg-background/95 backdrop-blur-sm border-t border-border">
            <button
              onClick={() => {
                signOut();
                onClose();
              }}
              className="flex items-center gap-4 px-6 py-3 text-foreground hover:bg-muted/50 transition-colors duration-200 w-full text-left"
            >
              <LogOut className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
              <span className="font-sans text-base">Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
