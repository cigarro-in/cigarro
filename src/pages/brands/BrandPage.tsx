import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { SEOHead } from '../../components/seo/SEOHead';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, ExternalLink, Package, Calendar, MapPin, User } from 'lucide-react';
import { ProductCard } from '../../components/products/ProductCard';
import { useCart, Product } from '../../hooks/useCart';

interface Brand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  meta_title: string | null;
  meta_description: string | null;
  heritage: {
    founded_year?: string;
    origin_country?: string;
    founder?: string;
    story?: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export function BrandPage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { addToCart, isLoading: cartLoading } = useCart();

  useEffect(() => {
    if (slug) {
      fetchBrandData();
    }
  }, [slug]);

  const fetchBrandData = async () => {
    try {
      setIsLoading(true);

      // Fetch brand from database
      const { data: brandData, error: brandError } = await supabase
        .from('brands')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (brandError) {
        console.error('Brand not found:', brandError);
        setBrand(null);
        setIsLoading(false);
        return;
      }

      setBrand(brandData);

      // Fetch brand products using brand_id
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          id, name, slug, brand_id, description, is_active, created_at,
          brand:brands(id, name),
          product_variants(id, variant_name, price, is_default, is_active, images)
        `)
        .eq('brand_id', brandData.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (productsError) throw productsError;

      const normalizedProducts = (productsData || []).map((p: any) => ({
        ...p,
        brand: Array.isArray(p.brand) ? p.brand[0] : p.brand
      }));

      setProducts(normalizedProducts as Product[]);
    } catch (error) {
      console.error('Error fetching brand data:', error);
      toast.error('Failed to load brand information');
    } finally {
      setIsLoading(false);
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-creme flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-dark"></div>
          <p className="text-dark mt-4 font-sans">Loading brand information...</p>
        </div>
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="min-h-screen bg-creme flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 mx-auto mb-4 text-coyote" />
          <h3 className="text-2xl font-serif text-dark mb-4">Brand not found</h3>
          <p className="text-dark/80 mb-8">The brand you're looking for doesn't exist.</p>
          <Link
            to="/brands"
            className="inline-flex items-center gap-2 bg-dark text-creme hover:bg-canyon transition-colors px-6 py-3 rounded-full font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Brands
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title={brand.meta_title || `${brand.name} - Premium Cigarettes | Cigarro`}
        description={brand.meta_description || `${brand.name} premium cigarettes and tobacco products. Discover our exclusive collection from ${brand.name}.`}
        url={`https://cigarro.in${location.pathname}`}
        type="website"
        brand={brand.name}
        keywords={[brand.name, 'premium cigarettes', 'tobacco products', `${brand.name} cigarettes`, 'authentic tobacco']}
      />

      <div className="min-h-screen bg-creme">
        {/* Back Navigation */}
        <div className="main-container py-4">
          <Link
            to="/brands"
            className="inline-flex items-center gap-2 text-dark hover:text-canyon transition-colors font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to All Brands
          </Link>
        </div>

        {/* Brand Hero Section - Elegant Full Width */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="relative bg-creme-light border-b border-coyote/20"
        >
          <div className="main-container py-20">
            <div className="max-w-5xl mx-auto">
              {/* Brand Logo */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="flex justify-center mb-8"
              >
                {brand.logo_url ? (
                  <div className="w-40 h-40 bg-white rounded-2xl shadow-lg p-6 flex items-center justify-center">
                    <img
                      src={brand.logo_url}
                      alt={brand.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-40 h-40 bg-white rounded-2xl shadow-lg flex items-center justify-center">
                    <span className="text-6xl font-serif font-bold text-canyon">
                      {brand.name.substring(0, 1)}
                    </span>
                  </div>
                )}
              </motion.div>

              {/* Brand Name */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="medium-title text-center mb-6"
              >
                {brand.name}
              </motion.h1>

              {/* Heritage Info */}
              {brand.heritage && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                  className="flex flex-wrap items-center justify-center gap-6 mb-8 text-dark/70"
                >
                  {brand.heritage.founded_year && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-canyon" />
                      <span className="font-sans text-sm">Est. {brand.heritage.founded_year}</span>
                    </div>
                  )}
                  {brand.heritage.origin_country && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-canyon" />
                      <span className="font-sans text-sm">{brand.heritage.origin_country}</span>
                    </div>
                  )}
                  {brand.heritage.founder && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-canyon" />
                      <span className="font-sans text-sm">Founded by {brand.heritage.founder}</span>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Brand Description */}
              {brand.description && (
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.6 }}
                  className="text-dark/80 font-sans text-lg md:text-xl leading-relaxed text-center max-w-3xl mx-auto mb-8"
                >
                  {brand.description}
                </motion.p>
              )}

              {/* Brand Story */}
              {brand.heritage?.story && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.6 }}
                  className="bg-white rounded-2xl p-8 shadow-md border border-coyote/10 mb-8"
                >
                  <h3 className="text-2xl font-serif font-bold text-dark mb-4 text-center">Our Heritage</h3>
                  <p className="text-dark/70 font-sans leading-relaxed text-center">
                    {brand.heritage.story}
                  </p>
                </motion.div>
              )}

              {/* Website Link & Stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.6 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-6"
              >
                {brand.website_url && (
                  <a
                    href={brand.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-dark text-creme-light hover:bg-canyon transition-all duration-300 px-8 py-3 rounded-full font-medium uppercase tracking-wide text-sm shadow-lg hover:shadow-xl"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Visit Official Website
                  </a>
                )}
                <div className="flex items-center gap-2 text-dark/60">
                  <Package className="w-5 h-5 text-canyon" />
                  <span className="font-sans text-sm">{products.length} Products Available</span>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Products Section */}
        <div className="main-container py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-dark mb-6">
              {brand.name} Collection
            </h2>
            <div className="w-24 h-1 bg-canyon mx-auto mb-6"></div>
            <p className="text-dark/70 font-sans text-lg max-w-2xl mx-auto leading-relaxed">
              Explore our curated selection of {brand.name} premium products,
              each crafted with exceptional attention to quality and flavor.
            </p>
          </motion.div>

          {products.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <div className="bg-white rounded-2xl p-12 shadow-md border border-coyote/10 max-w-2xl mx-auto">
                <Package className="w-20 h-20 mx-auto mb-6 text-canyon/40" />
                <h3 className="text-3xl font-serif font-bold text-dark mb-4">Coming Soon</h3>
                <p className="text-dark/70 font-sans text-lg mb-8 leading-relaxed">
                  We're working on bringing you {brand.name} products soon.
                  Check back later for our exclusive collection.
                </p>
                <Link
                  to="/products"
                  className="inline-flex items-center gap-2 bg-dark text-creme-light hover:bg-canyon transition-all duration-300 px-8 py-3 rounded-full font-medium uppercase tracking-wide text-sm shadow-lg hover:shadow-xl"
                >
                  Browse All Products
                  <ArrowLeft className="w-4 h-4 rotate-180" />
                </Link>
              </div>
            </motion.div>
          ) : (
            <div className="grid grid-cols-2 gap-6">
              {products.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                >
                  <ProductCard
                    product={product}
                    variant="default"
                    onAddToCart={handleAddToCart}
                    isLoading={cartLoading}
                    index={index}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
