import React, { useState, useEffect } from 'react';
import { useCart, Product } from '../hooks/useCart';
import { toast } from 'sonner';
import { supabase } from '../utils/supabase/client';
import { Link } from 'react-router-dom';

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

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAddToCart) {
      onAddToCart(product);
      toast.success(`${product.name} added to cart`);
    }
  };


  return (
    <div className="group bg-creme-light rounded-lg shadow-lg border border-coyote/20 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1">

      <Link to={`/product/${product.slug}`} className="block relative">
        {/* Product Image */}
        <div className="relative aspect-square overflow-hidden bg-creme/20">
          <img
            className="w-full h-full object-cover transition-all duration-500"
            src={!imageError ? (product.gallery_images?.[0] || '/images/inspiration/product-placeholder.webp') : '/images/inspiration/product-placeholder.webp'}
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
        .limit(6);

      if (error) throw error;

      if (products && products.length > 0) {
        setShowcaseProducts(products); // 6 products for 2x3 grid
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

        {/* Main Content - Split Layout with 2:3 ratio */}
        <div className="w-[90%] mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
            
            {/* Left Side - Lifestyle Image (2/5 of width) */}
            <div className="relative lg:col-span-2">
              <div className="relative aspect-[3/4.2] rounded-xl overflow-hidden bg-creme/20 shadow-2xl">
                <img
                  src="/images/inspiration/lifestyle-bath-essentials.webp"
                  alt="Premium Tobacco Lifestyle"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = "/images/inspiration/DSC01551-2_1.webp";
                  }}
                />
                
                {/* Overlay Text */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end">
                  <div className="p-8 text-white">
                    <h3 className="text-3xl font-serif font-normal mb-4">PREMIUM TOBACCO</h3>
                    <p className="text-lg leading-relaxed opacity-90">
                      Discover a range of premium tobacco products - designed to elevate your smoking experience to a luxury retreat.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Product Grid (3/5 of width) */}
            <div className="lg:col-span-3">
              {/* Product Grid - 3x2 (3 columns, 2 rows) */}
              <div className="grid grid-cols-3 gap-4">
                {showcaseProducts.slice(0, 6).map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={handleAddToCart}
                    isLoading={isLoading}
                    index={index}
                  />
                ))}
              </div>
            </div>
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
      </div>
    </section>
  );
}
