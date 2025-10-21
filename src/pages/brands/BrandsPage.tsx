import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { ArrowRight, Star, Package } from 'lucide-react';
import { SEOHead } from '../../components/seo/SEOHead';

interface Brand {
  name: string;
  product_count: number;
  description?: string;
  logo_url?: string;
  slug?: string;
}

export function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    try {
      setIsLoading(true);

      // Get unique brands with product counts
      const { data: products, error } = await supabase
        .from('products')
        .select('brand')
        .eq('is_active', true);

      if (error) throw error;

      // Count products per brand
      const brandCounts = products.reduce((acc: Record<string, number>, product) => {
        acc[product.brand] = (acc[product.brand] || 0) + 1;
        return acc;
      }, {});

      // Convert to array and sort by product count
      const brandsArray = Object.entries(brandCounts)
        .map(([name, product_count]) => ({
          name,
          product_count,
          slug: name.toLowerCase().replace(/\s+/g, '-')
        }))
        .sort((a, b) => b.product_count - a.product_count);

      setBrands(brandsArray);
    } catch (error) {
      console.error('Error fetching brands:', error);
      toast.error('Failed to load brands');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-creme flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-dark"></div>
          <p className="text-dark mt-4 font-sans">Loading premium brands...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Our Premium Brands"
        description="Discover our collection of premium cigarette brands from world-renowned manufacturers. Shop authentic tobacco products from the world's finest brands."
        url="/brands"
        type="website"
        keywords={['premium brands', 'cigarette brands', 'tobacco brands', 'luxury cigarettes']}
      />

      <div className="min-h-screen bg-creme">
        {/* Hero Section */}
        <div className="main-container">
          <div className="title-wrapper text-center py-16">
            <h1 className="main-title">Our Premium Brands</h1>
            <p className="text-dark/80 font-sans text-lg mt-4 max-w-2xl mx-auto">
              Discover our curated collection of world-renowned cigarette brands,
              each offering unique character and exceptional quality.
            </p>
          </div>
        </div>

        {/* Brands Grid */}
        <div className="main-container pb-16">
          {brands.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-16 h-16 mx-auto mb-4 text-coyote" />
              <h3 className="text-2xl font-serif text-dark mb-4">No brands available</h3>
              <p className="text-dark/80">We're working on bringing you premium brands soon.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {brands.map((brand, index) => (
                <motion.div
                  key={brand.name}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="group"
                >
                  <Link
                    to={`/brands/${brand.slug}`}
                    className="block bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group-hover:scale-105"
                  >
                    {/* Brand Logo/Image Placeholder */}
                    <div className="h-48 bg-gradient-to-br from-canyon/10 to-coyote/10 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-dark rounded-full flex items-center justify-center mx-auto mb-3">
                          <Star className="w-8 h-8 text-creme" />
                        </div>
                        <h3 className="text-2xl font-serif font-bold text-dark group-hover:text-canyon transition-colors">
                          {brand.name}
                        </h3>
                      </div>
                    </div>

                    {/* Brand Info */}
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-dark/60 font-sans">
                          {brand.product_count} product{brand.product_count !== 1 ? 's' : ''}
                        </span>
                        <ArrowRight className="w-5 h-5 text-canyon group-hover:translate-x-1 transition-transform" />
                      </div>

                      <p className="text-dark/80 font-sans text-sm">
                        Explore {brand.name}'s premium collection of cigarettes,
                        crafted with decades of expertise and tradition.
                      </p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Call to Action */}
        <div className="bg-dark text-creme py-16">
          <div className="main-container text-center">
            <h2 className="text-3xl font-serif font-bold mb-4">
              Looking for a Specific Brand?
            </h2>
            <p className="text-creme/80 mb-8 max-w-2xl mx-auto">
              Can't find your favorite brand? We're constantly expanding our collection
              with new premium brands and exclusive products.
            </p>
            <Link
              to="/products"
              className="inline-flex items-center gap-2 bg-canyon text-creme hover:bg-canyon/80 transition-colors px-8 py-3 rounded-full font-medium"
            >
              Browse All Products
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
