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
  const [sectionConfig, setSectionConfig] = useState({
    title: 'Discover Our Most Celebrated Collections',
    background_image: '',
    button_text: 'Explore Collection',
    button_url: '/products',
    is_enabled: true
  });

  useEffect(() => {
    fetchShowcaseProducts();
    fetchSectionConfig();
  }, []);

  const fetchShowcaseProducts = async () => {
    try {
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, slug, brand, price, description, is_active, gallery_images, rating, review_count, created_at, is_showcase, showcase_order')
        .eq('is_active', true)
        .eq('is_showcase', true)
        .order('showcase_order', { ascending: true })
        .limit(6); // 6 products for the grid layout

      if (error) throw error;
      setShowcaseProducts(products || []);
    } catch (error) {
      console.error('Error fetching showcase products:', error);
    }
  };

  const fetchSectionConfig = async () => {
    try {
      const { data: config, error } = await supabase
        .from('section_configurations')
        .select('title, background_image, button_text, button_url, is_enabled')
        .eq('section_name', 'product_showcase')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (config) {
        setSectionConfig({
          title: config.title || 'Discover Our Most Celebrated Collections',
          background_image: config.background_image || '',
          button_text: config.button_text || 'Explore Collection',
          button_url: config.button_url || '/products',
          is_enabled: config.is_enabled !== false
        });
      }
    } catch (error) {
      console.error('Error fetching section config:', error);
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

  if (!sectionConfig.is_enabled || showcaseProducts.length === 0) {
    return null;
  }

  return (
    <section className="py-20 bg-creme relative min-h-[700px]">
      <div className="w-full">
        {/* Section Header */}
        <div className="text-center mb-16 px-4">
          <div>
            <h2 className="main-title text-dark mb-4">
              {sectionConfig.title}
            </h2>
            <div className="w-16 h-0.5 bg-canyon mx-auto"></div>
          </div>
        </div>

        {/* Product Showcase Layout */}
        <div className="w-[90%] mx-auto px-4 mb-16">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 h-[500px]">
            {/* First Column (2/5 width) - Featured Image */}
            <div className="col-span-1 lg:col-span-2">
              <div className="relative h-full rounded-lg overflow-hidden bg-creme/20 group">
                {sectionConfig.background_image ? (
                  <img
                    src={sectionConfig.background_image}
                    alt="Showcase Collection"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-canyon/20 to-dark/20 flex items-center justify-center">
                    <div className="text-center text-dark/60">
                      <div className="text-4xl mb-4">🏆</div>
                      <p className="text-lg font-medium">Celebrated Collections</p>
                      <p className="text-sm">Premium Selection</p>
                    </div>
                  </div>
                )}

                {/* Overlay with section info */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-6">
                  <div className="text-white">
                    <h3 className="text-xl font-bold mb-2">
                      Premium Collections
                    </h3>
                    <p className="text-sm opacity-90">
                      Handpicked selections from our finest tobacco products
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Second Column (3/5 width) - 6 Products in 2 rows */}
            <div className="col-span-1 lg:col-span-3">
              <div className="grid grid-rows-2 gap-6 h-full">
                {/* First Row - 3 Products */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {showcaseProducts.slice(0, 3).map((product, index) => (
                    <div key={product.id} className="h-full">
                      <ProductCard
                        product={product}
                        onAddToCart={handleAddToCart}
                        isLoading={isLoading}
                        index={index}
                        variant="default"
                      />
                    </div>
                  ))}
                </div>

                {/* Second Row - 3 Products */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {showcaseProducts.slice(3, 6).map((product, index) => (
                    <div key={product.id} className="h-full">
                      <ProductCard
                        product={product}
                        onAddToCart={handleAddToCart}
                        isLoading={isLoading}
                        index={index + 3}
                        variant="default"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* View All Button - Centered below everything in the section */}
        <div className="flex justify-center mt-0 px-4">
          <Link
            to={sectionConfig.button_url}
            className="btn-primary inline-flex items-center px-8 py-3"
          >
            {sectionConfig.button_text}
          </Link>
        </div>
      </div>
    </section>
  );
}
