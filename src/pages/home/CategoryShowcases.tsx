import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Package, Leaf, Flame } from 'lucide-react';
import { supabase } from '../../utils/supabase/client';
import { ProductCard } from '../../components/products/ProductCard';
import { useCart, Product } from '../../hooks/useCart';
import { toast } from 'sonner';

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

interface CategoryWithProducts extends Category {
  products: Product[];
}

export function CategoryShowcases() {
  const [categoriesWithProducts, setCategoriesWithProducts] = useState<CategoryWithProducts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { addToCart, isLoading: cartLoading } = useCart();

  useEffect(() => {
    fetchCategoriesWithProducts();
  }, []);

  const fetchCategoriesWithProducts = async () => {
    try {
      // Fetch all active categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('id, name, slug, description, image')
        .order('name')
        .limit(5); // Limit to top 5 categories for mobile performance

      if (categoriesError) throw categoriesError;

      // For each category, fetch its products
      const categoriesWithProductsData = await Promise.all(
        (categoriesData || []).map(async (category) => {
          // Get product IDs for this category
          const { data: productCategories } = await supabase
            .from('product_categories')
            .select('product_id')
            .eq('category_id', category.id);

          const productIds = productCategories?.map(pc => pc.product_id) || [];

          if (productIds.length === 0) {
            return { ...category, products: [], product_count: 0 };
          }

          // Fetch products
          const { data: products } = await supabase
            .from('products')
            .select('id, name, slug, brand, price, description, is_active, gallery_images, rating, review_count, created_at')
            .in('id', productIds)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(4); // Show up to 4 products per category

          return {
            ...category,
            products: products || [],
            product_count: products?.length || 0
          };
        })
      );

      // Filter out categories with no products
      setCategoriesWithProducts(
        categoriesWithProductsData.filter(c => c.products.length > 0)
      );
    } catch (error) {
      console.error('Error fetching categories with products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToCart = async (product: Product) => {
    try {
      await addToCart(product, 1);
      toast.success(`${product.name} added to cart!`);
    } catch (error) {
      toast.error('Failed to add item to cart');
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

  if (categoriesWithProducts.length === 0) {
    return null;
  }

  return (
    <section className="py-6 bg-creme">
      <div className="space-y-12">
        {categoriesWithProducts.map((category) => {
          const IconComponent = categoryIcons[category.slug] || Package;
          
          return (
            <div key={category.id} className="relative">
              {/* Full-width section */}
              <div className="relative py-10 px-4">
                {/* Category Title */}
                <h2 className="medium-title leading-tight text-2xl sm:text-3xl lg:text-4xl xl:text-5xl text-center mb-4">
                  {category.name}
                </h2>
                
                {/* Category Tagline/Description */}
                {category.description && (
                  <p className="text-dark/70 text-center text-sm mb-6 max-w-xs mx-auto">
                    {category.description}
                  </p>
                )}

                {/* Large Circular Category Image */}
                <div className="flex justify-center mb-8">
                  <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-dark shadow-xl bg-creme-light">
                    {category.image ? (
                      <img
                        src={category.image}
                        alt={category.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-coyote/20 to-canyon/20 flex items-center justify-center">
                        <IconComponent className="w-24 h-24 text-dark/60" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Horizontal Scrolling Products - 2.5 cards visible */}
                <div 
                  className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2"
                  style={{ 
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none'
                  }}
                >
                  {category.products.map((product, index) => (
                    <div
                      key={product.id}
                      className="flex-shrink-0 snap-start"
                      style={{ width: 'calc(40% - 6px)', minWidth: '150px', maxWidth: '180px' }}
                    >
                      <ProductCard
                        product={product}
                        onAddToCart={handleAddToCart}
                        isLoading={cartLoading}
                        index={index}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
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
