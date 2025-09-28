import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ShoppingCart, Trash2, ArrowLeft, Share2, Grid3X3, List } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../utils/supabase/client';
import { Product, useCart } from '../../hooks/useCart';
import { useWishlist } from '../../hooks/useWishlist';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { getProductImageUrl } from '../../utils/supabase/storage';

// Helper function to format price in Indian numbering system
const formatIndianPrice = (priceINR: number): string => {
  return priceINR.toLocaleString('en-IN');
};

interface WishlistItemProps {
  product: Product;
  onRemove: (productId: string) => void;
  onAddToCart: (product: Product) => void;
  isLoading: boolean;
  viewMode: 'grid' | 'list';
}

const WishlistItem = React.forwardRef<HTMLDivElement, WishlistItemProps>(({ 
  product, 
  onRemove, 
  onAddToCart, 
  isLoading,
  viewMode 
}, ref) => {
  const [imageError, setImageError] = useState(false);

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRemove(product.id);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onAddToCart(product);
  };

  if (viewMode === 'list') {
    return (
      <motion.div
        ref={ref}
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -100 }}
        className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden"
      >
        <div className="flex">
          {/* Product Image */}
          <div className="relative w-32 h-32 flex-shrink-0">
            <img
              src={!imageError ? getProductImageUrl(product.gallery_images?.[0]) : getProductImageUrl()}
              alt={product.name}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover"
            />
            <button
              onClick={handleRemove}
              className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors duration-200"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Product Info */}
          <div className="flex-1 p-4 flex flex-col justify-between">
            <div>
              <Link to={`/product/${product.slug}`}>
                <h3 className="text-lg font-semibold text-dark hover:text-canyon transition-colors duration-200 line-clamp-2">
                  {product.name}
                </h3>
              </Link>
              <p className="text-sm text-gray-600 mt-1">{product.brand}</p>
              <p className="text-xl font-bold text-dark mt-2">₹{formatIndianPrice(product.price)}</p>
            </div>
            
            <div className="flex items-center justify-between mt-4">
              <Link
                to={`/product/${product.slug}`}
                className="text-canyon hover:text-dark transition-colors duration-200 font-medium"
              >
                View Details
              </Link>
              <Button
                onClick={handleAddToCart}
                disabled={isLoading}
                className="bg-dark text-white hover:bg-canyon transition-colors duration-200"
              >
                {isLoading ? 'Adding...' : 'Add to Cart'}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Grid view
  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden group"
    >
      <div className="relative">
        <img
          src={!imageError ? getProductImageUrl(product.gallery_images?.[0]) : getProductImageUrl()}
          alt={product.name}
          onError={() => setImageError(true)}
          className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
        />
        
        {/* Remove button */}
        <button
          onClick={handleRemove}
          className="absolute top-3 right-3 w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors duration-200 opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-5 h-5" />
        </button>

        {/* Quick Add to Cart */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <Button
            onClick={handleAddToCart}
            disabled={isLoading}
            className="w-full bg-white text-dark hover:bg-canyon hover:text-white transition-all duration-200"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {isLoading ? 'Adding...' : 'Add to Cart'}
          </Button>
        </div>
      </div>

      <div className="p-4">
        <Link to={`/product/${product.slug}`}>
          <h3 className="text-lg font-semibold text-dark hover:text-canyon transition-colors duration-200 line-clamp-2 mb-2">
            {product.name}
          </h3>
        </Link>
        <p className="text-sm text-gray-600 mb-2">{product.brand}</p>
        <p className="text-xl font-bold text-dark">₹{formatIndianPrice(product.price)}</p>
      </div>
    </motion.div>
  );
});

WishlistItem.displayName = 'WishlistItem';

const EmptyWishlist: React.FC = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="text-center py-16"
  >
    <div className="max-w-md mx-auto">
      <div className="w-24 h-24 bg-creme-light rounded-full flex items-center justify-center mx-auto mb-6">
        <Heart className="w-12 h-12 text-gray-400" />
      </div>
      <h2 className="text-2xl font-serif text-dark mb-4">Your Wishlist is Empty</h2>
      <p className="text-gray-600 mb-8 leading-relaxed">
        Discover our premium collection and save your favorite products to your wishlist for easy access later.
      </p>
      <Link to="/products">
        <Button className="bg-dark text-white hover:bg-canyon transition-colors duration-200 px-8 py-3">
          Explore Products
          <ArrowLeft className="w-5 h-5 ml-2 rotate-180" />
        </Button>
      </Link>
    </div>
  </motion.div>
);

