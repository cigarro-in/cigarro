import React, { useState } from 'react';
import { MobileHeader } from './MobileHeader';
import { MobileMenu } from './MobileMenu';
import { MobileBottomNav } from './MobileBottomNav';

interface MobileLayoutProps {
  children: React.ReactNode;
}

export const MobileLayout = ({ children }: MobileLayoutProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

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

      {/* Bottom Navigation */}
      <MobileBottomNav />
    </>
  );
};
