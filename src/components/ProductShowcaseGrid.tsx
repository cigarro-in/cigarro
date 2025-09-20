import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Eye } from 'lucide-react';
import { Product } from '../hooks/useCart';
import { toast } from 'sonner';
import { getProductImageUrl } from '../utils/supabase/storage';

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

  // Take up to 7 products (1 center + 6 sides) or show what we have
  const showcaseProducts = products.slice(0, 7);
  const centerProduct = showcaseProducts[0];
  const leftProducts = showcaseProducts.slice(1, 4); // Products 1, 2, 3
  const rightProducts = showcaseProducts.slice(4, 7); // Products 4, 5, 6

  if (showcaseProducts.length === 0) {
    return (
      <div className="text-center py-20 text-dark">
        <p>No products in showcase yet</p>
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
              src={!imageErrors.has(product.id) ? getProductImageUrl(product.gallery_images?.[0]) : getProductImageUrl()}
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
      {/* Desktop 2:3 Ratio Layout */}
      <div className="hidden lg:block">
        <div className="grid grid-cols-5 gap-8 h-[500px]">
          {/* First Column (2/5 width) - Featured Image */}
          <div className="col-span-2">
            {centerProduct && (
              <div 
                className="relative h-full rounded-lg overflow-hidden bg-creme/20 group"
                onMouseEnter={() => setHoveredIndex(0)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Wishlist Button */}
                {onToggleWishlist && (
                  <button
                    onClick={(e) => handleToggleWishlist(e, centerProduct.id)}
                    className={`absolute top-4 right-4 z-20 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                      wishlist.has(centerProduct.id) 
                        ? 'bg-canyon text-creme-light opacity-100' 
                        : 'bg-white/90 text-dark opacity-0 group-hover:opacity-100 hover:bg-canyon hover:text-creme-light'
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${wishlist.has(centerProduct.id) ? 'fill-current' : ''}`} />
                  </button>
                )}

                {/* Featured Badge */}
                <div className="absolute top-4 left-4 z-20 bg-canyon text-creme-light px-4 py-2 text-sm font-medium uppercase tracking-wider rounded-full">
                  Featured Collection
                </div>

                <Link to={`/product/${centerProduct.slug}`} className="block relative h-full">
                  <img
                    src={!imageErrors.has(centerProduct.id) ? getProductImageUrl(centerProduct.gallery_images?.[0]) : getProductImageUrl()}
                    alt={centerProduct.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={() => handleImageError(centerProduct.id)}
                  />
                  
                  {/* Overlay with product info */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-6">
                    <div className="text-white">
                      <p className="text-canyon text-sm font-medium uppercase tracking-wider mb-2">
                        {centerProduct.brand || 'Premium'}
                      </p>
                      <h3 className="text-xl font-bold mb-2 line-clamp-2">
                        {centerProduct.name}
                      </h3>
                      <p className="text-lg font-semibold">
                        ₹{formatIndianPrice(centerProduct.price)}
                      </p>
                    </div>
                  </div>

                  {/* Hover overlay with action buttons */}
                  <AnimatePresence>
                    {hoveredIndex === 0 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 bg-black/20 flex items-center justify-center"
                      >
                        <motion.div
                          initial={{ y: 10, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: 10, opacity: 0 }}
                          transition={{ delay: 0.05, duration: 0.2 }}
                          className="flex gap-3"
                        >
                          <button
                            onClick={(e) => handleAddToCart(e, centerProduct)}
                            disabled={isLoading}
                            className="bg-white text-dark px-6 py-3 rounded-full font-medium hover:bg-canyon hover:text-creme-light transition-all duration-200 flex items-center gap-2 disabled:opacity-50"
                          >
                            <ShoppingCart className="w-4 h-4" />
                            {isLoading ? 'Adding...' : 'Add to Cart'}
                          </button>
                          
                          <Link
                            to={`/product/${centerProduct.slug}`}
                            className="bg-white/20 text-white px-6 py-3 rounded-full font-medium hover:bg-white/30 transition-all duration-200 flex items-center gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            View Details
                          </Link>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Link>
              </div>
            )}
          </div>

          {/* Second Column (3/5 width) - 6 Products in 2 rows */}
          <div className="col-span-3">
            <div className="grid grid-rows-2 gap-6 h-full">
              {/* First Row - 3 Products */}
              <div className="grid grid-cols-3 gap-4">
                {[...leftProducts, ...rightProducts].slice(0, 3).map((product, idx) => (
                  <div key={product.id} className="relative group">
                    <motion.div
                      className="relative h-full cursor-pointer"
                      onMouseEnter={() => setHoveredIndex(idx + 1)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ 
                        opacity: 1,
                        scale: hoveredIndex === idx + 1 ? 1.05 : 1,
                        y: hoveredIndex === idx + 1 ? -2 : 0
                      }}
                      transition={{ duration: 0.3 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                    >
                      {/* Wishlist Button */}
                      {onToggleWishlist && (
                        <button
                          onClick={(e) => handleToggleWishlist(e, product.id)}
                          className={`absolute top-2 right-2 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                            wishlist.has(product.id) 
                              ? 'bg-canyon text-creme-light opacity-100' 
                              : 'bg-white/90 text-dark opacity-0 group-hover:opacity-100 hover:bg-canyon hover:text-creme-light'
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${wishlist.has(product.id) ? 'fill-current' : ''}`} />
                        </button>
                      )}

                      <Link to={`/product/${product.slug}`} className="block relative h-full">
                        <div className="relative h-full rounded-lg overflow-hidden bg-creme/20">
                          <img
                            src={!imageErrors.has(product.id) ? getProductImageUrl(product.gallery_images?.[0]) : getProductImageUrl()}
                            alt={product.name}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            onError={() => handleImageError(product.id)}
                          />

                          {/* Product info overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-3">
                            <div className="text-white">
                              <p className="text-canyon text-xs font-medium uppercase tracking-wider mb-1">
                                {product.brand || 'Premium'}
                              </p>
                              <h4 className="text-sm font-bold line-clamp-1 mb-1">
                                {product.name}
                              </h4>
                              <p className="text-sm font-semibold">
                                ₹{formatIndianPrice(product.price)}
                              </p>
                            </div>
                          </div>

                          {/* Hover overlay */}
                          <AnimatePresence>
                            {hoveredIndex === idx + 1 && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="absolute inset-0 bg-black/40 flex items-center justify-center"
                              >
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
                                    className="bg-white text-dark px-3 py-1.5 rounded-full font-medium text-xs hover:bg-canyon hover:text-creme-light transition-all duration-200 flex items-center gap-1 disabled:opacity-50"
                                  >
                                    <ShoppingCart className="w-3 h-3" />
                                    Add
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
                  </div>
                ))}
              </div>

              {/* Second Row - 3 Products */}
              <div className="grid grid-cols-3 gap-4">
                {[...leftProducts, ...rightProducts].slice(3, 6).map((product, idx) => (
                  <div key={product.id} className="relative group">
                    <motion.div
                      className="relative h-full cursor-pointer"
                      onMouseEnter={() => setHoveredIndex(idx + 4)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ 
                        opacity: 1,
                        scale: hoveredIndex === idx + 4 ? 1.05 : 1,
                        y: hoveredIndex === idx + 4 ? -2 : 0
                      }}
                      transition={{ duration: 0.3 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                    >
                      {/* Wishlist Button */}
                      {onToggleWishlist && (
                        <button
                          onClick={(e) => handleToggleWishlist(e, product.id)}
                          className={`absolute top-2 right-2 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                            wishlist.has(product.id) 
                              ? 'bg-canyon text-creme-light opacity-100' 
                              : 'bg-white/90 text-dark opacity-0 group-hover:opacity-100 hover:bg-canyon hover:text-creme-light'
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${wishlist.has(product.id) ? 'fill-current' : ''}`} />
                        </button>
                      )}

                      <Link to={`/product/${product.slug}`} className="block relative h-full">
                        <div className="relative h-full rounded-lg overflow-hidden bg-creme/20">
                          <img
                            src={!imageErrors.has(product.id) ? getProductImageUrl(product.gallery_images?.[0]) : getProductImageUrl()}
                            alt={product.name}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            onError={() => handleImageError(product.id)}
                          />

                          {/* Product info overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-3">
                            <div className="text-white">
                              <p className="text-canyon text-xs font-medium uppercase tracking-wider mb-1">
                                {product.brand || 'Premium'}
                              </p>
                              <h4 className="text-sm font-bold line-clamp-1 mb-1">
                                {product.name}
                              </h4>
                              <p className="text-sm font-semibold">
                                ₹{formatIndianPrice(product.price)}
                              </p>
                            </div>
                          </div>

                          {/* Hover overlay */}
                          <AnimatePresence>
                            {hoveredIndex === idx + 4 && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="absolute inset-0 bg-black/40 flex items-center justify-center"
                              >
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
                                    className="bg-white text-dark px-3 py-1.5 rounded-full font-medium text-xs hover:bg-canyon hover:text-creme-light transition-all duration-200 flex items-center gap-1 disabled:opacity-50"
                                  >
                                    <ShoppingCart className="w-3 h-3" />
                                    Add
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
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile/Tablet Layout */}
      <div className="lg:hidden">
        {/* Center Product First */}
        {centerProduct && (
          <div className="mb-8">
            <ProductCard
              key={centerProduct.id}
              product={centerProduct}
              index={0}
              isCenter={true}
              position="center"
            />
          </div>
        )}

        {/* Other Products in Grid */}
        {[...leftProducts, ...rightProducts].length > 0 && (
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
        )}
      </div>
    </div>
  );
};
