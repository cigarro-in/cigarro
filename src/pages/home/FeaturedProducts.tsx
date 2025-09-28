import { motion } from 'framer-motion';
import { useCart, Product } from '../../hooks/useCart';
import { useWishlist } from '../../hooks/useWishlist';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase/client';
import { Link } from 'react-router-dom';
import { ProductCard } from '../../components/products/ProductCard';

// Helper function to format price in Indian numbering system
const formatIndianPrice = (priceINR: number): string => {
  return priceINR.toLocaleString('en-IN');
};

export function FeaturedProducts() {
  const { addToCart, isLoading } = useCart();
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [sectionConfig, setSectionConfig] = useState({
    title: 'Curated Selection of Premium Tobacco',
    subtitle: 'Featured Products',
    description: 'Discover our handpicked selection of premium tobacco products',
    button_text: 'View All Products',
    button_url: '/products',
    is_enabled: true
  });

  useEffect(() => {
    fetchFeaturedProducts();
    fetchSectionConfig();
  }, []);

  const fetchFeaturedProducts = async () => {
    try {
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, slug, brand, price, description, is_active, gallery_images, rating, review_count, created_at')
        .eq('is_featured', true)
        .eq('is_active', true)
        .order('featured_order', { ascending: true })
        .limit(3);

      if (productsError) throw productsError;
      setFeaturedProducts(products || []);
    } catch (error) {
      console.error('Error fetching featured products:', error);
    }
  };

  const fetchSectionConfig = async () => {
    try {
      const { data: config, error } = await supabase
        .from('section_configurations')
        .select('title, subtitle, description, button_text, button_url, is_enabled')
        .eq('section_name', 'featured_products')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (config) {
        setSectionConfig({
          title: config.title || 'Curated Selection of Premium Tobacco',
          subtitle: config.subtitle || 'Featured Products',
          description: config.description || 'Discover our handpicked selection of premium tobacco products',
          button_text: config.button_text || 'View All Products',
          button_url: config.button_url || '/products',
          is_enabled: config.is_enabled !== false
        });
      }
    } catch (error) {
      console.error('Error fetching section config:', error);
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

  if (!sectionConfig.is_enabled || featuredProducts.length === 0) {
    return null;
  }

  return (
    <section className="py-16 bg-creme min-h-screen flex items-center">
      <div className="w-full">
        {/* Section Header */}
        <div className="text-center mb-12 px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="medium-title text-dark mb-4 w-full">
              {sectionConfig.title}
            </h2>
            <div className="w-16 h-0.5 bg-canyon mx-auto"></div>
          </motion.div>
        </div>

        {/* Products Grid - Full Width with Custom Layout */}
        <div className="w-[90%] mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-center gap-12 w-full">
            {featuredProducts.slice(0, 3).map((product, index) => (
              <div
                key={product.id}
                className={`${index === 1 ? 'scale-110 z-10' : 'flex-1'}`}
              >
                <ProductCard
                  product={product}
                  variant={index === 1 ? 'featured' : 'default'} // Make center product featured
                  onAddToCart={handleAddToCart}
                  isLoading={isLoading}
                  index={index}
                />
              </div>
            ))}
          </div>
        </div>

        {/* View All Button - Centered below products */}
        <div className="text-center mt-16 px-4">
          <Link
            to={sectionConfig.button_url}
            className="btn-primary inline-flex items-center px-8 py-3"
          >
            {sectionConfig.button_text}
          </Link>
        </div>
      </div>
    </section>
  );
}
