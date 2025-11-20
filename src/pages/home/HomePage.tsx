import React from 'react';
import { SEOHead } from '../../components/seo/SEOHead';
import Hero from './Hero';
import { FeaturedProducts } from './FeaturedProducts';
import { CategoriesScroller } from './CategoriesScroller';
import { BrandsScroller } from './BrandsScroller';
import { CategoryShowcases } from './CategoryShowcases';
// import { BrandHeritage } from '../company/BrandHeritage';
import { ProductShowcase } from '../../components/products/ProductShowcase';
import { CategoriesGrid } from '../content/CategoriesGrid';
import { BlogSection } from '../content/BlogSection';

export function HomePage() {
  return (
    <>
      <SEOHead
        title="Cigarro - Premium Cigarettes & Tobacco Online"
        description="India's premier online marketplace for premium cigarettes, cigars, and tobacco products. Authentic brands, nationwide delivery, 18+ only."
        url="https://cigarro.in/"
        type="website"
        keywords={['premium cigarettes', 'buy cigars online', 'tobacco products India', 'cigarette delivery', 'authentic cigarettes', 'luxury tobacco']}
      />
      <Hero />
      
      {/* Mobile: Categories Scroller, Desktop: Skip to Featured */}
      <div className="md:hidden">
        <CategoriesScroller />
      </div>
      
      <div className="h-0 md:h-12"></div>
      <FeaturedProducts />
      
      {/* Mobile: Brands Scroller */}
      <div className="md:hidden">
        <BrandsScroller />
      </div>
      
      {/* Mobile: Category Showcases with Products */}
      <div className="md:hidden">
        <CategoryShowcases />
      </div>
      
      {/* <div className="h-8 md:h-12"></div>
      <BrandHeritage />
      <div className="h-8 md:h-12"></div> */}
      <ProductShowcase />
      <div className="h-8 md:h-12"></div>
      
      {/* Desktop: Full Categories Grid */}
      <div className="hidden md:block">
        <CategoriesGrid />
      </div>
      
      <div className="h-8 md:h-12"></div>
      <BlogSection />
    </>
  );
}
