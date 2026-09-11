import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { SEOHead } from '../components/seo/SEOHead';

/**
 * NotFoundPage — client-side fallback for unknown URLs (audit T7).
 * Pure view: no Supabase / Convex imports (theme-decoupling rule).
 * Emits noindex so dead URLs never become indexable via the SPA shell;
 * bot-facing HTTP 404s are served at the edge (functions/ssr-middleware.js).
 */
export function NotFoundPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/products${query.trim() ? `?search=${encodeURIComponent(query.trim())}` : ''}`);
  };

  return (
    <>
      <SEOHead
        title="Page not found"
        description="The page you requested does not exist. Search the Cigarro catalog or browse products, categories and brands."
        url={`https://cigarro.in${location.pathname}`}
        type="website"
        robots="noindex, follow"
        keywords={[]}
      />

      <div className="min-h-screen bg-background pb-20 md:pb-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <p className="text-sm font-medium text-muted-foreground mb-2">404</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Page not found
          </h1>
          <p className="text-muted-foreground leading-relaxed mb-8">
            No page exists at <span className="font-mono text-sm break-all">{location.pathname}</span>.
            It may have been removed, or the link may be incorrect.
          </p>

          <form onSubmit={submitSearch} role="search" className="flex gap-2 mb-10">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search brand or product, e.g. Dunhill"
              aria-label="Search the catalog"
              className="flex-1 rounded-lg border border-border/40 bg-card px-4 py-2.5 text-foreground placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-primary-foreground font-medium"
            >
              <Search className="w-4 h-4" />
              Search
            </button>
          </form>

          <nav aria-label="Site" className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-accent">
            <Link to="/" className="underline underline-offset-4">Home</Link>
            <Link to="/products" className="underline underline-offset-4">All products</Link>
            <Link to="/categories" className="underline underline-offset-4">Categories</Link>
            <Link to="/brands" className="underline underline-offset-4">Brands</Link>
            <Link to="/blogs" className="underline underline-offset-4">Blog</Link>
            <Link to="/contact" className="underline underline-offset-4">Contact</Link>
          </nav>
        </div>
      </div>
    </>
  );
}

export default NotFoundPage;
