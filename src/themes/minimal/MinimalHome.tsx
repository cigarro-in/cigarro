import { Link } from 'react-router-dom';
import { useFullCatalog } from '../../hooks/data/useCatalog';
import { useHeroSlides } from '../../hooks/data/useContent';
import { useStoreSettings } from '../../hooks/data/useStoreSettings';
import { SEOHead } from '../../components/seo/SEOHead';
import { getProductImageUrl } from '../../lib/images/urls';
import { ROUTES } from '../../config/routes';
import { MinimalCard } from './MinimalCard';

// Home in the reference layout: one hero (the single h1 of the page), a row of category
// tiles, then the newest products in a grid. Server-rendered (eager, see ssrRoutes):
// no window, storage or random values during render.

const isInternal = (href: string) => href.startsWith('/');

export function MinimalHome() {
  const { settings } = useStoreSettings();
  const { slides, loading: slidesLoading } = useHeroSlides();
  const { products, categories, productCategories, loading } = useFullCatalog();
  const hero = slides.find((s) => s.isActive !== false) ?? slides[0];

  const activeCats = categories.filter((c: any) => c.isActive !== false);
  const countByCat = new Map<string, number>();
  for (const j of productCategories as Array<{ categorySupabaseId: string }>) {
    countByCat.set(j.categorySupabaseId, (countByCat.get(j.categorySupabaseId) || 0) + 1);
  }
  const shown = products.filter((p) => p.is_active !== false).slice(0, 24);

  return (
    <>
      <SEOHead
        title={settings.metaTitle || settings.name}
        description={settings.metaDescription || settings.seo.defaultDescription}
        url={ROUTES.HOME}
      />

      {hero ? (
        <section className="dk-hero" aria-labelledby="dk-hero-title">
          <div className="dk-wrap dk-hero-inner">
            <div className="dk-hero-copy">
              {hero.suptitle && <span className="dk-eyebrow">{hero.suptitle}</span>}
              <h1 id="dk-hero-title" className="dk-hero-title">{hero.title || settings.name}</h1>
              {hero.subtitle && <p className="dk-lead">{hero.subtitle}</p>}
              {hero.buttonText && hero.buttonUrl && (
                isInternal(hero.buttonUrl) ? (
                  <Link to={hero.buttonUrl} className="dk-btn dk-btn-primary">{hero.buttonText}</Link>
                ) : (
                  <a href={hero.buttonUrl} className="dk-btn dk-btn-primary">{hero.buttonText}</a>
                )
              )}
            </div>
            {hero.imageUrl && (
              <div className="dk-hero-media">
                <img
                  src={getProductImageUrl(hero.imageUrl)}
                  alt=""
                  width={800}
                  height={600}
                  fetchPriority="high"
                  decoding="async"
                />
              </div>
            )}
          </div>
        </section>
      ) : (
        !slidesLoading && (
          <section className="dk-wrap dk-intro">
            <h1 className="dk-hero-title">{settings.name}</h1>
          </section>
        )
      )}

      {activeCats.length > 0 && (
        <section className="dk-wrap dk-section" aria-labelledby="dk-cats-title">
          <div className="dk-section-head">
            <h2 id="dk-cats-title" className="dk-section-title">Shop by category</h2>
            <Link to={ROUTES.CATEGORIES} className="dk-more">View all</Link>
          </div>
          <ul className="dk-tiles">
            {activeCats.map((c: any) => (
              <li key={c.supabaseId}>
                <Link to={ROUTES.CATEGORY.replace(':slug', encodeURIComponent(c.slug))} className="dk-tile">
                  <span className="dk-tile-media">
                    {c.image ? <img src={getProductImageUrl(c.image)} alt="" loading="lazy" decoding="async" width={160} height={160} /> : null}
                  </span>
                  <span className="dk-tile-name">{c.name}</span>
                  <span className="dk-tile-count">{countByCat.get(c.supabaseId) ?? 0} products</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="dk-wrap dk-section" aria-labelledby="dk-products-title">
        <div className="dk-section-head">
          <h2 id="dk-products-title" className="dk-section-title">All products</h2>
          <Link to={ROUTES.PRODUCTS} className="dk-more">Shop all</Link>
        </div>
        {loading ? (
          <p className="dk-muted">Loading products…</p>
        ) : (
          <ul className="dk-grid">
            {shown.map((p) => (
              <li key={p.id}>
                <MinimalCard product={p} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
