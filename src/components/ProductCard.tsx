import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Product } from '../hooks/useCart';
import { toast } from 'sonner';

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void;
  onToggleWishlist?: (productId: string) => void;
  isWishlisted?: boolean;
  isLoading?: boolean;
  variant?: 'default' | 'featured' | 'list';
  className?: string;
  index?: number;
}

// Helper function to format price in Indian numbering system
const formatIndianPrice = (priceINR: number): string => {
  return priceINR.toLocaleString('en-IN');
};

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  onToggleWishlist,
  isWishlisted = false,
  isLoading = false,
  variant = 'default',
  className = '',
  index = 0
}) => {
  const [imageError, setImageError] = useState(false);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAddToCart) {
      onAddToCart(product);
      toast.success(`${product.name} added to cart`);
    }
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onToggleWishlist) {
      onToggleWishlist(product.id);
    }
  };

  // List variant for category pages - inspired by the product-button layout
  if (variant === 'list') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05, duration: 0.6 }}
        className={`group ${className}`}
      >
        <div className="product-button bg-white border border-coyote/10 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-500 hover:border-canyon/20">
          <div className="product-button__inner">
            <div className="product-button__infos flex items-center p-6">
              {/* Product Image */}
              <div className="product-button__image w-20 h-20 flex-shrink-0 mr-6">
                <div className="relative w-full h-full rounded-md overflow-hidden bg-creme/20">
                  <img
                    src={!imageError ? (product.gallery_images?.[0] || '/images/inspiration/product-placeholder.webp') : '/images/inspiration/product-placeholder.webp'}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    onError={() => setImageError(true)}
                  />
                </div>
              </div>

              {/* Product Texts */}
              <div className="product-button__texts flex-1">
                <div className="product-button__outer-text mb-2">
                  <div className="text-canyon text-xs font-medium uppercase tracking-wider mb-1">
                    {product.brand || 'Premium'}
                  </div>
                  <h3 className="product-button__name text-dark font-medium text-lg leading-tight group-hover:text-canyon transition-colors">
                    {product.name}
                  </h3>
                </div>
                <div className="product-button__outer-text">
                  <span className="text-dark font-bold text-xl">
                    ₹{formatIndianPrice(product.price)}
                  </span>
                </div>
              </div>

              {/* Arrow Icon */}
              <Link 
                to={`/product/${product.slug}`}
                className="button-arrow product-button__icon flex-shrink-0 w-12 h-12 flex items-center justify-center bg-dark text-creme-light rounded-full hover:bg-canyon transition-all duration-300 group-hover:scale-110"
              >
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>

            {/* Action Links */}
            <div className="product-button__links border-t border-coyote/10 bg-creme-light/30 p-4 flex gap-4">
              <Link
                to={`/product/${product.slug}`}
                className="flex-1 text-center py-2.5 px-4 bg-transparent border border-dark text-dark hover:bg-dark hover:text-creme-light transition-all duration-300 font-medium text-sm uppercase tracking-wide rounded-full"
              >
                View Details
              </Link>
              {onAddToCart && (
                <button
                  onClick={handleAddToCart}
                  disabled={isLoading}
                  className="flex-1 py-2.5 px-4 bg-dark text-creme-light hover:bg-canyon transition-all duration-300 font-medium text-sm uppercase tracking-wide flex items-center justify-center gap-2 rounded-full disabled:opacity-50"
                >
                  {isLoading ? 'Adding...' : 'Add to Cart'}
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Default grid variant - inspired by product-thumbnail
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.6 }}
      className={`product-thumbnail js-product-thumbnail has-link group h-full ${className}`}
    >
      {/* Wishlist Button */}
      {onToggleWishlist && (
        <button
          type="button"
          onClick={handleToggleWishlist}
          className={`button-wishlist product-thumbnail__wishlist-btn absolute top-4 right-4 z-20 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
            isWishlisted 
              ? 'bg-canyon text-creme-light opacity-100' 
              : 'bg-white/90 text-dark opacity-0 group-hover:opacity-100 hover:bg-canyon hover:text-creme-light'
          }`}
        >
          <span className="sr-only">Add to wishlist</span>
          <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
        </button>
      )}

      <Link to={`/product/${product.slug}`} className="product-thumbnail__link block relative">
        {/* New Tag */}
        {variant === 'featured' && (
          <span className="tag product-thumbnail__tag absolute top-4 left-4 z-10 bg-canyon text-creme-light px-3 py-1.5 text-xs font-medium uppercase tracking-wider rounded-full">
            Featured
          </span>
        )}

        {/* Product Image */}
        <div className="product-thumbnail__image-wrapper relative aspect-square overflow-hidden bg-creme/20 rounded-lg">
          <img
            className="img w-full h-full object-cover transition-all duration-700 group-hover:scale-105"
            src={!imageError ? (product.gallery_images?.[0] || '/images/inspiration/product-placeholder.webp') : '/images/inspiration/product-placeholder.webp'}
            alt={product.name}
            onError={() => setImageError(true)}
          />
        </div>

        {/* Product Info */}
        <div className="product-thumbnail__info pt-4">
          <div className="product-thumbnail__info-bottom">
            <div className="product-thumbnail__heading mb-3">
              <p className="product-thumbnail__type text-canyon text-xs font-medium uppercase tracking-wider mb-1">
                {product.brand || 'Premium'}
              </p>
              <p className="product-thumbnail__name text-dark font-medium text-base leading-tight hover:text-canyon transition-colors line-clamp-2">
                {product.name}
              </p>
            </div>
            <p className="product-thumbnail__price text-dark font-bold text-lg">
              ₹{formatIndianPrice(product.price)}
            </p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};