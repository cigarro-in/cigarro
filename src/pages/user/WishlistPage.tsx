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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleRemove = async () => {
    try {
      await onRemove(product.id);
      setShowDeleteConfirm(false);
    } catch (error) {
      toast.error('Failed to remove item');
    }
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onAddToCart(product);
  };

  // Cart-style horizontal card layout
  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className="bg-background border border-border rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-start gap-4">
        {/* Product Image */}
        <Link to={`/product/${product.slug}`} className="relative w-20 h-20 bg-muted rounded-lg overflow-hidden flex-shrink-0">
          <img
            src={!imageError ? getProductImageUrl(product.gallery_images?.[0]) : getProductImageUrl()}
            alt={product.name}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover"
          />
        </Link>

        {/* Product Info */}
        <div className="flex-1 min-w-0">
          <Link to={`/product/${product.slug}`} className="group">
            <h3 className="font-medium text-foreground group-hover:text-accent transition-colors duration-200 line-clamp-2 leading-tight">
              {product.name}
            </h3>
          </Link>
          <p className="text-sm text-muted-foreground mt-1">{product.brand}</p>
          <p className="text-lg font-semibold text-foreground mt-2">₹{formatIndianPrice(product.price)}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col items-end gap-2">
          {/* Add to Cart Button */}
          <Button
            onClick={handleAddToCart}
            disabled={isLoading}
            size="sm"
            className="whitespace-nowrap"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Add to Cart
          </Button>

          {/* Remove Button */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isLoading}
            className="text-red-500 hover:text-red-600 transition-colors duration-200 p-2 hover:bg-red-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            title="Remove from wishlist"
            aria-label="Remove item"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-border bg-muted/50 rounded-lg p-4"
          >
            <p className="text-sm text-muted-foreground mb-3">
              Remove "{product.name}" from your wishlist?
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleRemove}
                className="flex-1"
              >
                Remove
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

WishlistItem.displayName = 'WishlistItem';

const EmptyWishlist: React.FC = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="text-center py-16 px-4"
  >
    <div className="max-w-md mx-auto">
      <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
        <Heart className="w-12 h-12 text-muted-foreground" />
      </div>
      <h2 className="text-2xl font-serif text-foreground mb-4">Your Wishlist is Empty</h2>
      <p className="text-muted-foreground mb-8 leading-relaxed">
        Discover our premium collection and save your favorite products to your wishlist for easy access later.
      </p>
      <Link to="/products">
        <Button className="px-8 py-3">
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
      <div className="min-h-screen bg-background md:bg-creme flex items-center justify-center">
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
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background md:bg-creme pb-24 md:pb-16">
        {/* Mobile Header */}
        <div className="md:hidden px-4 bg-background border-b border-border">
          <div className="text-center">
            <h1 className="medium-title leading-tight text-2xl sm:text-3xl lg:text-4xl xl:text-5xl">My Wishlist</h1>
          </div>
        </div>

        {/* Desktop Header - Preserved */}
        <div className="hidden md:block main-container">
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
                  {/* Action Buttons - Desktop only */}
                  <Button
                    onClick={shareWishlist}
                    variant="outline"
                    className="hidden md:inline-flex border-dark text-dark hover:bg-dark hover:text-white"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                  
                  <Button
                    onClick={clearWishlist}
                    variant="outline"
                    className="hidden md:inline-flex border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
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
            <div className="space-y-4 max-w-3xl mx-auto">
              <AnimatePresence mode="popLayout">
                {wishlistProducts.map((product) => (
                  <WishlistItem
                    key={product.id}
                    product={product}
                    onRemove={removeFromWishlist}
                    onAddToCart={handleAddToCart}
                    isLoading={cartLoading}
                    viewMode="list"
                  />
                ))}
              </AnimatePresence>
            </div>
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
