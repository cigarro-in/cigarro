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

  // Same admin sources as classic: collection-linked titles/products,
  // section titles, and on/off toggles (absent = enabled).
  const on = (name: string) => data?.sectionsEnabled?.[name] !== false;

  const sections = useMemo(() => {
    const list = [] as { id: string; slug: string; title: string; products: any[] }[];
    if (on('featured_products') && data?.featuredProducts?.length) {
      list.push({
        id: 'featured',
        slug: 'featured',
        title: data.featuredSectionConfig?.title || 'Featured',
        products: data.featuredProducts,
      });
    }
    if (on('product_showcase') && data?.showcaseProducts?.length) {
      list.push({
        id: 'showcase',
        slug: 'showcase',
        title: data.showcaseConfig?.title || data.showcaseCollection?.title || 'Showcase',
        products: data.showcaseProducts,
      });
    }
    if (on('categories_section')) {
      (data?.categoriesWithProducts || []).forEach((c) => {
        list.push({ id: c.id, slug: c.slug, title: c.name, products: c.products });
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const onSelect = (slug: string) => {
    setActiveSlug(slug);
    const el = document.getElementById(`section-${slug}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <SEOHead
        title="Cigarro | Cigarettes and Tobacco Products Online"
        description="Browse cigarette brands, variants, pack options and related tobacco products online at Cigarro. For adults of legal smoking age only."
        url="https://cigarro.in/"
        type="website"
      />

      {on('hero_section') && (
        <div className="max-w-[1280px] mx-auto px-4 pt-5">
          <VividHeroBanners slides={data?.heroSlides} isLoading={isLoading} />
        </div>
      )}

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

          {/* Brands strip (admin title via Homepage > Section Titles) */}
          {on('brands_section') && !isLoading && (data?.brands?.length || 0) > 0 && (
            <section>
              <h2 className="vv-section-title">{data?.brandsSectionConfig?.title || 'Brands'}</h2>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-4 md:overflow-visible">
                {(data?.brands || []).slice(0, 8).map((b) => (
                  <a
                    key={b.id}
                    href={`/brand/${b.slug}`}
                    className="vv-card shrink-0 snap-start w-[140px] md:w-auto p-3 text-center"
                  >
                    {b.logo_url ? (
                      <img src={b.logo_url} alt={b.name} className="w-12 h-12 mx-auto object-contain mb-2" />
                    ) : (
                      <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center font-serif font-bold">
                        {b.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="text-sm font-medium line-clamp-2">{b.name}</div>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Blog strip */}
          {on('blog_section') && !isLoading && (data?.blogPosts?.length || 0) > 0 && (
            <section>
              <h2 className="vv-section-title">{data?.blogSectionConfig?.title || 'Blogs'}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {(data?.blogPosts || []).slice(0, 4).map((p) => (
                  <a key={p.id} href={`/blog/${p.slug}`} className="vv-card p-4 block">
                    <div className="text-xs opacity-60 mb-1">{p.category?.name || ''}</div>
                    <div className="font-medium leading-snug line-clamp-2">{p.title}</div>
                    {p.excerpt && <div className="text-sm opacity-70 mt-1 line-clamp-2">{p.excerpt}</div>}
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right cart panel — desktop only */}
        <div className="hidden md:block">
          <VividCartPanel />
        </div>
      </div>
    </>
  );
}
