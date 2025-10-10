import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../utils/supabase/client';

interface Brand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  is_active: boolean;
  product_count?: number;
}

export function BrandsScroller() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    try {
      const { data: brandsData, error: brandsError } = await supabase
        .from('brands')
        .select('id, name, slug, description, logo_url, is_active')
        .eq('is_active', true)
        .order('name');

      if (brandsError) throw brandsError;

      // Get product counts for each brand
      const brandsWithCounts = await Promise.all(
        (brandsData || []).map(async (brand) => {
          const { count } = await supabase
            .from('products')
            .select('id', { count: 'exact' })
            .eq('brand', brand.name)
            .eq('is_active', true);

          return {
            ...brand,
            product_count: count || 0
          };
        })
      );

      // Filter out brands with no products
      setBrands(brandsWithCounts.filter(b => b.product_count && b.product_count > 0));
    } catch (error) {
      console.error('Error fetching brands:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <section className="py-6 bg-creme">
        <div className="px-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-dark"></div>
          </div>
        </div>
      </section>
    );
  }

  if (brands.length === 0) {
    return null;
  }

  return (
    <section className="py-6 bg-creme">
      <div className="px-4">
        {/* Section Header */}
        <div className="text-center mb-[1.5rem]">
          <h2 className="medium-title leading-tight text-2xl sm:text-3xl lg:text-4xl xl:text-5xl">
            Brands We Serve
          </h2>
        </div>

        {/* Horizontal Scroll Container */}
        <div 
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2"
          style={{ 
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {brands.map((brand) => (
            <Link
              key={brand.id}
              to={`/brands/${brand.slug}`}
              className="flex-shrink-0 snap-start w-[120px] group"
            >
              <div className="bg-white rounded-xl border border-coyote/20 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 h-full p-4">
                {/* Brand Logo/Name */}
                <div className="relative aspect-square bg-gradient-to-br from-coyote/5 to-canyon/5 rounded-lg flex items-center justify-center mb-3">
                  {brand.logo_url ? (
                    <img
                      src={brand.logo_url}
                      alt={brand.name}
                      className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="text-center">
                      <div className="text-2xl font-serif font-bold text-dark/80 leading-tight">
                        {brand.name.substring(0, 2).toUpperCase()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Brand Name */}
                <div className="text-center">
                  <h3 className="text-dark font-medium text-sm leading-tight group-hover:text-canyon transition-colors line-clamp-2 mb-1">
                    {brand.name}
                  </h3>
                  {brand.product_count !== undefined && (
                    <p className="text-dark/60 text-xs">
                      {brand.product_count} {brand.product_count === 1 ? 'Product' : 'Products'}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Hide scrollbar CSS */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  );
}
