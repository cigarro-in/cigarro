import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MobileHeader } from './MobileHeader';
import { MobileMenu } from './MobileMenu';
import { MobileBottomNav } from './MobileBottomNav';

interface MobileLayoutProps {
  children: React.ReactNode;
}

export const MobileLayout = ({ children }: MobileLayoutProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const handleMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  // Hide bottom nav on checkout pages
  const hideBottomNav = location.pathname === '/checkout' || location.pathname === '/mobile-checkout';

  return (
    <>
      {/* Mobile Header */}
      <MobileHeader 
        onMenuToggle={handleMenuToggle}
        isMenuOpen={isMobileMenuOpen}
      />

      {/* Mobile Menu */}
      <MobileMenu 
        isOpen={isMobileMenuOpen}
        onClose={handleMenuClose}
      />

      {/* Main Content with proper spacing for mobile */}
      <div className="md:hidden">
        {children}
      </div>

      {/* Bottom Navigation - Hidden on checkout */}
      {!hideBottomNav && <MobileBottomNav />}
    </>
  );
};
