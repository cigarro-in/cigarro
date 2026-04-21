import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase/client';
import { SEOHead } from '../../components/seo/SEOHead';
import { getProductImageUrl } from '../../lib/supabase/storage';

interface Brand {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
}

export function VividBrands() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from('brands')
        .select('id, name, slug, description, logo_url')
        .eq('is_active', true)
        .order('name');
      if (!cancelled) {
        setBrands((data as any) || []);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <SEOHead title="Brands" description="Shop by brand" url="https://cigarro.in/brands" type="website" />

      <div className="max-w-[1280px] mx-auto px-4 py-6">
        <header className="vv-page-header">
          <h1 className="vv-page-title">Brands</h1>
          <p className="vv-page-subtitle">Curated collection of premium tobacco makers.</p>
        </header>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="vv-card p-5">
                <div className="aspect-square vv-skeleton rounded-md" />
                <div className="h-4 w-2/3 vv-skeleton mt-3" />
              </div>
            ))}
          </div>
        ) : brands.length === 0 ? (
          <div className="vv-empty">
            <p className="vv-empty-title">No brands yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {brands.map((b) => (
              <Link key={b.id} to={`/brand/${b.slug}`} className="vv-card vv-card--lift p-5 text-center">
                <div className="aspect-square grid place-items-center mb-3 bg-[var(--vv-bg-inset)] rounded-md overflow-hidden">
                  {b.logo_url ? (
                    <img src={getProductImageUrl(b.logo_url)} alt={b.name} className="w-full h-full object-contain p-4" />
                  ) : (
                    <span className="text-2xl font-bold text-[var(--vv-fg-muted)]">{b.name[0]}</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-[var(--vv-fg)]">{b.name}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
