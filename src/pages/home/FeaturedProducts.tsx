import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { useCart } from '../../hooks/useCart';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { ProductCard } from '../../components/products/ProductCard';
import { SectionConfig, HomepageProduct } from '../../types/home';

interface FeaturedProductsProps {
  products?: HomepageProduct[];
  config?: SectionConfig | null;
  isLoading?: boolean;
}

export const FeaturedProducts = memo(function FeaturedProducts({ 
  products = [], 
  config = null, 
  isLoading = false 
}: FeaturedProductsProps) {
  const { addToCart, isLoading: cartLoading } = useCart();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  
  const sectionConfig = config || {
    title: 'Top Products',
    subtitle: 'Featured Products',
    description: 'Discover our handpicked selection of premium tobacco products',
    button_text: 'View All Products',
    button_url: '/products',
    is_enabled: true
  };

  const handleAddToCart = useCallback(async (product: HomepageProduct) => {
    try {
      await addToCart(product as any, 1);
      toast.success(`${product.name} added to cart!`);
    } catch {
      toast.error('Failed to add item to cart');
    }
  }, [addToCart]);

  // Optimized scroll handler using IntersectionObserver for center item detection
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || products.length === 0) return;

    const handleScroll = () => {
      if (!container) return;
      const itemWidth = container.clientWidth / 3;
      const scrollLeft = container.scrollLeft;
      const index = Math.round(scrollLeft / itemWidth);
      
      // Only update state if index changes
      setActiveIndex((prev) => {
        if (prev !== index) return index;
        return prev;
      });
    };

    // Debounce scroll handler
    let timeoutId: NodeJS.Timeout;
    const throttledScroll = () => {
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        handleScroll();
        timeoutId = null as any;
      }, 50); // 50ms throttle
    };

    container.addEventListener('scroll', throttledScroll, { passive: true });
    return () => container.removeEventListener('scroll', throttledScroll);
  }, [products]);

  if (!sectionConfig.is_enabled) return null;

  // Minimal height reservation while loading
  if (isLoading) {
    return <section className="py-8 md:py-16 bg-creme min-h-[400px]"></section>;
  }

  if (products.length === 0) {
    return null;
  }

  // Triple the products for infinite scroll effect
  const infiniteProducts = [...products, ...products, ...products];

  return (
    <section className="py-8 md:py-16 bg-creme md:min-h-screen md:flex md:items-center">
      <div className="w-full">
        {/* Section Header */}
        <div className="text-center mb-6 md:mb-12 px-4">
          <h2 className="medium-title leading-tight text-2xl sm:text-3xl lg:text-4xl xl:text-5xl">
            {sectionConfig.title}
          </h2>
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
                const len = products.length;
                const actualIndex = index % len;
                
                // Calculate distance from viewport center for smooth scaling
                const itemWidth = scrollContainerRef.current ? scrollContainerRef.current.clientWidth / 3 : 200;
                const itemLeft = index * itemWidth;
                const itemCenter = itemLeft + itemWidth / 2;
                const scrollLeft = activeIndex * itemWidth; // Use activeIndex instead of activeProgress
                const viewportCenter = scrollLeft + (scrollContainerRef.current?.clientWidth || 600) / 2;
                
                // Distance from center (0 = perfect center, higher = further away)
                const distanceFromCenter = Math.abs(itemCenter - viewportCenter) / itemWidth;
                
                // Only scale the card that's closest to center (within 0.6 threshold)
                const isClosestToCenter = distanceFromCenter < 0.6;
                const scale = isClosestToCenter ? 1.12 : 0.9;
                const opacity = isClosestToCenter ? 1 : 0.7;
                const zIndex = isClosestToCenter ? 10 : 1;

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
                      product={product as any}
                      variant="default"
                      onAddToCart={handleAddToCart as any}
                      isLoading={cartLoading}
                      index={actualIndex}
                    />
                  </div>
                );
              })}
            </div>
            
            {/* Scroll Indicators */}
            <div className="flex justify-center gap-2 mt-4">
              {products.map((_, index) => {
                // Calculate which item is currently centered
                const isActive = index === activeIndex % products.length; // Use activeIndex
                
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
            {products.slice(0, 3).map((product, index) => (
              <div key={product.id}>
                <ProductCard
                  product={product as any}
                  variant="default"
                  onAddToCart={handleAddToCart as any}
                  isLoading={cartLoading}
                  index={index}
                />
              </div>
            ))}
          </div>
        </div>

        {/* View All Button - Centered below products */}
        <div className="text-center mt-8 md:mt-16 px-4">
          <Link
            to={sectionConfig.button_url || '/products'}
            className="btn-primary inline-flex items-center px-8 py-3"
          >
            {sectionConfig.button_text || 'View All Products'}
          </Link>
        </div>
      </div>
    </section>
  );
});
