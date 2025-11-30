import { memo, useCallback } from 'react';
import { useCart } from '../../hooks/useCart';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { ProductCard } from '../../components/products/ProductCard';
import { ShowcaseConfig, HomepageProduct } from '../../types/home';

interface ProductShowcaseProps {
  products?: HomepageProduct[];
  config?: ShowcaseConfig | null;
  isLoading?: boolean;
}

export const ProductShowcase = memo(function ProductShowcase({ 
  products = [], 
  config, 
  isLoading = false 
}: ProductShowcaseProps) {
  const { addToCart, isLoading: cartLoading } = useCart();

  const sectionConfig = {
    title: config?.title || 'Discover Our Most Celebrated Collections',
    background_image: config?.background_image || '',
    button_text: config?.button_text || 'Explore Collection',
    button_url: config?.button_url || '/products',
    is_enabled: config?.is_enabled !== false
  };

  const handleAddToCart = useCallback(async (product: HomepageProduct) => {
    try {
      await addToCart(product as any, 1);
      toast.success(`${product.name} added to cart!`);
    } catch {
      toast.error('Failed to add item to cart');
    }
  }, [addToCart]);

  if (!sectionConfig.is_enabled || products.length === 0) {
    return null;
  }

  return (
    <section className="py-8 md:py-16 bg-creme relative">
      <div className="w-full">
        {/* Section Header */}
        <div className="text-center mb-6 md:mb-12 px-4">
          <div>
            <h2 className="medium-title leading-tight text-2xl sm:text-3xl lg:text-4xl xl:text-5xl text-dark mb-2 md:mb-4">
              {sectionConfig.title}
            </h2>
            <div className="w-12 md:w-16 h-0.5 bg-canyon mx-auto"></div>
          </div>
        </div>

        {/* Mobile: 3 columns (1 image + 2 products) x 3 rows */}
        <div className="md:hidden px-4">
          <div className="grid grid-cols-3 grid-rows-3 gap-2 auto-rows-fr">
            {/* First Column - Image spanning 3 rows */}
            <div className="row-span-3 row-start-1">
              <div className="relative h-full rounded-lg overflow-hidden bg-creme/20">
                {sectionConfig.background_image ? (
                  <img
                    src={sectionConfig.background_image}
                    alt="Showcase Collection"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-canyon/20 to-dark/20 flex items-center justify-center">
                    <div className="text-center text-dark/60">
                      <div className="text-2xl mb-2">🏆</div>
                      <p className="text-[10px] font-medium">Premium</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Products - 6 cards in 2 columns x 3 rows */}
            {products.slice(0, 6).map((product, index) => (
              <div key={product.id} className={index % 2 === 0 ? 'col-start-2' : 'col-start-3'}>
                <ProductCard
                  product={product as any}
                  onAddToCart={handleAddToCart as any}
                  isLoading={isLoading}
                  index={index}
                  variant="default"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Desktop: Original 2-column layout */}
        <div className="hidden md:block w-[90%] mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 min-h-[500px]">
            {/* First Column (2/5 width) - Featured Image */}
            <div className="col-span-1 lg:col-span-2">
              <div className="relative h-full rounded-lg overflow-hidden bg-creme/20 group min-h-[500px]">
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
              <div className="grid grid-rows-2 gap-6 h-full min-h-[500px]">
                {/* First Row - 3 Products */}
                <div className="grid grid-cols-3 gap-4">
                  {products.slice(0, 3).map((product, index) => (
                    <div key={product.id} className="h-full">
                      <ProductCard
                        product={product as any}
                        onAddToCart={handleAddToCart as any}
                        isLoading={isLoading}
                        index={index}
                        variant="default"
                      />
                    </div>
                  ))}
                </div>

                {/* Second Row - 3 Products */}
                <div className="grid grid-cols-3 gap-4">
                  {products.slice(3, 6).map((product, index) => (
                    <div key={product.id} className="h-full">
                      <ProductCard
                        product={product as any}
                        onAddToCart={handleAddToCart as any}
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

        {/* View All Button - Centered below the entire section */}
        <div className="text-center mt-8 md:mt-16 px-4">
          <Link
            to={sectionConfig.button_url}
            className="btn-primary inline-flex items-center text-sm md:text-base px-6 md:px-8 py-2 md:py-3"
          >
            {sectionConfig.button_text}
          </Link>
        </div>
      </div>
    </section>
  );
});
