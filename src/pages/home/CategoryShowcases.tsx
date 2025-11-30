import React from 'react';
import { Package, Leaf, Flame } from 'lucide-react';
import { ProductCard } from '../../components/products/ProductCard';
import { useCart, Product } from '../../hooks/useCart';
import { toast } from 'sonner';
import { CategoryWithProducts } from '../../types/home';

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  cigarettes: Package,
  cigars: Leaf,
  tobacco: Flame,
  accessories: Package,
};

interface CategoryShowcasesProps {
  categoriesWithProducts?: CategoryWithProducts[];
  isLoading?: boolean;
}

export function CategoryShowcases({ categoriesWithProducts = [], isLoading = false }: CategoryShowcasesProps) {
  const { addToCart, isLoading: cartLoading } = useCart();

  // Debug logging
  console.log('🏷️ CategoryShowcases received data:', {
    categoriesWithProducts,
    count: categoriesWithProducts?.length,
    isLoading,
    firstCategory: categoriesWithProducts?.[0],
    firstCategoryProducts: categoriesWithProducts?.[0]?.products
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleAddToCart = async (product: any) => {
    try {
      await addToCart(product, 1);
      toast.success(`${product.name} added to cart!`);
    } catch (error) {
      toast.error('Failed to add item to cart');
    }
  };

  if (isLoading) {
    // Minimal height reservation
    return <section className="py-6 bg-creme min-h-[400px]"></section>;
  }

  if (categoriesWithProducts.length === 0) {
    return null;
  }

  return (
    <section className="py-6 bg-creme">
      <div className="space-y-12">
        {categoriesWithProducts.map((category) => (
          <CategoryProductRow 
            key={category.id} 
            category={category} 
            onAddToCart={handleAddToCart}
            isLoading={cartLoading}
          />
        ))}
      </div>
    </section>
  );
}

// Sub-component for individual category rows
function CategoryProductRow({ 
  category, 
  onAddToCart, 
  isLoading 
}: { 
  category: CategoryWithProducts;
  onAddToCart: (p: any) => void;
  isLoading: boolean;
}) {
  const IconComponent = categoryIcons[category.slug] || Package;

  return (
    <div className="relative">
      {/* Full-width section */}
      <div className="relative py-10 px-4">
        {/* Category Title */}
        <h2 className="medium-title leading-tight text-2xl sm:text-3xl lg:text-4xl xl:text-5xl text-center mb-4">
          {category.name}
        </h2>
        
        {/* Category Tagline/Description */}
        {category.description && (
          <p className="text-dark/70 text-center text-sm mb-6 max-w-xs mx-auto">
            {category.description}
          </p>
        )}

        {/* Large Circular Category Image */}
        <div className="flex justify-center mb-8">
          <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-dark shadow-xl bg-creme-light">
            {category.image ? (
              <img
                src={category.image}
                alt={category.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-coyote/20 to-canyon/20 flex items-center justify-center">
                <IconComponent className="w-24 h-24 text-dark/60" />
              </div>
            )}
          </div>
        </div>

        {/* Horizontal Scrolling Products - 2.5 cards visible */}
        <div 
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2"
          style={{ 
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {category.products.map((product, index) => (
            <div
              key={product.id}
              className="flex-shrink-0 snap-start"
              style={{ width: 'calc(40% - 6px)', minWidth: '150px', maxWidth: '180px' }}
            >
              <ProductCard
                product={product as any}
                onAddToCart={onAddToCart}
                isLoading={isLoading}
                index={index}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
