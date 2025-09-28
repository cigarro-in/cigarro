import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase/client';
import { Product } from '../../hooks/useCart';
import { toast } from 'sonner';
import { ProductCard } from '../../components/products/ProductCard';
import { Button } from '../../components/ui/button';
import { ShoppingCart, Star, Plus } from 'lucide-react';
import { useCart } from '../../hooks/useCart';

interface CategoryWithProducts {
  id: string;
  name: string;
  description: string;
  image: string;
  products: Product[];
}

export function CollectionsPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<CategoryWithProducts[]>([]);
  const { addToCart, isLoading } = useCart();

  useEffect(() => {
    const fetchCollections = async () => {
      const { data, error } = await supabase
        .from('categories')
        .select(`
          id,
          name,
          description,
          image,
          products:product_categories!inner(
            order,
            products!inner(
              id,
              name,
              brand,
              price,
              description,
              is_active,
              slug,
              gallery_images,
              rating,
              review_count
            )
          )
        `)
        .order('order', { foreignTable: 'products', ascending: true });

      if (error) {
        toast.error('Failed to load collections.');
        console.error(error);
      } else {
        // The data needs some transformation
        const formattedData = data.map(category => ({
          ...category,
          products: category.products.map((p: any) => p.products).filter(p => p.is_active),
        }));
        setCategories(formattedData);
      }
    };

    fetchCollections();
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
    <div className="py-12 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="font-serif-premium text-4xl sm:text-5xl text-foreground">Our Collections</h1>
          <p className="font-sans-premium text-lg text-muted-foreground mt-4">
            Explore our curated collections of premium products.
          </p>
        </div>

        <div className="space-y-16">
          {categories.map(category => (
            <section key={category.id}>
              <h2 className="font-serif-premium text-3xl text-foreground mb-6">{category.name}</h2>
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
  );
}
