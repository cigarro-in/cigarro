import React from 'react';
import { Instagram, Twitter, Facebook, Mail } from 'lucide-react';

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
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
                {/* Products Column */}
                <div>
                  <h4 className="suptitle text-dark mb-4">Products</h4>
                  <div className="space-y-3">
                    <a href="/cigars" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Premium Cigars
                    </a>
                    <a href="/cigarettes" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Luxury Cigarettes
                    </a>
                    <a href="/accessories" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Accessories
                    </a>
                    <a href="/limited-edition" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Limited Editions
                    </a>
                  </div>
                </div>
                
                {/* Services Column */}
                <div>
                  <h4 className="suptitle text-dark mb-4">Services</h4>
                  <div className="space-y-3">
                    <a href="/trade" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Trading Platform
                    </a>
                    <a href="/authentication" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Authentication
                    </a>
                    <a href="/storage" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Premium Storage
                    </a>
                    <a href="/consultation" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Expert Consultation
                    </a>
                  </div>
                </div>
                
                {/* Company Column */}
                <div>
                  <h4 className="suptitle text-dark mb-4">Company</h4>
                  <div className="space-y-3">
                    <a href="/about" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      About Us
                    </a>
                    <a href="/contact" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Contact
                    </a>
                    <a href="/careers" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Careers
                    </a>
                    <a href="/press" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Press
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Social Networks */}
          <div className="text-center mb-12">
            <div className="flex justify-center space-x-6">
              <a href="#" className="w-11 h-11 bg-transparent border border-dark/20 rounded-full flex items-center justify-center hover:bg-dark hover:text-creme-light transition-all duration-300">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="w-11 h-11 bg-transparent border border-dark/20 rounded-full flex items-center justify-center hover:bg-dark hover:text-creme-light transition-all duration-300">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="w-11 h-11 bg-transparent border border-dark/20 rounded-full flex items-center justify-center hover:bg-dark hover:text-creme-light transition-all duration-300">
                <Facebook className="w-5 h-5" />
              </a>
            </div>
          </div>
          
          {/* Bottom Bar */}
          <div className="border-t border-coyote pt-6">
            <div className="flex flex-col lg:flex-row justify-between items-center space-y-4 lg:space-y-0">
              {/* Logo */}
              <div className="flex items-center space-x-6">
                <div className="text-2xl font-serif font-normal text-dark">Cigarro</div>
                <div className="w-16 h-16 bg-dark/5 rounded-lg flex items-center justify-center">
                  <div className="text-xs font-medium text-dark">PREMIUM</div>
                </div>
              </div>
              
              {/* Copyright */}
              <div className="text-coyote text-sm leading-relaxed px-6">
                © 2025 Cigarro Premium Marketplace. All rights reserved.
              </div>
              
              {/* Legal Links */}
              <div className="flex space-x-6">
                <a href="/privacy" className="text-dark hover:text-canyon transition-colors text-sm">
                  Privacy Policy
                </a>
                <a href="/terms" className="text-dark hover:text-canyon transition-colors text-sm">
                  Terms of Service
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
