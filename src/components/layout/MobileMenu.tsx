import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useWishlist } from '../../hooks/useWishlist';
import { InstallPWA } from '../pwa/InstallPWA';
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
  X,
  ChevronRight,
  ArrowRight
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

  return (
    <div
      className={`md:hidden fixed inset-0 z-[99999] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      aria-hidden={!isOpen}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Left-side Sidebar - Enhanced Design */}
      <div
        className={`fixed left-0 top-0 bottom-0 w-[85vw] max-w-xs bg-background border-r border-border shadow-2xl transform transition-transform duration-300 ease-out will-change-transform flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 p-6 bg-background relative">
            <button 
                onClick={onClose}
                className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
                <X size={24} strokeWidth={1.5} />
            </button>
            
            <div className="mb-4">
                <h1 className="text-3xl font-serif text-foreground tracking-tight">CIGARRO</h1>
            </div>
            
            {user ? (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-serif">
                        {user.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                        <p className="font-sans font-medium text-foreground text-sm">Welcome back,</p>
                        <p className="font-serif text-foreground text-lg leading-none">{user.name?.split(' ')[0]}</p>
                    </div>
                </div>
            ) : (
                <Link 
                    to="/auth" 
                    className="flex items-center gap-2 text-primary font-sans font-medium hover:text-foreground transition-colors group"
                    onClick={onClose}
                >
                    Sign in to your account <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
            )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overscroll-y-bounce bg-background px-4 py-6">
          <div className="space-y-8">
            {menuSections.map((section) => (
              <div key={section.title}>
                <div className="px-2 mb-3">
                  <h3 className="text-muted-foreground font-sans font-bold uppercase text-xs tracking-widest opacity-90">
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
                        className="flex items-center gap-4 px-3 py-3 rounded-lg text-foreground hover:bg-muted/50 transition-all duration-200 group"
                        onClick={onClose}
                      >
                        <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" strokeWidth={1.5} />
                        <span className="flex-1 font-sans font-medium text-base">{item.label}</span>
                        {'badge' in item && item.badge !== undefined && item.badge > 0 && (
                          <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full px-2 py-0.5 min-w-[1.5rem] text-center">
                            {item.badge > 9 ? '9+' : item.badge}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-8 px-2">
            <InstallPWA />
          </div>
        </div>

        {/* Footer */}
        {user && (
          <div className="flex-shrink-0 p-4 bg-background">
            <button
              onClick={() => {
                signOut();
                onClose();
              }}
              className="flex items-center justify-between w-full px-4 py-3 text-foreground hover:bg-muted/10 rounded-lg transition-colors duration-200"
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
                <span className="font-sans font-medium">Sign Out</span>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
