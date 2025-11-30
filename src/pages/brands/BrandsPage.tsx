import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';
import { ArrowRight, Star, Package } from 'lucide-react';
import { SEOHead } from '../../components/seo/SEOHead';

interface Brand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  is_active: boolean;
  is_featured: boolean;
  product_count?: number;
}

export function BrandsPage() {
  const location = useLocation();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    try {
      setIsLoading(true);

      // Try cached API first
      try {
        const response = await fetch('/api/brands');
        if (response.ok) {
          const brandsData = await response.json();
          // Get product counts from cached products API
          const productsResponse = await fetch('/api/products');
          if (productsResponse.ok) {
            const products = await productsResponse.json();
            const brandsWithCounts = brandsData.map((brand: Brand) => ({
              ...brand,
              product_count: products.filter((p: any) => p.brand_id === brand.id).length
            }));
            const filteredBrands = brandsWithCounts
              .filter((b: Brand) => b.product_count && b.product_count > 0)
              .sort((a: Brand, b: Brand) => {
                if (a.is_featured && !b.is_featured) return -1;
                if (!a.is_featured && b.is_featured) return 1;
                return (b.product_count || 0) - (a.product_count || 0);
              });
            setBrands(filteredBrands);
            return;
          }
        }
      } catch (apiError) {
        console.log('API not available, using Supabase fallback');
      }

      // Fallback: Fetch brands from database
      const { data: brandsData, error: brandsError } = await supabase
        .from('brands')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (brandsError) throw brandsError;

      // Get product counts for each brand using brand_id
      const brandsWithCounts = await Promise.all(
        (brandsData || []).map(async (brand) => {
          const { count } = await supabase
            .from('products')
            .select('id', { count: 'exact' })
            .eq('brand_id', brand.id)
            .eq('is_active', true);

          return {
            ...brand,
            product_count: count || 0
          };
        })
      );

      // Filter out brands with no products and sort by featured, then product count
      const filteredBrands = brandsWithCounts
        .filter(b => b.product_count && b.product_count > 0)
        .sort((a, b) => {
          if (a.is_featured && !b.is_featured) return -1;
          if (!a.is_featured && b.is_featured) return 1;
          return b.product_count! - a.product_count!;
        });

      setBrands(filteredBrands);
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
        url={`https://cigarro.in${location.pathname}`}
        type="website"
        keywords={['premium brands', 'cigarette brands', 'tobacco brands', 'luxury cigarettes']}
      />

      <div className="min-h-screen bg-creme">
        {/* Hero Section */}
        <div className="main-container">
          <div className="text-center py-16">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="medium-title mb-6"
            >
              Our Premium Brands
            </motion.h1>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="w-24 h-1 bg-canyon mx-auto mb-6"
            ></motion.div>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-dark/70 font-sans text-lg max-w-2xl mx-auto leading-relaxed"
            >
              Discover our curated collection of world-renowned brands,
              each offering unique character and exceptional quality.
            </motion.p>
          </div>
        </div>

        {/* Brands Grid */}
        <div className="main-container pb-20">
          {brands.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <div className="bg-white rounded-2xl p-12 shadow-md border border-coyote/10 max-w-2xl mx-auto">
                <Package className="w-20 h-20 mx-auto mb-6 text-canyon/40" />
                <h3 className="text-3xl font-serif font-bold text-dark mb-4">No Brands Available</h3>
                <p className="text-dark/70 font-sans text-lg leading-relaxed">
                  We're working on bringing you premium brands soon.
                </p>
              </div>
            </motion.div>
          ) : (
            <div className="grid grid-cols-2 gap-8">
              {brands.map((brand, index) => (
                <motion.div
                  key={brand.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                >
                  <Link
                    to={`/brand/${brand.slug}`}
                    className="block bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-500 overflow-hidden group h-full"
                  >
                    {/* Brand Logo */}
                    <div className="aspect-[3/2] bg-creme-light flex items-center justify-center p-8 relative overflow-hidden">
                      {brand.logo_url ? (
                        <img
                          src={brand.logo_url}
                          alt={brand.name}
                          className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
                        />
                      ) : (
                        <div className="text-center">
                          <span className="text-6xl font-serif font-bold text-canyon/80">
                            {brand.name.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                      )}
                      {brand.is_featured && (
                        <div className="absolute top-4 right-4 bg-canyon text-creme-light px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide">
                          Featured
                        </div>
                      )}
                    </div>

                    {/* Brand Info */}
                    <div className="p-6">
                      <h3 className="text-xl font-serif font-bold text-dark group-hover:text-canyon transition-colors mb-2">
                        {brand.name}
                      </h3>
                      
                      {brand.description && (
                        <p className="text-dark/70 font-sans text-sm leading-relaxed mb-4 line-clamp-2">
                          {brand.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-dark/60 font-sans">
                          {brand.product_count} product{brand.product_count !== 1 ? 's' : ''}
                        </span>
                        <ArrowRight className="w-5 h-5 text-canyon group-hover:translate-x-2 transition-transform duration-300" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Call to Action */}
        <div className="bg-dark text-creme-light py-20">
          <div className="main-container text-center">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-4xl font-serif font-bold mb-4"
            >
              Looking for a Specific Brand?
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-creme-light/80 font-sans text-lg mb-8 max-w-2xl mx-auto leading-relaxed"
            >
              Can't find your favorite brand? We're constantly expanding our collection
              with new premium brands and exclusive products.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <Link
                to="/products"
                className="inline-flex items-center gap-2 bg-canyon text-creme-light hover:bg-canyon/80 transition-all duration-300 px-8 py-3 rounded-full font-medium uppercase tracking-wide text-sm shadow-lg hover:shadow-xl"
              >
                Browse All Products
                <ArrowRight className="w-5 h-5" />
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
}
