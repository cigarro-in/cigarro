import React, { useState, useEffect } from 'react';
import { useCart, Product } from '../hooks/useCart';
import { useWishlist } from '../hooks/useWishlist';
import { toast } from 'sonner';
import { supabase } from '../utils/supabase/client';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { getProductImageUrl, getLifestyleImageUrl } from '../utils/supabase/storage';
import { ProductShowcaseGrid } from './ProductShowcaseGrid';

// Helper function to format price in Indian numbering system
const formatIndianPrice = (priceINR: number): string => {
  return priceINR.toLocaleString('en-IN');
};

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void;
  isLoading?: boolean;
  index?: number;
  variant?: 'default' | 'list' | 'featured';
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  isLoading = false,
  index = 0,
  variant = 'default'
}) => {
  const [imageError, setImageError] = useState(false);
  const { isWishlisted, toggleWishlist, isLoading: wishlistLoading } = useWishlist();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAddToCart) {
      onAddToCart(product);
      toast.success(`${product.name} added to cart`);
    }
  };

  const handleWishlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await toggleWishlist(product.id);
    } catch (error) {
      console.error('Error toggling wishlist:', error);
    }
  };


  return (
    <div className="group bg-creme-light rounded-lg shadow-lg border border-coyote/20 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 relative">
      {/* Wishlist Button - Outside Link */}
      <button
        onClick={handleWishlistToggle}
        disabled={wishlistLoading}
        className="absolute top-3 right-3 z-10 p-2 bg-creme-light/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-creme-light transition-all duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed group/wishlist"
        aria-label={isWishlisted(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        <Heart
          className={`w-5 h-5 transition-all duration-300 ${
            isWishlisted(product.id)
              ? 'fill-canyon text-canyon'
              : 'text-dark group-hover/wishlist:text-canyon'
          }`}
          strokeWidth={1.5}
        />
      </button>

      <Link to={`/product/${product.slug}`} className="block relative">
        {/* Product Image */}
        <div className="relative aspect-square overflow-hidden bg-creme/20">
          <img
            className="w-full h-full object-cover transition-all duration-500"
            src={!imageError ? getProductImageUrl(product.gallery_images?.[0]) : getProductImageUrl()}
            alt={product.name}
            onError={() => setImageError(true)}
          />
        </div>

        {/* Product Info */}
        <div className="p-4">
          <div className="mb-3">
            <p className="text-canyon text-xs font-medium uppercase tracking-wider mb-1">
              {product.brand || 'Premium'}
            </p>
            <h3 className="text-dark font-bold text-base leading-tight hover:text-canyon transition-colors line-clamp-2">
              {product.name}
            </h3>
          </div>
          
          <div className="flex items-center justify-between">
            <p className="text-dark font-bold text-base">
              ₹{formatIndianPrice(product.price)}
            </p>
            
            {/* Add to Cart Button */}
            {onAddToCart && (
              <button
                onClick={handleAddToCart}
                disabled={isLoading}
                className="bg-dark text-creme-light hover:bg-canyon transition-all duration-300 font-medium text-xs uppercase tracking-wide px-3 py-1.5 rounded-full disabled:opacity-50"
              >
                {isLoading ? 'Adding...' : 'Add to Cart'}
              </button>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
};

export function ProductShowcase() {
  const { addToCart, isLoading } = useCart();
  const { wishlistItems, isWishlisted, toggleWishlist } = useWishlist();
  const [showcaseProducts, setShowcaseProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetchShowcaseProducts();
  }, []);

  const fetchShowcaseProducts = async () => {
    try {
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, slug, brand, price, description, is_active, gallery_images, rating, review_count, created_at, is_showcase, showcase_order')
        .eq('is_active', true)
        .eq('is_showcase', true)
        .order('showcase_order', { ascending: true })
        .limit(7); // 7 products for the organic layout

      if (error) throw error;
      setShowcaseProducts(products || []);
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

  return (
    <section className="py-16 bg-creme min-h-screen flex items-center">
      <div className="w-full">
        {/* Section Header */}
        <div className="text-center mb-12 px-4">
          <div>
            <h2 className="main-title text-dark mb-4">
              Discover Our Most Celebrated Collections
            </h2>
            <div className="w-16 h-0.5 bg-canyon mx-auto"></div>
          </div>
        </div>

        {/* Product Showcase Grid */}
        <div className="w-[90%] mx-auto px-4">
          <ProductShowcaseGrid
            products={showcaseProducts}
            onAddToCart={handleAddToCart}
            onToggleWishlist={toggleWishlist}
            wishlist={new Set(wishlistItems)}
            isLoading={isLoading}
          />
        </div>

        {/* View All Button - Centered in entire section */}
        <div className="flex justify-center mt-12">
          <Link
            to="/products"
            className="btn-primary inline-flex items-center px-8 py-3"
          >
            View All
          </Link>
        </div>
      </div>
    </section>
  );
}
