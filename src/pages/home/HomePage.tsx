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
  // Admin Homepage toggles; absent row = enabled (existing installs unaffected).
  const on = (name: string) => data?.sectionsEnabled?.[name] !== false;

  return (
    <>
      <SEOHead
        title="Cigarro - Premium Cigarettes & Tobacco Online"
        description="India's premier online marketplace for premium cigarettes, cigars, and tobacco products. Authentic brands, nationwide delivery."
        url="https://cigarro.in/"
        type="website"
        keywords={['premium cigarettes', 'buy cigars online', 'tobacco products India', 'cigarette delivery', 'authentic cigarettes', 'luxury tobacco']}
        image={data?.heroSlides?.[0]?.image_url}
      />
      {on('hero_section') && <Hero slides={data?.heroSlides} isLoading={isLoading} />}

      {/* Same sections on mobile + desktop (each section is responsive) */}
      {on('categories_section') && (
        <CategoriesScroller categories={data?.categories} config={data?.categoriesSectionConfig} isLoading={isLoading} />
      )}

      <div className="h-0 md:h-12"></div>

      {on('featured_products') && (
        <Suspense fallback={<SectionFallback height="h-[500px]" />}>
          <FeaturedProducts
            products={data?.featuredProducts}
            config={data?.featuredSectionConfig}
            isLoading={isLoading}
          />
        </Suspense>
      )}

      {on('brands_section') && (
        <Suspense fallback={<SectionFallback height="h-32" />}>
          <BrandsScroller brands={data?.brands} config={data?.brandsSectionConfig} isLoading={isLoading} />
        </Suspense>
      )}

      {on('categories_section') && (
        <Suspense fallback={<SectionFallback height="h-[800px]" />}>
          <CategoryShowcases
            categoriesWithProducts={data?.categoriesWithProducts}
            isLoading={isLoading}
          />
        </Suspense>
      )}

      {on('product_showcase') && (
        <Suspense fallback={<SectionFallback height="h-[600px]" />}>
          <ProductShowcase
            products={data?.showcaseProducts}
            config={data?.showcaseConfig}
            collection={data?.showcaseCollection}
            isLoading={isLoading}
          />
        </Suspense>
      )}
      <div className="h-8 md:h-12"></div>

      {on('categories_section') && (
        <Suspense fallback={<SectionFallback height="h-[600px]" />}>
          <CategoriesGrid
            categories={data?.categories}
            config={data?.categoriesSectionConfig}
            isLoading={isLoading}
          />
        </Suspense>
      )}

      <div className="h-8 md:h-12"></div>
      {on('blog_section') && (
        <Suspense fallback={<SectionFallback height="h-[400px]" />}>
          <BlogSection
            posts={data?.blogPosts}
            config={data?.blogSectionConfig}
            isLoading={isLoading}
          />
        </Suspense>
      )}
    </>
  );
}
