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

  // Clean bidirectional infinite scroll implementation
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || featuredProducts.length === 0) return;

    const itemCount = featuredProducts.length;
    let isRepositioning = false;
    let rafId = 0;
    let snapTimer: ReturnType<typeof setTimeout> | null = null;

    // Get item width (1/3 of container for 3 visible items)
    const getItemWidth = () => container.clientWidth / 3;

    // Snap to nearest item center
    const snapToNearest = () => {
      if (isRepositioning) return;
      
      const itemWidth = getItemWidth();
      const currentIndex = container.scrollLeft / itemWidth;
      const nearestIndex = Math.round(currentIndex);
      const targetScroll = nearestIndex * itemWidth;
      
      if (Math.abs(container.scrollLeft - targetScroll) > 2) {
        container.scrollTo({
          left: targetScroll,
          behavior: 'smooth'
        });
      }
    };

    // Handle scroll with infinite loop repositioning
    const handleScroll = () => {
      if (isRepositioning) return;

      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const itemWidth = getItemWidth();
        const scrollLeft = container.scrollLeft;
        const currentIndex = scrollLeft / itemWidth;
        
        // Update active progress for visual feedback
        setActiveProgress(currentIndex);

        // Clear and reset snap timer
        if (snapTimer) clearTimeout(snapTimer);
        snapTimer = setTimeout(snapToNearest, 150);

        // Infinite loop logic: Jump when reaching boundaries
        // We have 3 sets: [set0][set1][set2]
        // Start at set1, jump seamlessly between sets
        
        if (currentIndex < itemCount) {
          // Scrolled into set0 (left boundary) - jump to set1
          isRepositioning = true;
          const offset = currentIndex % itemCount;
          const newIndex = itemCount + offset;
          
          container.style.scrollBehavior = 'auto';
          container.scrollLeft = newIndex * itemWidth;
          setActiveProgress(newIndex);
          
          requestAnimationFrame(() => {
            container.style.scrollBehavior = 'smooth';
            isRepositioning = false;
          });
        } else if (currentIndex >= itemCount * 2) {
          // Scrolled into set2 (right boundary) - jump to set1
          isRepositioning = true;
          const offset = currentIndex % itemCount;
          const newIndex = itemCount + offset;
          
          container.style.scrollBehavior = 'auto';
          container.scrollLeft = newIndex * itemWidth;
          setActiveProgress(newIndex);
          
          requestAnimationFrame(() => {
            container.style.scrollBehavior = 'smooth';
            isRepositioning = false;
          });
        }
      });
    };

    // Initialize: Start at middle set (set1)
    const initialize = () => {
      const itemWidth = getItemWidth();
      const startIndex = itemCount; // Start of set1
      
      container.style.scrollBehavior = 'auto';
      container.scrollLeft = startIndex * itemWidth;
      setActiveProgress(startIndex);
      
      // Enable smooth scrolling after initialization
      requestAnimationFrame(() => {
        container.style.scrollBehavior = 'smooth';
      });
    };

    // Add scroll listener
    container.addEventListener('scroll', handleScroll, { passive: true });

    // Initialize after a brief delay to ensure layout is ready
    const initTimer = setTimeout(initialize, 100);

    // Cleanup
    return () => {
      clearTimeout(initTimer);
      if (snapTimer) clearTimeout(snapTimer);
      if (rafId) cancelAnimationFrame(rafId);
      container.removeEventListener('scroll', handleScroll);
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
          <div className="md:hidden relative py-0">
            <div 
              ref={scrollContainerRef}
              className="flex overflow-x-auto overflow-y-hidden scrollbar-hide"
              style={{ 
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                overscrollBehaviorX: 'contain',
                touchAction: 'auto',
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
                      padding: '16px 8px',
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
              {featuredProducts.map((_, index) => {
                // Calculate which item is currently centered
                const currentItemIndex = Math.round(activeProgress) % featuredProducts.length;
                const isActive = index === currentItemIndex;
                
                return (
                  <div
                    key={index}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      isActive
                        ? 'w-6 bg-canyon'
                        : 'w-1.5 bg-dark/30'
                    }`}
                  />
                );
              })}
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
