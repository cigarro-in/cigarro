import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, useTransform, useMotionValue, animate, MotionValue, PanInfo } from 'framer-motion';
import { Product } from '../../hooks/useCart';
import { ProductCard } from '../../components/products/ProductCard';

interface FeaturedProductsCarouselProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
  isLoading: boolean;
}

const CARD_WIDTH = 200; // Width of each card in pixels
const GAP = 16; // Gap between cards in pixels

export const FeaturedProductsCarousel: React.FC<FeaturedProductsCarouselProps> = ({ products, onAddToCart, isLoading }) => {
  const [carouselProducts, setCarouselProducts] = useState<Product[]>([]);
  const scrollX = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const constraintsRef = useRef({ left: 0, right: 0 });

  // Create tripled list for seamless infinite loop
  useEffect(() => {
    if (products.length > 0) {
      setCarouselProducts([...products, ...products, ...products]);
    }
  }, [products]);

  // Set initial position to middle set
  useEffect(() => {
    if (products.length > 0) {
      const initialScroll = -(products.length * (CARD_WIDTH + GAP));
      scrollX.set(initialScroll);
    }
  }, [products, scrollX]);

  const handleDragEnd = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const currentX = scrollX.get();
    const velocity = info.velocity.x;
    
    // Calculate target position with momentum
    const momentum = velocity * 0.1;
    const targetX = currentX + momentum;
    
    // Find nearest snap point
    const cardIndex = Math.round(Math.abs(targetX) / (CARD_WIDTH + GAP));
    const snapX = -cardIndex * (CARD_WIDTH + GAP);

    // Animate to snap point with momentum
    animate(scrollX, snapX, {
      type: 'spring',
      stiffness: 300,
      damping: 30,
      velocity: velocity / 10,
    });

    // Check if we need to loop (after animation completes)
    setTimeout(() => {
      const finalX = scrollX.get();
      const oneCycleWidth = products.length * (CARD_WIDTH + GAP);
      const currentPosition = Math.abs(finalX);
      
      // If we're too far right (past 2nd set), jump back one set
      if (currentPosition > oneCycleWidth * 2.2) {
        scrollX.set(finalX + oneCycleWidth);
      }
      // If we're too far left (before 1st set), jump forward one set
      else if (currentPosition < oneCycleWidth * 0.8) {
        scrollX.set(finalX - oneCycleWidth);
      }
    }, 500);

  }, [scrollX, products.length]);

  if (carouselProducts.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative w-full h-[400px] overflow-hidden">
      <motion.div
        className="flex items-center h-full cursor-grab active:cursor-grabbing"
        style={{ 
          x: scrollX,
          paddingLeft: `calc(50% - ${CARD_WIDTH / 2}px)`,
          paddingRight: `calc(50% - ${CARD_WIDTH / 2}px)`,
        }}
        drag="x"
        dragElastic={0.1}
        dragMomentum={true}
        onDragEnd={handleDragEnd}
      >
        {carouselProducts.map((product, index) => (
          <CarouselCard
            key={`${product.id}-${index}`}
            product={product}
            index={index}
            scrollX={scrollX}
            onAddToCart={onAddToCart}
            isLoading={isLoading}
          />
        ))}
      </motion.div>
    </div>
  );
};

interface CarouselCardProps {
  product: Product;
  index: number;
  scrollX: MotionValue<number>;
  onAddToCart: (product: Product) => void;
  isLoading: boolean;
}

const CarouselCard: React.FC<CarouselCardProps> = ({ product, index, scrollX, onAddToCart, isLoading }) => {
  const cardPosition = -(index * (CARD_WIDTH + GAP));

  const scale = useTransform(
    scrollX,
    [cardPosition - (CARD_WIDTH + GAP), cardPosition, cardPosition + (CARD_WIDTH + GAP)],
    [0.8, 1.2, 0.8]
  );

  return (
    <motion.div
      className="flex-shrink-0"
      style={{ 
        width: CARD_WIDTH,
        marginRight: GAP,
        scale,
      }}
    >
      <ProductCard
        product={product}
        onAddToCart={onAddToCart}
        isLoading={isLoading}
        index={index}
        variant="default"
      />
    </motion.div>
  );
};
