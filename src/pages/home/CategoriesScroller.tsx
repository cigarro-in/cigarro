import React from 'react';
import { Link } from 'react-router-dom';
import { Package, Leaf, Flame } from 'lucide-react';
import { Category } from '../../types/home';

interface CategoriesScrollerProps {
  categories?: Category[];
  isLoading?: boolean;
}

const categoryIcons: { [key: string]: React.ComponentType<any> } = {
  cigarettes: Package,
  cigars: Leaf,
  tobacco: Flame,
  accessories: Package,
};

export function CategoriesScroller({ categories = [], isLoading = false }: CategoriesScrollerProps) {
  if (isLoading) {
    // Minimal height reservation without visual noise
    return <section className="py-6 bg-creme min-h-[240px]"></section>;
  }

  if (categories.length === 0) {
    return null;
  }

  return (
    <section className="py-6 bg-creme">
      <div className="px-4">
        {/* Section Header */}
        <div className="text-center mb-[1.5rem]">
          <h2 className="medium-title leading-tight text-2xl sm:text-3xl lg:text-4xl xl:text-5xl">
            Product Categories
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
          {categories.map((category) => {
            const IconComponent = categoryIcons[category.slug] || Package;
            
            return (
              <Link
                key={category.id}
                to={`/category/${category.slug}`}
                className="flex-shrink-0 snap-start w-[140px] group"
              >
                <div className="bg-white rounded-xl border border-coyote/20 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 h-full">
                  {/* Category Image/Icon */}
                  <div className="relative aspect-square bg-gradient-to-br from-coyote/10 to-canyon/10 flex items-center justify-center">
                    {category.image ? (
                      <img
                        src={category.image}
                        alt={category.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-md">
                        <IconComponent className="w-6 h-6 text-canyon" />
                      </div>
                    )}
                  </div>

                  {/* Category Name */}
                  <div className="p-3">
                    <h3 className="text-dark font-medium text-sm leading-tight text-center group-hover:text-canyon transition-colors line-clamp-2">
                      {category.name}
                    </h3>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
