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
        // Fetch categories with their products via product_categories junction
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('categories')
          .select(`
            id,
            name,
            slug,
            description,
            image,
            products:product_categories(
              products(
                id, name, slug, brand_id, description, is_active, created_at,
                brand:brands(id, name),
                product_variants(id, variant_name, price, is_default, is_active, images)
              )
            )
          `)
          .order('name');

        if (categoriesError) {
          toast.error('Failed to load categories.');
          console.error(categoriesError);
          return;
        }

        // Transform data to match expected structure
        const transformedCategories = (categoriesData || []).map((cat: any) => ({
          category_id: cat.id,
          category_name: cat.name,
          category_slug: cat.slug,
          category_description: cat.description,
          category_image: cat.image,
          products: (cat.products || [])
            .map((pc: any) => pc.products)
            .filter((p: any) => p && p.is_active)
            .map((p: any) => ({
              ...p,
              brand: Array.isArray(p.brand) ? p.brand[0] : p.brand
            }))
        })).filter((cat: any) => cat.products.length > 0);

        setCategories(transformedCategories);
      } catch (error) {
        console.error('Error fetching categories:', error);
        toast.error('Failed to load categories.');
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
