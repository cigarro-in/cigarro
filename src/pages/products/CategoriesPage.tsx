import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase/client';
import { Product } from '../../hooks/useCart';
import { toast } from 'sonner';
import { ProductCard } from '../../components/products/ProductCard';
import { Button } from '../../components/ui/button';
import { ShoppingCart, Star, Plus } from 'lucide-react';
import { useCart } from '../../hooks/useCart';
import { SEOHead } from '../../components/seo/SEOHead';

interface CategoryWithProducts {
  category_id: string;
  category_name: string;
  category_slug: string;
  category_description: string;
  category_image: string;
  products: Product[];
}

export function CategoriesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [categories, setCategories] = useState<CategoryWithProducts[]>([]);
  const { addToCart, isLoading } = useCart();

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        // Try Cloudflare cached API first (ultra-fast edge response)
        const response = await fetch('https://cigarro.in/api/categories');
        
        if (response.ok) {
          const data = await response.json();
          setCategories(data || []);
          
          // Log cache status for debugging
          const cacheStatus = response.headers.get('X-Cache-Status');
          console.log('📦 Categories loaded from:', cacheStatus === 'HIT' ? 'Edge Cache ⚡' : 'Database 🔍');
          return;
        }
        
        // Fallback to direct Supabase call if API fails
        console.log('⚠️ API failed, falling back to direct Supabase');
        const { data, error } = await supabase.rpc('get_categories_with_products');

        if (error) {
          toast.error('Failed to load categories.');
          console.error(error);
        } else {
          setCategories(data || []);
        }
      } catch (error) {
        // Final fallback to direct Supabase
        console.error('Fetch error, using Supabase fallback:', error);
        const { data, error: supabaseError } = await supabase.rpc('get_categories_with_products');
        
        if (supabaseError) {
          toast.error('Failed to load categories.');
          console.error(supabaseError);
        } else {
          setCategories(data || []);
        }
      }
    };

    fetchCategories();
  }, []);

  const handleAddToCart = async (e: React.MouseEvent, product: Product) => {
    e.stopPropagation(); // Prevent click from bubbling up to the parent link
    try {
      await addToCart(product);
      toast.success(`${product.name} added to cart`);
    } catch (error) {
      toast.error('Failed to add to cart');
    }
  };

  return (
    <>
      <SEOHead 
        title="Product Categories - Browse by Category"
        description="Explore our organized categories of premium cigarettes, cigars, and tobacco products. Find exactly what you're looking for by browsing our curated categories."
        url="https://cigarro.in/categories"
      />
      
      <div className="py-12 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="font-serif-premium text-4xl sm:text-5xl text-foreground">Our Categories</h1>
            <p className="font-sans-premium text-lg text-muted-foreground mt-4">
              Explore our curated categories of premium products.
            </p>
          </div>

        <div className="space-y-16">
          {categories.map(category => (
            <section key={category.category_id}>
              <h2 className="font-serif-premium text-3xl text-foreground mb-6">{category.category_name}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8">
                {category.products.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    variant="default"
                    onAddToCart={(product) => {
                      const syntheticEvent = {
                        stopPropagation: () => {}
                      } as React.MouseEvent;
                      handleAddToCart(syntheticEvent, product);
                    }}
                    isLoading={isLoading}
                    index={index}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
    </>
  );
}
