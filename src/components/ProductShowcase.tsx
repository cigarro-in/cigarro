import React, { useState, useEffect } from 'react';
import { ArrowRight, Heart, ShoppingCart } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCart, Product } from '../hooks/useCart';
import { useWishlist } from '../hooks/useWishlist';
import { toast } from 'sonner';
import { supabase } from '../utils/supabase/client';
import { Link } from 'react-router-dom';

// Helper function to format price in Indian numbering system
const formatIndianPrice = (priceINR: number): string => {
  return priceINR.toLocaleString('en-IN');
};

interface FashionCardProps {
  product: Product;
  position: 'left-top' | 'left-bottom' | 'center' | 'right-top' | 'right-bottom';
  onAddToCart?: (product: Product) => void;
  onToggleWishlist?: (productId: string) => void;
  isWishlisted?: boolean;
  isLoading?: boolean;
}

const FashionCard: React.FC<FashionCardProps> = ({
  product,
  position,
  onAddToCart,
  onToggleWishlist,
  isWishlisted = false,
  isLoading = false
}) => {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

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

  // Define card sizes and positions for 3-column layout: left column (2 rows), center (1 product), right column (2 rows)
  const getCardStyles = () => {
    const baseStyles = "absolute rounded-lg overflow-hidden bg-white shadow-xl will-change-transform";
    const centerCardSize = { width: '600px', height: '600px' }; // Extra large square center card
    const sideCardSize = { width: '350px', height: '350px' }; // Larger square side cards
    
    switch (position) {
      case 'center':
        return {
          className: `${baseStyles} z-30`,
          style: {
            width: centerCardSize.width,
            height: centerCardSize.height,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            transformOrigin: 'center center'
          }
        };
      case 'left-top':
        return {
          className: `${baseStyles} z-10`,
          style: {
            width: sideCardSize.width,
            height: sideCardSize.height,
            left: '20px', // At the very edge
            top: '5%', // Top spacing
            transform: 'none',
            transformOrigin: 'center center'
          }
        };
      case 'left-bottom':
        return {
          className: `${baseStyles} z-10`,
          style: {
            width: sideCardSize.width,
            height: sideCardSize.height,
            left: '20px', // At the very edge
            top: '55%', // Position from top to avoid overlap
            transform: 'none',
            transformOrigin: 'center center'
          }
        };
      case 'right-top':
        return {
          className: `${baseStyles} z-10`,
          style: {
            width: sideCardSize.width,
            height: sideCardSize.height,
            right: '20px', // At the very edge
            top: '5%', // Top spacing
            transform: 'none',
            transformOrigin: 'center center'
          }
        };
      case 'right-bottom':
        return {
          className: `${baseStyles} z-10`,
          style: {
            width: sideCardSize.width,
            height: sideCardSize.height,
            right: '20px', // At the very edge
            top: '55%', // Position from top to avoid overlap
            transform: 'none',
            transformOrigin: 'center center'
          }
        };
      default:
        return {
          className: baseStyles,
          style: {}
        };
    }
  };

  const { className, style } = getCardStyles();

  // No hover animations - static positioning only
  const getStaticTransform = () => {
    switch (position) {
      case 'center':
        return `translate(-50%, -50%)`;
      default:
        return `none`;
    }
  };

  return (
    <motion.div
      className={className}
      style={{
        ...style,
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform3d: 'translate3d(0,0,0)',
        WebkitTransform3d: 'translate3d(0,0,0)'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ opacity: 0 }}
      animate={{ 
        opacity: 1,
        transform: getStaticTransform()
      }}
      transition={{ 
        duration: 0.6, 
        ease: "easeOut"
      }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
    >
      {/* Wishlist Button */}
      {onToggleWishlist && (
        <button
          type="button"
          onClick={handleToggleWishlist}
          className={`absolute top-3 right-3 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
            isWishlisted 
              ? 'bg-canyon text-creme-light opacity-100' 
              : 'bg-white/90 text-dark opacity-0 group-hover:opacity-100 hover:bg-canyon hover:text-creme-light'
          }`}
        >
          <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
        </button>
      )}

      {/* Featured Badge for center card */}
      {position === 'center' && (
        <div className="absolute top-4 left-4 z-10 bg-canyon text-creme-light px-3 py-1.5 text-xs font-medium uppercase tracking-wider rounded-full">
          Featured
        </div>
      )}

      <Link to={`/product/${product.slug}`} className="block h-full group relative">
        {/* Product Image - Full card */}
        <div className="relative h-full overflow-hidden">
          <img
            className="w-full h-full object-cover transition-all duration-700"
            src={!imageError ? (product.gallery_images?.[0] || '/images/inspiration/product-placeholder.webp') : '/images/inspiration/product-placeholder.webp'}
            alt={product.name}
            onError={() => setImageError(true)}
          />
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        {/* Info Bubble - appears after scaling animation */}
        <motion.div
          className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/20"
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{
            opacity: isHovered ? 1 : 0,
            y: isHovered ? 0 : 20,
            scale: isHovered ? 1 : 0.8
          }}
          transition={{
            duration: 0.3,
            delay: isHovered ? 0.3 : 0, // Delay appearance until scaling is complete
            ease: "easeOut"
          }}
          style={{ minWidth: '200px' }}
        >
          <div className="text-center">
            <p className="text-canyon text-xs font-medium uppercase tracking-wider mb-1">
              {product.brand || 'Premium'}
            </p>
            <h3 className="text-dark font-semibold text-sm leading-tight mb-3 line-clamp-2">
              {product.name}
            </h3>
            <p className="text-dark font-bold text-lg mb-3">
              ₹{formatIndianPrice(product.price)}
            </p>
            
            {/* Action buttons */}
            <div className="flex gap-2 justify-center">
              <button
                onClick={handleToggleWishlist}
                className="w-8 h-8 bg-creme-light text-dark rounded-full flex items-center justify-center hover:bg-canyon hover:text-creme-light transition-all duration-300"
              >
                <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
              </button>
              {onAddToCart && (
                <button
                  onClick={handleAddToCart}
                  disabled={isLoading}
                  className="flex-1 bg-dark text-creme-light px-4 py-2 rounded-full hover:bg-canyon transition-all duration-300 disabled:opacity-50 text-xs font-medium uppercase tracking-wider"
                >
                  {isLoading ? 'Adding...' : 'Add to Cart'}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
};

export function ProductShowcase() {
  const { addToCart, isLoading } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const [showcaseProducts, setShowcaseProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetchShowcaseProducts();
  }, []);

  const fetchShowcaseProducts = async () => {
    try {
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, slug, brand, price, description, is_active, gallery_images, rating, review_count, created_at')
        .eq('is_active', true)
        .order('rating', { ascending: false })
        .limit(5);

      if (error) throw error;

      if (products && products.length > 0) {
        setShowcaseProducts(products); // 5 products: 4 side cards + 1 center card
      }
    } catch (error) {
      console.error('Error fetching showcase products:', error);
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

  if (showcaseProducts.length === 0) {
    return null;
  }

  // Define the card positions array: 2 left cards + 1 center card + 2 right cards
  const positions: Array<'left-top' | 'left-bottom' | 'center' | 'right-top' | 'right-bottom'> = [
    'left-top', 'left-bottom', 'center', 'right-top', 'right-bottom'
  ];

  return (
    <section className="py-16 bg-creme min-h-screen flex items-center overflow-hidden">
      <div className="w-full max-w-none">
        {/* Section Header */}
        <div className="text-center mb-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="main-title text-dark mb-4">
              Discover Our Most Celebrated Collections
            </h2>
            <div className="w-16 h-0.5 bg-canyon mx-auto"></div>
          </motion.div>
        </div>

        {/* Fashion Cards Container */}
        <div className="relative w-full" style={{ height: '800px', minHeight: '750px' }}>
          {showcaseProducts.slice(0, 5).map((product, index) => (
            <FashionCard
              key={product.id}
              product={product}
              position={positions[index]}
              onAddToCart={handleAddToCart}
              onToggleWishlist={toggleWishlist}
              isWishlisted={isWishlisted(product.id)}
              isLoading={isLoading}
            />
          ))}
        </div>

        {/* Explore All Button */}
        <div className="text-center mt-16">
          <Link 
            to="/products" 
            className="btn-primary inline-flex items-center px-8 py-4 text-lg"
          >
            EXPLORE ALL PRODUCTS
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
