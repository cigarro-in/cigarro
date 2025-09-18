import { motion } from 'framer-motion';
import { useCart, Product } from '../hooks/useCart';
import { useWishlist } from '../hooks/useWishlist';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase/client';
import { Link } from 'react-router-dom';
import { ProductCard } from './ProductCard';

// Helper function to format price in Indian numbering system
const formatIndianPrice = (priceINR: number): string => {
  return priceINR.toLocaleString('en-IN');
};

export function FeaturedProducts() {
  const { addToCart, isLoading } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetchFeaturedProducts();
  }, []);

  const fetchFeaturedProducts = async () => {
    try {
      const { data: sectionData, error: sectionError } = await supabase
        .from('homepage_sections')
        .select('id')
        .eq('slug', 'featured-collection')
        .single();

      if (sectionError) throw sectionError;
      if (!sectionData) return;

      const { data: categoryLinkData, error: categoryLinkError } = await supabase
        .from('homepage_section_categories')
        .select('category_id')
        .eq('section_id', sectionData.id);

      if (categoryLinkError) throw categoryLinkError;
      const categoryIds = categoryLinkData.map(link => link.category_id);
      if (categoryIds.length === 0) return;

      const { data: productCategoryData, error: productCategoryError } = await supabase
        .from('product_categories')
        .select('product_id, order')
        .in('category_id', categoryIds);

      if (productCategoryError) throw productCategoryError;
      
      const orderedProductIds = productCategoryData
        .sort((a, b) => a.order - b.order)
        .map(link => link.product_id);

      if (orderedProductIds.length === 0) return;

      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, slug, brand, price, description, is_active, gallery_images, rating, review_count, created_at')
        .in('id', orderedProductIds)
        .limit(3);

      if (productsError) throw productsError;

      const sortedProducts = orderedProductIds
        .map(id => products?.find(p => p.id === id))
        .filter(Boolean) as Product[];

      setFeaturedProducts(sortedProducts);
    } catch (error) {
      console.error('Error fetching featured products:', error);
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

  if (featuredProducts.length === 0) {
    return null;
  }

  return (
    <section className="py-12 bg-creme min-h-screen flex items-center">
      <div className="w-full max-w-none px-4">
        {/* Section Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="medium-title text-dark mb-4 w-full">
              Curated Selection of Premium Tobacco
            </h2>
            <div className="w-16 h-0.5 bg-canyon mx-auto"></div>
          </motion.div>
        </div>

        {/* Products Grid - Using new ProductCard component */}
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {featuredProducts.slice(0, 3).map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                variant={index === 1 ? 'featured' : 'default'} // Make center product featured
                onAddToCart={handleAddToCart}
                onToggleWishlist={toggleWishlist}
                isWishlisted={isWishlisted(product.id)}
                isLoading={isLoading}
                index={index}
              />
            ))}
          </div>
        </div>

        {/* View All Button */}
        <div className="text-center mt-8">
          <Link 
            to="/products" 
            className="btn-primary inline-flex items-center px-8 py-3"
          >
            View All Products
          </Link>
        </div>
      </div>
    </section>
  );
}