export function WishlistPage() {
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { addToCart, isLoading: cartLoading } = useCart();
  const { wishlistItems, toggleWishlist, clearWishlist: clearWishlistHook } = useWishlist();

  useEffect(() => {
    fetchWishlistProducts();
  }, [wishlistItems]);

  const fetchWishlistProducts = async () => {
    try {
      setIsLoading(true);
      
      if (!wishlistItems || wishlistItems.length === 0) {
        setWishlistProducts([]);
        setIsLoading(false);
        return;
      }

      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, slug, brand, price, description, is_active, gallery_images, rating, review_count, created_at')
        .in('id', wishlistItems)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching wishlist products:', error);
        toast.error('Failed to load wishlist products');
        setWishlistProducts([]);
      } else {
        setWishlistProducts(products || []);
      }
    } catch (error) {
      console.error('Error loading wishlist:', error);
      setWishlistProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const removeFromWishlist = async (productId: string) => {
    try {
      await toggleWishlist(productId);
      // The wishlistItems will update automatically via the hook
      // and fetchWishlistProducts will be called via useEffect
    } catch (error) {
      console.error('Error removing from wishlist:', error);
      toast.error('Failed to remove from wishlist');
    }
  };

  const handleAddToCart = async (product: Product) => {
    try {
      await addToCart(product, 1);
      toast.success(`${product.name} added to cart!`);
    } catch (error) {
      toast.error('Failed to add to cart');
    }
  };

  const clearWishlist = async () => {
    try {
      await clearWishlistHook();
      // The wishlistItems will update automatically via the hook
      // and fetchWishlistProducts will be called via useEffect
    } catch (error) {
      console.error('Error clearing wishlist:', error);
      toast.error('Failed to clear wishlist');
    }
  };

  const shareWishlist = () => {
    if (navigator.share) {
      navigator.share({
        title: 'My Wishlist - Cigarro',
        text: 'Check out my wishlist on Cigarro',
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Wishlist link copied to clipboard');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-creme flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-dark"></div>
          <p className="text-dark mt-4 font-sans">Loading your wishlist...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>My Wishlist - Cigarro</title>
        <meta name="description" content="Your saved favorite products from our premium collection." />
      </Helmet>

      <div className="min-h-screen bg-creme">
        {/* Header */}
        <div className="main-container">
          <div className="py-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between mb-8"
            >
              <div>
                <h1 className="main-title text-dark mb-4">My Wishlist</h1>
                <p className="text-dark/80 font-sans text-lg">
                  {wishlistProducts.length > 0 
                    ? `${wishlistProducts.length} ${wishlistProducts.length === 1 ? 'item' : 'items'} saved`
                    : 'No items saved yet'
                  }
                </p>
              </div>

              {wishlistProducts.length > 0 && (
                <div className="flex items-center gap-4">
                  {/* View Mode Toggle */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-2 rounded ${viewMode === 'grid' ? 'bg-dark text-white' : 'bg-white text-dark border border-coyote'}`}
                    >
                      <Grid3X3 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 rounded ${viewMode === 'list' ? 'bg-dark text-white' : 'bg-white text-dark border border-coyote'}`}
                    >
                      <List className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Action Buttons */}
                  <Button
                    onClick={shareWishlist}
                    variant="outline"
                    className="border-dark text-dark hover:bg-dark hover:text-white"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                  
                  <Button
                    onClick={clearWishlist}
                    variant="outline"
                    className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear All
                  </Button>
                </div>
              )}
            </motion.div>

            {/* Breadcrumb */}
            <nav className="flex items-center space-x-2 text-sm text-dark/60 mb-8">
              <Link to="/" className="hover:text-dark transition-colors">Home</Link>
              <span>/</span>
              <span>Wishlist</span>
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="main-container pb-16">
          {wishlistProducts.length === 0 ? (
            <EmptyWishlist />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                  : 'space-y-4'
              }
            >
              <AnimatePresence mode="popLayout">
                {wishlistProducts.map((product) => (
                  <WishlistItem
                    key={product.id}
                    product={product}
                    onRemove={removeFromWishlist}
                    onAddToCart={handleAddToCart}
                    isLoading={cartLoading}
                    viewMode={viewMode}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>

        {/* Continue Shopping */}
        {wishlistProducts.length > 0 && (
          <div className="main-container pb-16">
            <div className="text-center">
              <Link to="/products">
                <Button className="bg-dark text-white hover:bg-canyon transition-colors duration-200 px-8 py-3">
                  Continue Shopping
                  <ArrowLeft className="w-5 h-5 ml-2 rotate-180" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
