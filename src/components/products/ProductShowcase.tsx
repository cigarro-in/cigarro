import React, { useState, useEffect } from 'react';
import { useCart, Product } from '../../hooks/useCart';
import { useWishlist } from '../../hooks/useWishlist';
import { toast } from 'sonner';
import { supabase } from '../../utils/supabase/client';
import { Link } from 'react-router-dom';
import { ProductCard } from './ProductCard';

export function ProductShowcase() {
  const { addToCart, isLoading } = useCart();
  const { wishlistItems, isWishlisted, toggleWishlist } = useWishlist();
  const [showcaseProducts, setShowcaseProducts] = useState<Product[]>([]);
  const [sectionConfig, setSectionConfig] = useState({
    title: 'Discover Our Most Celebrated Collections',
    background_image: '',
    button_text: 'Explore Collection',
    button_url: '/products',
    is_enabled: true
  });

  useEffect(() => {
    fetchShowcaseProducts();
    fetchSectionConfig();
  }, []);

  const fetchShowcaseProducts = async () => {
    try {
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, slug, brand, price, description, is_active, gallery_images, rating, review_count, created_at, is_showcase, showcase_order')
        .eq('is_active', true)
        .eq('is_showcase', true)
        .order('showcase_order', { ascending: true })
        .limit(6); // 6 products for the grid layout

      if (error) throw error;
      setShowcaseProducts(products || []);
    } catch (error) {
      console.error('Error fetching showcase products:', error);
    }
  };

  const fetchSectionConfig = async () => {
    try {
      const { data: config, error } = await supabase
        .from('section_configurations')
        .select('title, background_image, button_text, button_url, is_enabled')
        .eq('section_name', 'product_showcase')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (config) {
        setSectionConfig({
          title: config.title || 'Discover Our Most Celebrated Collections',
          background_image: config.background_image || '',
          button_text: config.button_text || 'Explore Collection',
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

  if (!sectionConfig.is_enabled || showcaseProducts.length === 0) {
    return null;
  }

  return (
    <section className="py-16 bg-creme relative min-h-[700px]">
      <div className="w-full">
        {/* Section Header */}
        <div className="text-center mb-12 px-4">
          <div>
            <h2 className="main-title text-dark mb-4">
              {sectionConfig.title}
            </h2>
            <div className="w-16 h-0.5 bg-canyon mx-auto"></div>
          </div>
        </div>

        {/* Product Showcase Layout */}
        <div className="w-[90%] mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 min-h-[500px]">
            {/* First Column (2/5 width) - Featured Image */}
            <div className="col-span-1 lg:col-span-2">
              <div className="relative h-full rounded-lg overflow-hidden bg-creme/20 group min-h-[500px]">
                {sectionConfig.background_image ? (
                  <img
                    src={sectionConfig.background_image}
                    alt="Showcase Collection"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-canyon/20 to-dark/20 flex items-center justify-center">
                    <div className="text-center text-dark/60">
                      <div className="text-4xl mb-4">🏆</div>
                      <p className="text-lg font-medium">Celebrated Collections</p>
                      <p className="text-sm">Premium Selection</p>
                    </div>
                  </div>
                )}

                {/* Overlay with section info */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-6">
                  <div className="text-white">
                    <h3 className="text-xl font-bold mb-2">
                      Premium Collections
                    </h3>
                    <p className="text-sm opacity-90">
                      Handpicked selections from our finest tobacco products
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Second Column (3/5 width) - 6 Products in 2 rows */}
            <div className="col-span-1 lg:col-span-3">
              <div className="grid grid-rows-2 gap-6 h-full min-h-[500px]">
                {/* First Row - 3 Products */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {showcaseProducts.slice(0, 3).map((product, index) => (
                    <div key={product.id} className="h-full">
                      <ProductCard
                        product={product}
                        onAddToCart={handleAddToCart}
                        isLoading={isLoading}
                        index={index}
                        variant="default"
                      />
                    </div>
                  ))}
                </div>

                {/* Second Row - 3 Products */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {showcaseProducts.slice(3, 6).map((product, index) => (
                    <div key={product.id} className="h-full">
                      <ProductCard
                        product={product}
                        onAddToCart={handleAddToCart}
                        isLoading={isLoading}
                        index={index + 3}
                        variant="default"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* View All Button - Centered below the entire section */}
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
