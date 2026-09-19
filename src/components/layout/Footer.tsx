import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { useFullCatalog } from '../../hooks/data/useCatalog';

interface FooterBrand { id: string; name: string; slug: string; }

const Footer = () => {
  const [brands, setBrands] = useState<FooterBrand[]>([]);
  // Wave 3: footer brand list from the Convex catalog.
  const { brands: catalogBrands, loading } = useFullCatalog();
  useEffect(() => {
    if (loading) return;
    setBrands(
      (catalogBrands as any[])
        .filter((b: any) => b.isActive)
        .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)))
        .map((b: any) => ({ id: b.supabaseId, name: b.name, slug: b.slug })),
    );
  }, [catalogBrands, loading]);
  return (
    <footer className="section bg-creme-light relative overflow-hidden z-10">
      {/* Background Video (optional) - Commented out until video file is added */}
      {/* <video 
        className="absolute left-0 right-0 top-0 bottom-0 w-full h-full object-cover z-[-1] pointer-events-none opacity-30"
        autoPlay
        muted
        loop
        playsInline
      >
        <source src="/media/cigarro-background-video.mp4" type="video/mp4" />
      </video> */}
      
      <div className="main-container">
        <div className="bg-creme-light rounded-lg p-8 lg:p-16">
          {/* Main Footer Content */}
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 lg:gap-16 mb-12">
            {/* Brand promise and support */}
            <div className="lg:col-span-4 text-center">
              <h3 className="font-serif text-dark text-[clamp(2rem,4000vw/1440,4rem)] font-normal mb-8 px-8">
                Clear information. Straightforward support.
              </h3>
              <a
                href="mailto:support@cigarro.in"
                className="inline-flex items-center gap-2 text-dark hover:text-canyon transition-colors"
              >
                <Mail className="w-5 h-5" />
                support@cigarro.in
              </a>
            </div>
            
            {/* Menu Links */}
            <div className="lg:col-span-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {/* Shop Column */}
                <div>
                  <h4 className="suptitle text-dark mb-4">Shop</h4>
                  <div className="space-y-3">
                    <Link to="/products" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      All Products
                    </Link>
                    <Link to="/categories" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Categories
                    </Link>
                    <Link to="/category/cigarettes" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Cigarettes
                    </Link>
                    <Link to="/category/rolling-stuff" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Rolling Papers
                    </Link>
                  </div>
                </div>

                {/* Brands Column — indexable deep links */}
                <div>
                  <h4 className="suptitle text-dark mb-4">Brands</h4>
                  <div className="space-y-3">
                    <Link to="/brands" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      All Brands
                    </Link>
                    {brands.slice(0, 8).map(b => (
                      <Link key={b.id} to={`/brand/${b.slug}`} className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                        {b.name}
                      </Link>
                    ))}
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
                    <Link to="/about" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      About Us
                    </Link>
                    <Link to="/contact" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Contact
                    </Link>
                  </div>
                </div>

                {/* Information Column */}
                <div>
                  <h4 className="suptitle text-dark mb-4">Information</h4>
                  <div className="space-y-3">
                    <Link to="/blogs" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Blog
                    </Link>
                    <Link to="/shipping" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Shipping Info
                    </Link>
                    <Link to="/returns" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Returns Policy
                    </Link>
                    <Link to="/privacy" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Privacy Policy
                    </Link>
                    <Link to="/terms" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Terms of Service
                    </Link>
                    <a href="/sitemap.xml" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      Sitemap
                    </a>
                    <Link to="/agents" className="block text-dark hover:text-canyon transition-colors text-base leading-relaxed">
                      AI Agents
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
                {new Date().getFullYear()} Cigarro. All rights reserved.
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
