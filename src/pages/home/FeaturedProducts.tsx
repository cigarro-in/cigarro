import { motion } from 'framer-motion';
import { useCart, Product } from '../../hooks/useCart';
import { useWishlist } from '../../hooks/useWishlist';
import { toast } from 'sonner';
import { useState, useEffect, useRef } from 'react';
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Track active progress as fractional index to enable smooth scaling of center card
  const [activeProgress, setActiveProgress] = useState(0);
  const [sectionConfig, setSectionConfig] = useState({
    title: 'Top Products',
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

  // Handle infinite scroll for mobile carousel with smooth center scaling
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || featuredProducts.length === 0) return;

    let isRepositioning = false;
    let raf = 0;
    let scrollEndTimer: ReturnType<typeof setTimeout> | null = null;

    // Calculate item width: container width / 3 (for exactly 3 visible items)
    const getItemWidth = () => container.clientWidth / 3;

    // Rubber band snap to center
    const snapToCenter = () => {
      const itemWidth = getItemWidth();
      const currentProgress = container.scrollLeft / itemWidth;
      const nearestItemIndex = Math.round(currentProgress);
      const targetScroll = nearestItemIndex * itemWidth;
      
      // Only snap if not already close to center
      if (Math.abs(container.scrollLeft - targetScroll) > 5) {
        container.scrollTo({
          left: targetScroll,
          behavior: 'smooth'
        });
      }
    };

    const onScroll = () => {
      if (isRepositioning) return;
      
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const itemWidth = getItemWidth();
        const scrollLeft = container.scrollLeft;
        const progress = scrollLeft / itemWidth;
        
        setActiveProgress(progress);

        // Clear previous snap timer
        if (scrollEndTimer) clearTimeout(scrollEndTimer);
        
        // Set new snap timer (rubber band effect)
        scrollEndTimer = setTimeout(snapToCenter, 150);

        // Seamless infinite loop: reposition when crossing boundaries
        const len = featuredProducts.length;
        
        // Check boundaries more precisely
        if (progress < len * 0.2) {
          // Scrolling backward - move to end of middle set
          isRepositioning = true;
          const offsetInSet = progress % len;
          const targetProgress = len * 2 + offsetInSet;
          const targetScroll = targetProgress * itemWidth;
          
          container.style.scrollBehavior = 'auto';
          container.scrollLeft = targetScroll;
          setActiveProgress(targetProgress);
          
          setTimeout(() => {
            container.style.scrollBehavior = 'smooth';
            isRepositioning = false;
          }, 10);
        } else if (progress > len * 2.8) {
          // Scrolling forward - move to start of middle set
          isRepositioning = true;
          const offsetInSet = progress % len;
          const targetProgress = len + offsetInSet;
          const targetScroll = targetProgress * itemWidth;
          
          container.style.scrollBehavior = 'auto';
          container.scrollLeft = targetScroll;
          setActiveProgress(targetProgress);
          
          setTimeout(() => {
            container.style.scrollBehavior = 'smooth';
            isRepositioning = false;
          }, 10);
        }
      });
    };

    container.addEventListener('scroll', onScroll, { passive: true });

    // Initialize to middle set
    const init = () => {
      const itemWidth = getItemWidth();
      const startPosition = itemWidth * featuredProducts.length; // Start of middle set
      container.style.scrollBehavior = 'auto';
      container.scrollLeft = startPosition;
      setActiveProgress(startPosition / itemWidth);
      
      // Enable smooth scrolling after init
      setTimeout(() => {
        container.style.scrollBehavior = 'smooth';
      }, 100);
    };

    const initTimer = setTimeout(init, 50);

    return () => {
      clearTimeout(initTimer);
      if (scrollEndTimer) clearTimeout(scrollEndTimer);
      container.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [featuredProducts]);

  if (!sectionConfig.is_enabled || featuredProducts.length === 0) {
    return null;
  }

  // Triple the products for infinite scroll effect
  const infiniteProducts = [...featuredProducts, ...featuredProducts, ...featuredProducts];

  return (
    <section className="py-8 md:py-16 bg-creme md:min-h-screen md:flex md:items-center">
      <div className="w-full">
        {/* Section Header */}
        <div className="text-center mb-[1.5rem] md:mb-[3rem] px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="medium-title leading-tight text-2xl sm:text-3xl lg:text-4xl xl:text-5xl">
              {sectionConfig.title}
            </h2>
          </motion.div>
        </div>

        {/* Products Grid - Mobile: Infinite Carousel, Desktop: Centered Trio */}
        <div className="w-full md:w-[90%] mx-auto">
          {/* Mobile Layout: Infinite Carousel with Center Focus and Zoom */}
          <div className="md:hidden relative py-16">
            <div 
              ref={scrollContainerRef}
              className="flex overflow-x-auto scrollbar-hide"
              style={{ 
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                overscrollBehaviorX: 'contain',
                touchAction: 'pan-x',
                scrollBehavior: 'smooth',
                gap: '0px'
              }}
            >
              {infiniteProducts.map((product, index) => {
                const len = featuredProducts.length;
                const actualIndex = index % len;
                
                // Calculate distance from viewport center for smooth scaling
                const itemWidth = scrollContainerRef.current ? scrollContainerRef.current.clientWidth / 3 : 200;
                const itemLeft = index * itemWidth;
                const itemCenter = itemLeft + itemWidth / 2;
                const scrollLeft = activeProgress * itemWidth;
                const viewportCenter = scrollLeft + (scrollContainerRef.current?.clientWidth || 600) / 2;
                
                // Distance from center (0 = perfect center, higher = further away)
                const distanceFromCenter = Math.abs(itemCenter - viewportCenter) / itemWidth;
                
                // Only scale the card that's closest to center (within 0.6 threshold)
                const isClosestToCenter = distanceFromCenter < 0.6;
                const scale = isClosestToCenter ? 1.12 : 0.9;
                const opacity = isClosestToCenter ? 1 : 0.7;
                const zIndex = isClosestToCenter ? 1000 : 1;

                return (
                  <div
                    key={`${product.id}-${index}`}
                    className="flex-shrink-0 will-change-transform flex items-center"
                    style={{ 
                      position: 'relative',
                      width: '33.333%', // exactly 3 visible items
                      padding: '0 8px',
                      transform: `scale(${scale})`,
                      opacity,
                      zIndex,
                      transition: 'transform 120ms ease-out, opacity 120ms ease-out',
                      transformOrigin: 'center center'
                    }}
                  >
                    <ProductCard
                      product={product}
                      variant="default"
                      onAddToCart={handleAddToCart}
                      isLoading={isLoading}
                      index={actualIndex}
                    />
                  </div>
                );
              })}
            </div>
            
            {/* Scroll Indicators */}
            <div className="flex justify-center gap-2 mt-4">
              {featuredProducts.map((_, index) => (
                <div
                  key={index}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === (Math.round(activeProgress + 1.5) % featuredProducts.length)
                      ? 'w-6 bg-canyon'
                      : 'w-1.5 bg-dark/30'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Desktop Layout: Equal Height Cards */}
          <div className="hidden md:grid md:grid-cols-3 gap-8 w-full px-4">
            {featuredProducts.slice(0, 3).map((product, index) => (
              <div key={product.id}>
                <ProductCard
                  product={product}
                  variant="default"
                  onAddToCart={handleAddToCart}
                  isLoading={isLoading}
                  index={index}
                />
              </div>
            ))}
          </div>
        </div>
        
        {/* Hide scrollbar CSS */}
        <style>{`
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {/* View All Button - Centered below products */}
        <div className="text-center mt-8 md:mt-16 px-4">
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
