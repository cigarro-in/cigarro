import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Package, Leaf, Flame } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { Link } from 'react-router-dom';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  product_count?: number;
}

const categoryIcons: { [key: string]: React.ComponentType<any> } = {
  cigarettes: Package,
  cigars: Leaf,
  tobacco: Flame,
  accessories: Package,
};

export function CategoriesGrid() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      // Fetch categories with product counts
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('id, name, slug, description, image')
        .order('name');

      if (categoriesError) throw categoriesError;

      // Get product counts for each category
      const categoriesWithCounts = await Promise.all(
        (categoriesData || []).map(async (category) => {
          const { count } = await supabase
            .from('product_categories')
            .select('product_id', { count: 'exact' })
            .eq('category_id', category.id);

          return {
            ...category,
            product_count: count || 0
          };
        })
      );

      setCategories(categoriesWithCounts);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  if (categories.length === 0) {
    return null;
  }

  return (
    <section className="py-16 bg-creme min-h-screen flex items-center">
      <div className="w-full max-w-none px-4">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="medium-title text-dark mb-4 w-full">
            Explore Premium Categories
          </h2>
          <div className="w-16 h-0.5 bg-canyon mx-auto"></div>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {categories.map((category, index) => {
            const IconComponent = categoryIcons[category.slug] || Package;
            
            return (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                className="group"
              >
                <Link 
                  to={`/category/${category.slug}`}
                  className="block h-full"
                >
                  <div className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 group-hover:scale-[1.02] h-full">
                    {/* Category Image */}
                    <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-coyote/20 to-canyon/20">
                      {category.image ? (
                        <img
                          src={category.image}
                          alt={category.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500">
                            <IconComponent className="w-10 h-10 text-canyon" />
                          </div>
                        </div>
                      )}
                      
                      {/* Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                      
                      {/* Product Count Badge */}
                      <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-medium text-dark">
                        {category.product_count} Products
                      </div>

                      {/* Hover Arrow */}
                      <div className="absolute bottom-4 right-4 w-12 h-12 bg-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 shadow-lg">
                        <ArrowRight className="w-6 h-6 text-canyon" />
                      </div>
                    </div>

                    {/* Category Info */}
                    <div className="p-6">
                      <div className="mb-4">
                        <h3 className="font-serif text-xl lg:text-2xl text-dark group-hover:text-canyon transition-colors mb-2 leading-tight">
                          {category.name}
                        </h3>
                        
                        {category.description && (
                          <p className="text-dark/70 text-sm leading-relaxed line-clamp-2">
                            {category.description}
                          </p>
                        )}
                      </div>

                      {/* Category Stats */}
                      <div className="flex items-center justify-between pt-4 border-t border-coyote/20">
                        <div className="flex items-center space-x-2">
                          <IconComponent className="w-4 h-4 text-canyon" />
                          <span className="text-dark/70 text-sm font-medium">Premium Selection</span>
                        </div>
                        
                        <div className="text-canyon font-medium text-sm group-hover:translate-x-1 transition-transform duration-300">
                          Explore →
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* Navigation Help */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="mt-16 text-center"
        >
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-8 shadow-lg max-w-4xl mx-auto border border-coyote/20">
            <h3 className="font-serif text-xl text-dark mb-4">
              Need Help Finding Something Specific?
            </h3>
            <p className="text-dark/70 leading-relaxed mb-6">
              Our navigation is designed for easy discovery. Browse by category, search by brand, 
              or use our filters to find exactly what you're looking for.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link 
                to="/products" 
                className="btn-secondary inline-flex items-center"
              >
                View All Products
              </Link>
              <Link 
                to="/brands" 
                className="btn-primary inline-flex items-center"
              >
                Browse by Brand
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
