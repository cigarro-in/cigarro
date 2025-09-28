import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { supabase } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Star, Package, ShoppingCart } from 'lucide-react';
import { ProductCard } from '../../components/products/ProductCard';
import { useCart } from '../../hooks/useCart';

interface Brand {
  name: string;
  description?: string;
  logo_url?: string;
  established_year?: number;
  origin_country?: string;
  website?: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  brand: string;
  price: number;
  description: string;
  is_active: boolean;
  gallery_images: string[];
  rating: number;
  review_count: number;
  created_at?: string;
}

export function BrandPage() {
  const { slug } = useParams<{ slug: string }>();
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

      // Get brand name from slug
      const brandName = slug?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || '';

      // Fetch brand products
      const { data: productsData, error } = await supabase
        .from('products')
        .select(`
          id, name, slug, brand, price, description, is_active, gallery_images, rating, review_count, created_at
        `)
        .eq('brand', brandName)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProducts(productsData || []);

      // Set brand info (you can expand this with a brands table later)
      setBrand({
        name: brandName,
        description: `${brandName} has been a trusted name in premium tobacco products for decades, offering exceptional quality and distinctive flavor profiles that cater to discerning smokers worldwide.`,
        established_year: 1950 + Math.floor(Math.random() * 70), // Mock data
        origin_country: 'Various',
        website: `https://${brandName.toLowerCase().replace(/\s+/g, '')}.com`
      });
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
      <Helmet>
        <title>{brand.name} - Premium Cigarettes | Cigarro</title>
        <meta name="description" content={`${brand.name} premium cigarettes and tobacco products. Discover our exclusive collection from ${brand.name}.`} />
      </Helmet>

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

        {/* Brand Hero Section */}
        <div className="bg-white shadow-sm">
          <div className="main-container py-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Brand Logo and Info */}
              <div className="text-center lg:text-left">
                <div className="w-32 h-32 bg-gradient-to-br from-canyon to-coyote rounded-full flex items-center justify-center mx-auto lg:mx-0 mb-6">
                  <Star className="w-16 h-16 text-creme" />
                </div>

                <h1 className="text-4xl lg:text-5xl font-serif font-bold text-dark mb-4">
                  {brand.name}
                </h1>

                <div className="flex items-center justify-center lg:justify-start gap-4 mb-6 text-dark/60">
                  <span className="font-sans">{brand.established_year}</span>
                  <span className="w-1 h-1 bg-coyote rounded-full"></span>
                  <span className="font-sans">{brand.origin_country}</span>
                  <span className="w-1 h-1 bg-coyote rounded-full"></span>
                  <span className="font-sans">{products.length} products</span>
                </div>

                <p className="text-dark/80 font-sans text-lg leading-relaxed mb-8">
                  {brand.description}
                </p>

                {brand.website && (
                  <a
                    href={brand.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-canyon hover:text-canyon/80 transition-colors font-medium"
                  >
                    Visit Official Website
                    <ArrowLeft className="w-5 h-5 rotate-45" />
                  </a>
                )}
              </div>

              {/* Brand Stats */}
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-creme p-6 rounded-lg text-center">
                  <Package className="w-8 h-8 text-canyon mx-auto mb-3" />
                  <div className="text-2xl font-bold text-dark">{products.length}</div>
                  <div className="text-dark/60 font-sans">Products</div>
                </div>

                <div className="bg-creme p-6 rounded-lg text-center">
                  <Star className="w-8 h-8 text-canyon mx-auto mb-3" />
                  <div className="text-2xl font-bold text-dark">
                    {products.length > 0 ? (products.reduce((sum, p) => sum + p.rating, 0) / products.length).toFixed(1) : '5.0'}
                  </div>
                  <div className="text-dark/60 font-sans">Avg Rating</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Products Section */}
        <div className="main-container py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-serif font-bold text-dark mb-4">
              {brand.name} Collection
            </h2>
            <p className="text-dark/80 font-sans max-w-2xl mx-auto">
              Explore our curated selection of {brand.name} premium cigarettes,
              each crafted with exceptional attention to quality and flavor.
            </p>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-16 h-16 mx-auto mb-4 text-coyote" />
              <h3 className="text-2xl font-serif text-dark mb-4">No products available</h3>
              <p className="text-dark/80 mb-8">We're working on bringing you {brand.name} products soon.</p>
              <Link
                to="/products"
                className="inline-flex items-center gap-2 bg-dark text-creme hover:bg-canyon transition-colors px-6 py-3 rounded-full font-medium"
              >
                Browse All Products
                <ShoppingCart className="w-5 h-5" />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
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
