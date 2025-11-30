import React from 'react';
import { Link } from 'react-router-dom';
import { Brand } from '../../types/home';

interface BrandsScrollerProps {
  brands?: Brand[];
  isLoading?: boolean;
}

export function BrandsScroller({ brands = [], isLoading = false }: BrandsScrollerProps) {
  if (isLoading) {
    // Minimal height reservation without visual noise
    return <section className="py-6 bg-creme min-h-[240px]"></section>;
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
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2"
          style={{ 
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {brands.map((brand) => (
            <Link
              key={brand.id}
              to={`/brand/${brand.slug}`}
              className="flex-shrink-0 snap-center w-[140px] group"
            >
              <div className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-500 hover:scale-105 h-full">
                {/* Brand Logo */}
                <div className="relative aspect-square bg-creme-light flex items-center justify-center p-6">
                  {brand.logo_url ? (
                    <img
                      src={brand.logo_url}
                      alt={brand.name}
                      className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="text-center">
                      <div className="text-4xl font-serif font-bold text-canyon/80 leading-tight">
                        {brand.name.substring(0, 2).toUpperCase()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Brand Name */}
                <div className="bg-white px-3 py-3 text-center">
                  <h3 className="text-dark font-semibold text-sm leading-tight group-hover:text-canyon transition-colors line-clamp-2">
                    {brand.name}
                  </h3>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
