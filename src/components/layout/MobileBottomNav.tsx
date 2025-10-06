import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ShoppingBag, Package, User, Grid3x3 } from 'lucide-react';
import { useCart } from '../../hooks/useCart';
import { useAuth } from '../../hooks/useAuth';
import { AuthDialog } from '../auth/AuthDialog';

export const MobileBottomNav = () => {
  const location = useLocation();
  const { totalItems } = useCart();
  const { user } = useAuth();
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);

  const handleProfileClick = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      setIsAuthDialogOpen(true);
    }
  };

  // Single uniform items list (Home same style as others)
  const navItems = [
    {
      path: '/',
      icon: Home,
      label: 'Home',
      exact: true
    },
    {
      path: '/products',
      icon: Grid3x3,
      label: 'Products',
      exact: false
    },
    {
      path: '/cart',
      icon: ShoppingBag,
      label: 'Cart',
      badge: totalItems,
      exact: true
    },
    {
      path: '/orders',
      icon: Package,
      label: 'Orders',
      exact: true,
      requiresAuth: true as const
    },
    {
      path: user ? '/orders' : '#',
      icon: User,
      label: user ? 'Profile' : 'Login',
      exact: true,
      onClick: handleProfileClick
    }
  ] as const;

  const isActive = (path: string, exact: boolean) => {
    if (path === '#') return false;
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  // Don't show on admin pages
  if (location.pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-background/95 backdrop-blur-sm border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item, index) => {
            const Icon = item.icon as any;
            const active = item.path !== '#' && isActive(item.path, item.exact);
            if ((item as any).requiresAuth && !user) {
              return (
                <button
                  key={index}
                  onClick={() => setIsAuthDialogOpen(true)}
                  className="flex flex-col items-center justify-center flex-1 h-full relative transition-colors duration-200 text-muted-foreground"
                >
                  <div className="relative">
                    <Icon className="w-6 h-6" strokeWidth={1.5} />
                  </div>
                  <span className="text-xs mt-1 font-sans font-normal">{item.label}</span>
                </button>
              );
            }
            return (
              <Link
                key={index}
                to={item.path}
                onClick={(item as any).onClick}
                className={`flex flex-col items-center justify-center flex-1 h-full relative transition-colors duration-200 ${active ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                <div className="relative">
                  <Icon className={`w-6 h-6 ${active ? 'scale-110' : ''} transition-all`} strokeWidth={active ? 2 : 1.5} />
                  {'badge' in item && (item as any).badge !== undefined && (item as any).badge > 0 && (
                    <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-medium rounded-full w-5 h-5 flex items-center justify-center">
                      {(item as any).badge > 9 ? '9+' : (item as any).badge}
                    </span>
                  )}
                </div>
                <span className={`text-xs mt-1 font-sans ${active ? 'font-semibold' : 'font-normal'}`}>{item.label}</span>
                {active && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-primary rounded-full" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Authentication Dialog */}
      <AuthDialog 
        open={isAuthDialogOpen} 
        onOpenChange={setIsAuthDialogOpen} 
      />
    </>
  );
};
