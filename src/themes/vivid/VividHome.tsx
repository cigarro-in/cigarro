import { useState, useMemo } from 'react';
import { useHomepageData } from '../../hooks/useHomepageData';
import { SEOHead } from '../../components/seo/SEOHead';
import { VividHeroBanners } from './VividHeroBanners';
import { VividCategorySidebar } from './VividCategorySidebar';
import { VividCartPanel } from './VividCartPanel';
import { VividProductSection } from './VividProductSection';
import { VividCategoryChips } from './VividCategoryChips';

export function VividHome() {
  const { data, isLoading } = useHomepageData();
  const [activeSlug, setActiveSlug] = useState<string | undefined>();

  const sections = useMemo(() => {
    const list = [] as { id: string; slug: string; title: string; products: any[] }[];
    if (data?.featuredProducts?.length) {
      list.push({
        id: 'featured',
        slug: 'featured',
        title: data.featuredSectionConfig?.title || 'Featured',
        products: data.featuredProducts,
      });
    }
    (data?.categoriesWithProducts || []).forEach((c) => {
      list.push({ id: c.id, slug: c.slug, title: c.name, products: c.products });
    });
    return list;
  }, [data]);

  const onSelect = (slug: string) => {
    setActiveSlug(slug);
    const el = document.getElementById(`section-${slug}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <SEOHead
        title="Cigarro - Premium Cigarettes & Tobacco Online"
        description="India's premier online marketplace for premium cigarettes and tobacco products."
        url="https://cigarro.in/"
        type="website"
      />

      <div className="max-w-[1280px] mx-auto px-4 pt-5">
        <VividHeroBanners slides={data?.heroSlides} isLoading={isLoading} />
      </div>

      {/* Mobile: horizontal category chips */}
      <div className="md:hidden max-w-[1280px] mx-auto px-4 pt-5">
        <VividCategoryChips categories={data?.categories} isLoading={isLoading} />
      </div>

      <div className="max-w-[1280px] mx-auto px-4 pt-6 pb-10 grid gap-5 md:grid-cols-[220px_1fr_300px] lg:grid-cols-[240px_1fr_320px]">
        {/* Left sidebar — desktop only */}
        <div className="hidden md:block">
          <VividCategorySidebar
            categories={data?.categories}
            categoriesWithProducts={data?.categoriesWithProducts}
            activeSlug={activeSlug}
            onSelect={onSelect}
          />
        </div>

        {/* Main */}
        <div className="space-y-8 min-w-0">
          {isLoading && sections.length === 0 && (
            <VividProductSection title="Loading" products={[]} isLoading />
          )}
          {sections.map((s) => (
            <VividProductSection
              key={s.id}
              title={s.title}
              products={s.products}
              anchorId={`section-${s.slug}`}
            />
          ))}
        </div>

        {/* Right cart panel — desktop only */}
        <div className="hidden md:block">
          <VividCartPanel />
        </div>
      </div>
    </>
  );
}
