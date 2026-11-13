import { Link, useParams } from 'react-router-dom';
import { useFullCatalog } from '../../hooks/data/useCatalog';
import { SEOHead } from '../../components/seo/SEOHead';
import { ROUTES } from '../../config/routes';
import { MinimalCard } from './MinimalCard';

// Product listings in the reference layout: "all products" and one category (the
// Category slot receives the :slug route param). Visuals only; data via the hook.

interface Props {
  mode: 'all' | 'category';
}

export function MinimalCatalog({ mode }: Props) {
  const { slug } = useParams<{ slug: string }>();
  const { products, categories, loading } = useFullCatalog();

  const category = mode === 'category' ? categories.find((c: any) => c.slug === slug) : undefined;
  const list = products.filter((p) => {
    if (p.is_active === false) return false;
    if (mode === 'all') return true;
    return !!slug && p.categories?.some((c) => c.slug === slug);
  });

  const title = mode === 'all' ? 'All products' : category?.name ?? 'Category';
  const intro = mode === 'category' ? (category as any)?.description : undefined;
  const path = mode === 'all' ? ROUTES.PRODUCTS : ROUTES.CATEGORY.replace(':slug', encodeURIComponent(slug ?? ''));

  return (
    <div className="dk-wrap dk-section">
      <SEOHead
        title={(category as any)?.metaTitle || title}
        description={(category as any)?.metaDescription || intro?.replace(/<[^>]+>/g, ' ').slice(0, 160) || undefined}
        url={path}
      />
      <nav className="dk-crumbs" aria-label="Breadcrumb">
        <Link to={ROUTES.HOME}>Home</Link>
        <span aria-hidden="true"> / </span>
        {mode === 'category' ? <Link to={ROUTES.CATEGORIES}>Collections</Link> : <span>Shop all</span>}
        {mode === 'category' && <><span aria-hidden="true"> / </span><span>{title}</span></>}
      </nav>
      <h1 className="dk-section-title dk-page-title">{title}</h1>
      {intro && <div className="dk-prose" dangerouslySetInnerHTML={{ __html: intro }} />}
      {loading ? (
        <p className="dk-muted">Loading products…</p>
      ) : list.length === 0 ? (
        <p className="dk-muted">No products here yet.</p>
      ) : (
        <ul className="dk-grid">
          {list.map((p) => (
            <li key={p.id}>
              <MinimalCard product={p} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
