import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Package, Leaf, Flame } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
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
      // 1. Fetch top 5 categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('id, name, slug, description, image')
        .order('name')
        .limit(5);

      if (categoriesError) throw categoriesError;
      if (!categoriesData?.length) return;

      const categoryIds = categoriesData.map(c => c.id);

      // 2. Fetch product relationships for these categories
      const { data: productCategories, error: pcError } = await supabase
        .from('product_categories')
        .select('category_id, product_id')
        .in('category_id', categoryIds);

      if (pcError) throw pcError;

      const allProductIds = productCategories?.map(pc => pc.product_id) || [];
      if (allProductIds.length === 0) {
        setCategoriesWithProducts([]);
        return;
      }

      // 3. Fetch the actual products (bulk)
      const { data: allProducts, error: productsError } = await supabase
        .from('products')
        .select('id, name, slug, brand, price, description, is_active, gallery_images, rating, review_count, created_at')
        .in('id', allProductIds)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (productsError) throw productsError;

      // 4. Map products back to categories in memory
      const processedData = categoriesData.map(category => {
        // Find product IDs for this category
        const catProductIds = new Set(
          productCategories
            ?.filter(pc => pc.category_id === category.id)
            .map(pc => pc.product_id)
        );

        // Filter products matching those IDs
        const products = (allProducts || [])
          .filter(p => catProductIds.has(p.id))
          .slice(0, 4); // Limit to 4 per category

        return {
          ...category,
          products,
          product_count: products.length
        };
      }).filter(c => c.products.length > 0);

      setCategoriesWithProducts(processedData);
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
    // Minimal height reservation
    return <section className="py-6 bg-creme min-h-[400px]"></section>;
  }

  if (categoriesWithProducts.length === 0) {
    return null;
  }

  return (
    <section className="py-6 bg-creme">
      <div className="space-y-12">
        {categoriesWithProducts.map((category) => (
          <CategoryProductRow 
            key={category.id} 
            category={category} 
            onAddToCart={handleAddToCart}
            isLoading={cartLoading}
          />
        ))}
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

// Sub-component for individual category rows
function CategoryProductRow({ 
  category, 
  onAddToCart, 
  isLoading 
}: { 
  category: CategoryWithProducts, 
  onAddToCart: (p: Product) => void, 
  isLoading: boolean 
}) {
  const IconComponent = categoryIcons[category.slug] || Package;

  return (
    <div className="relative">
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
                onAddToCart={onAddToCart}
                isLoading={isLoading}
                index={index}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
