import { Suspense, lazy } from 'react';
import { SEOHead } from '../../components/seo/SEOHead';
import Hero from './Hero';
import { CategoriesScroller } from './CategoriesScroller';
import { useHomepageData } from '../../hooks/useHomepageData';

// Lazy load non-critical components to improve initial page load
const FeaturedProducts = lazy(() => import('./FeaturedProducts').then(m => ({ default: m.FeaturedProducts })));
const BrandsScroller = lazy(() => import('./BrandsScroller').then(m => ({ default: m.BrandsScroller })));
const CategoryShowcases = lazy(() => import('./CategoryShowcases').then(m => ({ default: m.CategoryShowcases })));
const ProductShowcase = lazy(() => import('./ProductShowcase').then(m => ({ default: m.ProductShowcase })));
const CategoriesGrid = lazy(() => import('./CategoriesGrid').then(m => ({ default: m.CategoriesGrid })));
const BlogSection = lazy(() => import('./BlogSection').then(m => ({ default: m.BlogSection })));

// Minimal fallback to prevent layout shifts
const SectionFallback = ({ height = "h-96" }: { height?: string }) => (
  <div className={`w-full ${height} animate-pulse bg-transparent`} />
);

export function HomePage() {
  const { data, isLoading } = useHomepageData();
  
  console.log('🏠 HomePage data:', { 
    categoriesWithProducts: data?.categoriesWithProducts,
    isLoading 
  });

  return (
    <>
      <SEOHead
        title="Cigarro - Premium Cigarettes & Tobacco Online"
        description="India's premier online marketplace for premium cigarettes, cigars, and tobacco products. Authentic brands, nationwide delivery, 18+ only."
        url="https://cigarro.in/"
        type="website"
        keywords={['premium cigarettes', 'buy cigars online', 'tobacco products India', 'cigarette delivery', 'authentic cigarettes', 'luxury tobacco']}
        image={data?.heroSlides?.[0]?.image_url}
      />
      <Hero slides={data?.heroSlides} isLoading={isLoading} />
      
      {/* Mobile: Categories Scroller, Desktop: Skip to Featured */}
      <div className="md:hidden">
        <CategoriesScroller categories={data?.categories} isLoading={isLoading} />
      </div>
      
      <div className="h-0 md:h-12"></div>
      
      <Suspense fallback={<SectionFallback height="h-[500px]" />}>
        <FeaturedProducts 
          products={data?.featuredProducts} 
          config={data?.featuredSectionConfig}
          isLoading={isLoading} 
        />
      </Suspense>
      
      {/* Mobile: Brands Scroller */}
      <div className="md:hidden">
        <Suspense fallback={<SectionFallback height="h-32" />}>
          <BrandsScroller brands={data?.brands} isLoading={isLoading} />
        </Suspense>
      </div>
      
      {/* Category Showcases with Products - TEMP: Showing on all devices for debugging */}
      <div className="">{/* Fixed syntax */}
        <Suspense fallback={<SectionFallback height="h-[800px]" />}>
          <CategoryShowcases 
            categoriesWithProducts={data?.categoriesWithProducts} 
            isLoading={isLoading} 
          />
        </Suspense>
      </div>
      
      <Suspense fallback={<SectionFallback height="h-[600px]" />}>
        <ProductShowcase 
          products={data?.showcaseProducts} 
          config={data?.showcaseConfig}
          isLoading={isLoading} 
        />
      </Suspense>
      <div className="h-8 md:h-12"></div>
      
      {/* Desktop: Full Categories Grid */}
      <div className="hidden md:block">
        <Suspense fallback={<SectionFallback height="h-[600px]" />}>
          <CategoriesGrid 
            categories={data?.categories} 
            isLoading={isLoading} 
          />
        </Suspense>
      </div>
      
      <div className="h-8 md:h-12"></div>
      <Suspense fallback={<SectionFallback height="h-[400px]" />}>
        <BlogSection 
          posts={data?.blogPosts} 
          config={data?.blogSectionConfig}
          isLoading={isLoading} 
        />
      </Suspense>
    </>
  );
}
