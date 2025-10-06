import React, { useRef, useState } from 'react';
import { useWishlist } from '../../hooks/useWishlist';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { getProductImageUrl } from '../../utils/supabase/storage';
import { Product } from '../../hooks/useCart';

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
  const imgRef = useRef<HTMLImageElement>(null);

  // Mobile-only polished drop-to-cart animation
  const animateDropToCart = () => {
    try {
      // Only on mobile (match Tailwind md: 768px)
      if (typeof window === 'undefined' || window.innerWidth >= 768) return;

      const cartTarget = document.getElementById('mobile-cart-target');
      if (!cartTarget) return;

      const targetRect = cartTarget.getBoundingClientRect();

      // Determine base badge size (if present)
      const badgeEl = cartTarget.querySelector('span');
      let base = 20;
      if (badgeEl) {
        const br = badgeEl.getBoundingClientRect();
        base = Math.round(Math.min(br.width, br.height)) || 20;
      }

      // Slightly bigger and taller than badge
      const width = Math.round(base * 1.2);
      const height = Math.round(width * 1.15); // taller oval

      // Start just above the cart icon, horizontally centered
      const startLeft = targetRect.left + (targetRect.width - width) / 2;
      const startTop = targetRect.top - height - 14; // a bit higher above
      const endLeft = targetRect.left + (targetRect.width - width) / 2;
      const endTop = targetRect.top + (targetRect.height - height) / 2;

      // Resolve dark theme color for outline from Tailwind 'text-dark'
      const resolveDarkColor = () => {
        try {
          const probe = document.createElement('span');
          probe.className = 'text-dark';
          probe.style.position = 'fixed';
          probe.style.visibility = 'hidden';
          probe.textContent = '.';
          document.body.appendChild(probe);
          const color = getComputedStyle(probe).color || 'rgba(0,0,0,0.9)';
          probe.remove();
          return color;
        } catch {
          return 'rgba(0,0,0,0.9)';
        }
      };
      const darkOutline = resolveDarkColor();

      // Create circle with product image fill
      const circle = document.createElement('div');
      const imgUrl = !imageError ? getProductImageUrl(product.gallery_images?.[0]) : getProductImageUrl();
      circle.style.position = 'fixed';
      circle.style.left = `${startLeft}px`;
      circle.style.top = `${startTop}px`;
      circle.style.width = `${width}px`;
      circle.style.height = `${height}px`;
      circle.style.borderRadius = '9999px';
      circle.style.backgroundColor = darkOutline;
      circle.style.backgroundImage = `url(${imgUrl})`;
      circle.style.backgroundSize = 'cover';
      circle.style.backgroundPosition = 'center';
      circle.style.outline = `2px solid ${darkOutline}`;
      circle.style.boxShadow = '0 6px 20px rgba(0,0,0,0.18)';
      circle.style.zIndex = '2147483647';
      circle.style.transform = 'translate3d(0,0,0)';
      document.body.appendChild(circle);

      const drop = circle.animate(
        [
          { transform: 'translateY(-8px) scale(0.95, 0.9)', opacity: 0.95 },
          { left: `${endLeft}px`, top: `${endTop + 8}px`, transform: 'scale(1.08, 0.92)', opacity: 1 },
          { left: `${endLeft}px`, top: `${endTop}px`, transform: 'scale(1)', opacity: 0 }
        ],
        { 
          duration: 3000, // Slower, more dramatic fall
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', 
          fill: 'forwards' 
        });

      drop.onfinish = () => {
        circle.remove();
        // Cart animation now triggers immediately on click
      };
    } catch (err) {
      // Ignore animation errors silently
    }
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAddToCart) {
      onAddToCart(product);
      toast.success(`${product.name} added to cart`);
      // trigger mobile-only drop-to-cart animation
      animateDropToCart();
      // trigger cart icon animation after 2 second delay
      setTimeout(() => {
        const cartTarget = document.getElementById('mobile-cart-target');
        if (cartTarget) {
          cartTarget.animate(
            [
              { transform: 'scale(1)' },
              { transform: 'scale(1.15)' },
              { transform: 'scale(1)' }
            ],
            { duration: 120, easing: 'ease-out' }
          );
        }
      }, 350);
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
            ref={imgRef}
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
                className="bg-dark text-creme-light hover:bg-canyon transition-all duration-300 font-medium text-xs uppercase tracking-wide px-3 py-1.5 rounded-full disabled:opacity-50 min-w-[80px] sm:min-w-[100px]"
              >
                {isLoading ? 'Adding...' : 'Add'}
              </button>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
};

