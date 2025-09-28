import React from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="section bg-creme-light relative overflow-hidden z-10">
      {/* Background Video (optional) */}
      <video 
        className="absolute left-0 right-0 top-0 bottom-0 w-full h-full object-cover z-[-1] pointer-events-none opacity-30"
        autoPlay
        muted
        loop
        playsInline
      >
        <source src="/media/cigarro-background-video.mp4" type="video/mp4" />
      </video>
      
      <div className="main-container">
        <div className="bg-creme-light rounded-lg p-8 lg:p-16">
          {/* Main Footer Content */}
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 lg:gap-16 mb-12">
            {/* Newsletter Section */}
            <div className="lg:col-span-4 text-center">
              <h3 className="font-serif text-dark text-[clamp(2rem,4000vw/1440,4rem)] font-normal mb-8 px-8">
                Stay informed about our exclusive releases
              </h3>
              
              {/* Newsletter Form */}
              <div className="relative max-w-md mx-auto">
                <input 
                  type="email" 
                  placeholder="Enter your email address"
                  className="w-full bg-transparent text-dark placeholder-dark/60 border-b border-dark/30 pb-4 pr-16 text-base font-normal focus:outline-none focus:border-dark transition-colors"
                />
                <button className="absolute right-2 bottom-2 w-6 h-6 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-dark hover:text-canyon transition-colors" />
                </button>
              </div>
            </div>
            
            {/* Menu Links */}
            <div className="lg:col-span-6">
              <div className="grid grid-cols-3 gap-8">
                {/* Shop Column */}
                <div>
                  <h4 className="suptitle text-dark mb-4">Shop</h4>
                  <div className="space-y-3">
                    <Link to="/products" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      All Products
                    </Link>
                    <Link to="/collections" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Collections
                    </Link>
                    <Link to="/wishlist" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Wishlist
                    </Link>
                    <Link to="/cart" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Shopping Cart
                    </Link>
                  </div>
                </div>
                
                {/* Account Column */}
                <div>
                  <h4 className="suptitle text-dark mb-4">Account</h4>
                  <div className="space-y-3">
                    <Link to="/orders" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      My Orders
                    </Link>
                    <Link to="/wishlist" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      My Wishlist
                    </Link>
                    <Link to="/checkout" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Checkout
                    </Link>
                    <Link to="/about" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      About Us
                    </Link>
                  </div>
                </div>
                
                {/* Information Column */}
                <div>
                  <h4 className="suptitle text-dark mb-4">Information</h4>
                  <div className="space-y-3">
                    <Link to="/blog" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Blog
                    </Link>
                    <Link to="/contact" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Contact Us
                    </Link>
                    <Link to="/shipping" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Shipping Info
                    </Link>
                    <Link to="/privacy" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Privacy Policy
                    </Link>
                    <Link to="/terms" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Terms of Service
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          
          {/* Bottom Bar */}
          <div className="border-t border-coyote pt-6">
            <div className="text-center">
              {/* Copyright */}
              <div className="text-coyote text-base leading-relaxed">
                © 2025 Cigarro. All rights reserved.
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
