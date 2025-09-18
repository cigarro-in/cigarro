import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Eye } from 'lucide-react';
import { Product } from '../hooks/useCart';
import { toast } from 'sonner';

interface ProductShowcaseGridProps {
  products: Product[];
  onAddToCart?: (product: Product) => void;
  onToggleWishlist?: (productId: string) => void;
  wishlist?: Set<string>;
  isLoading?: boolean;
}

// Helper function to format price in Indian numbering system
const formatIndianPrice = (priceINR: number): string => {
  return priceINR.toLocaleString('en-IN');
};

export const ProductShowcaseGrid: React.FC<ProductShowcaseGridProps> = ({
  products,
  onAddToCart,
  onToggleWishlist,
  wishlist = new Set(),
  isLoading = false
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const handleImageError = (productId: string) => {
    setImageErrors(prev => new Set(prev).add(productId));
  };

  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAddToCart) {
      onAddToCart(product);
      toast.success(`${product.name} added to cart!`);
    }
  };

  const handleToggleWishlist = (e: React.MouseEvent, productId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (onToggleWishlist) {
      onToggleWishlist(productId);
    }
  };

  // Ensure we have exactly 7 products (1 center + 6 sides)
  const showcaseProducts = products.slice(0, 7);
  const centerProduct = showcaseProducts[0];
  const leftProducts = showcaseProducts.slice(1, 4); // Products 1, 2, 3
  const rightProducts = showcaseProducts.slice(4, 7); // Products 4, 5, 6

  if (showcaseProducts.length < 7) {
    return (
      <div className="text-center py-20 text-dark">
        <p>Need at least 7 products for showcase grid</p>
      </div>
    );
  }

  const ProductCard = ({ 
    product, 
    index, 
    isCenter = false, 
    position 
  }: { 
    product: Product; 
    index: number; 
    isCenter?: boolean; 
    position: 'left' | 'center' | 'right';
  }) => {
    const isHovered = hoveredIndex === index;
    const isOtherHovered = hoveredIndex !== null && hoveredIndex !== index;
    
    return (
      <motion.div
        className={`relative group cursor-pointer ${
          isCenter ? 'col-span-2 row-span-2' : ''
        }`}
        onMouseEnter={() => setHoveredIndex(index)}
        onMouseLeave={() => setHoveredIndex(null)}
        initial={{ opacity: 0, y: 20 }}
        animate={{ 
          opacity: isOtherHovered && !isCenter ? 0.6 : 1,
          scale: isHovered ? (isCenter ? 1.05 : 1.15) : 1,
          rotate: isHovered && !isCenter ? 0 : undefined, // Straighten on hover
          y: isHovered && !isCenter ? -5 : 0,
          zIndex: isHovered ? 20 : isCenter ? 10 : 1
        }}
        transition={{ 
          duration: 0.4, 
          ease: "easeOut",
          scale: { duration: 0.3 },
          opacity: { duration: 0.2 }
        }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        {/* Wishlist Button */}
        {onToggleWishlist && (
          <button
            onClick={(e) => handleToggleWishlist(e, product.id)}
            className={`absolute top-3 right-3 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
              wishlist.has(product.id) 
                ? 'bg-canyon text-creme-light opacity-100' 
                : 'bg-white/90 text-dark opacity-0 group-hover:opacity-100 hover:bg-canyon hover:text-creme-light'
            }`}
          >
            <Heart className={`w-4 h-4 ${wishlist.has(product.id) ? 'fill-current' : ''}`} />
          </button>
        )}

        {/* Featured Badge for center product */}
        {isCenter && (
          <div className="absolute top-3 left-3 z-20 bg-canyon text-creme-light px-3 py-1.5 text-xs font-medium uppercase tracking-wider rounded-full">
            Featured
          </div>
        )}

        <Link to={`/product/${product.slug}`} className="block relative h-full">
          {/* Product Image - Only Image, No Text */}
          <div className={`relative overflow-hidden bg-creme/20 rounded-lg h-full ${
            isCenter 
              ? 'aspect-[3/4] w-[180px] h-[240px]' 
              : index % 3 === 0 
                ? 'aspect-square w-[100px] h-[100px]' 
                : index % 3 === 1 
                  ? 'aspect-[4/3] w-[120px] h-[90px]'
                  : 'aspect-[3/4] w-[90px] h-[120px]'
          }`}>
            <img
              src={!imageErrors.has(product.id) ? (product.gallery_images?.[0] || '/images/inspiration/product-placeholder.webp') : '/images/inspiration/product-placeholder.webp'}
              alt={product.name}
              className="w-full h-full object-cover"
              onError={() => handleImageError(product.id)}
            />

            {/* Black Gradient Overlay on Hover */}
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end justify-center pb-4"
                >
                  {/* Action Buttons */}
                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 10, opacity: 0 }}
                    transition={{ delay: 0.05, duration: 0.2 }}
                    className="flex gap-2"
                  >
                    <button
                      onClick={(e) => handleAddToCart(e, product)}
                      disabled={isLoading}
                      className="bg-white/95 text-dark px-3 py-1.5 rounded-full font-medium text-xs hover:bg-canyon hover:text-creme-light transition-all duration-200 flex items-center gap-1 disabled:opacity-50"
                    >
                      <ShoppingCart className="w-3 h-3" />
                      {isLoading ? 'Adding...' : 'Add'}
                    </button>
                    
                    <Link
                      to={`/product/${product.slug}`}
                      className="bg-white/20 text-white px-3 py-1.5 rounded-full font-medium text-xs hover:bg-white/30 transition-all duration-200 flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      View
                    </Link>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Link>
      </motion.div>
    );
  };

  return (
    <div className="relative w-full max-w-7xl mx-auto">
      {/* Desktop Organic Layout */}
      <div className="hidden lg:block relative h-[60vh] max-h-[500px] w-full">
        {/* Center Featured Product */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
          <ProductCard
            key={centerProduct.id}
            product={centerProduct}
            index={0}
            isCenter={true}
            position="center"
          />
        </div>

        {/* Left Side Products - Organic Positioning */}
        <div className="absolute top-[15%] left-[8%] transform -rotate-3">
          <ProductCard
            key={leftProducts[0].id}
            product={leftProducts[0]}
            index={1}
            position="left"
          />
        </div>
        
        <div className="absolute top-[45%] left-[12%] transform rotate-2">
          <ProductCard
            key={leftProducts[1].id}
            product={leftProducts[1]}
            index={2}
            position="left"
          />
        </div>
        
        <div className="absolute top-[75%] left-[15%] transform -rotate-1">
          <ProductCard
            key={leftProducts[2].id}
            product={leftProducts[2]}
            index={3}
            position="left"
          />
        </div>

        {/* Right Side Products - Organic Positioning */}
        <div className="absolute top-[10%] right-[10%] transform rotate-3">
          <ProductCard
            key={rightProducts[0].id}
            product={rightProducts[0]}
            index={4}
            position="right"
          />
        </div>
        
        <div className="absolute top-[40%] right-[8%] transform -rotate-2">
          <ProductCard
            key={rightProducts[1].id}
            product={rightProducts[1]}
            index={5}
            position="right"
          />
        </div>
        
        <div className="absolute top-[70%] right-[12%] transform rotate-1">
          <ProductCard
            key={rightProducts[2].id}
            product={rightProducts[2]}
            index={6}
            position="right"
          />
        </div>
      </div>

      {/* Mobile/Tablet Layout */}
      <div className="lg:hidden">
        {/* Center Product First */}
        <div className="mb-8">
          <ProductCard
            key={centerProduct.id}
            product={centerProduct}
            index={0}
            isCenter={true}
            position="center"
          />
        </div>

        {/* Other Products in Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...leftProducts, ...rightProducts].map((product, idx) => (
            <ProductCard
              key={product.id}
              product={product}
              index={idx + 1}
              position="center"
            />
          ))}
        </div>
      </div>
    </div>
  );
};
