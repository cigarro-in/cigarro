import { Link } from 'react-router-dom';
import { useHomepageData } from '../../hooks/useHomepageData';
import { SEOHead } from '../../components/seo/SEOHead';
import { getProductImageUrl } from '../../lib/supabase/storage';

export function VividCategories() {
  const { data, isLoading } = useHomepageData();
  const categories = data?.categories || [];

  return (
    <>
      <SEOHead
        title="All Categories"
        description="Browse all categories of premium tobacco products."
        url="https://cigarro.in/categories"
        type="website"
      />

      <div className="max-w-[1280px] mx-auto px-4 py-6">
        <header className="vv-page-header">
          <h1 className="vv-page-title">Categories</h1>
          <p className="vv-page-subtitle">
            Browse by category to find exactly what you're after.
          </p>
        </header>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="vv-card overflow-hidden">
                <div className="aspect-[4/3] vv-skeleton" />
                <div className="p-3 space-y-2">
                  <div className="h-4 w-2/3 vv-skeleton" />
                  <div className="h-3 w-1/3 vv-skeleton" />
                </div>
              </div>
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="vv-empty">
            <div className="vv-empty-icon">📦</div>
            <p className="vv-empty-title">No categories yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/category/${cat.slug}`}
                className="vv-card vv-card--lift overflow-hidden group"
              >
                <div className="aspect-[4/3] bg-[var(--vv-bg-inset)] overflow-hidden">
                  {cat.image ? (
                    <img
                      src={getProductImageUrl(cat.image)}
                      alt={cat.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-[var(--vv-fg-subtle)] text-3xl">
                      📂
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-semibold text-[15px] text-[var(--vv-fg)] leading-tight">
                    {cat.name}
                  </p>
                  {cat.description && (
                    <p className="text-xs text-[var(--vv-fg-muted)] mt-1 line-clamp-2">
                      {cat.description}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
