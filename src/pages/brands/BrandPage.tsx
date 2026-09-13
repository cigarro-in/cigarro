import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { SEOHead } from '../../components/seo/SEOHead';
import { useFullCatalog } from '../../hooks/data/useCatalog';
import { toast } from 'sonner';
import { ArrowLeft, ExternalLink, Package, Calendar, MapPin, User, Globe } from 'lucide-react';
import { ProductCard } from '../../components/products/ProductCard';
import { useCart, Product } from '../../hooks/useCart';
import { Button } from '../../components/ui/button';

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
  // Wave 3: brand + products resolve from the Convex catalog (same shapes
  // the Supabase fallback produced). No API-hop, no Supabase.
  const { products: catalogProducts, brands: catalogBrands, loading: catalogLoading } =
    useFullCatalog();

  useEffect(() => {
    if (!slug || catalogLoading) return;
    try {
      setIsLoading(true);
      const brandData = (catalogBrands as any[]).find(
        (b: any) => b.slug === slug && b.isActive,
      );
      if (!brandData) {
        setBrand(null);
        setIsLoading(false);
        return;
      }
      setBrand({
        id: brandData.supabaseId,
        name: brandData.name,
        slug: brandData.slug,
        description: brandData.description ?? null,
        logo_url: brandData.logoUrl ?? null,
        website_url: brandData.websiteUrl ?? null,
        is_active: brandData.isActive,
        is_featured: false,
        sort_order: brandData.sortOrder ?? 0,
        meta_title: brandData.metaTitle ?? null,
        meta_description: brandData.metaDescription ?? null,
        heritage: brandData.heritage ?? null,
        created_at: brandData.createdAt
          ? new Date(brandData.createdAt).toISOString()
          : '',
        updated_at: brandData.updatedAt
          ? new Date(brandData.updatedAt).toISOString()
          : '',
      });
      setProducts(
        catalogProducts
          .filter((p: any) => p.brand_id === brandData.supabaseId && p.is_active)
          .sort(
            (a: any, b: any) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          ) as Product[],
      );
    } catch (error) {
      console.error('Error fetching brand data:', error);
      toast.error('Failed to load brand information');
    } finally {
      setIsLoading(false);
    }
  }, [slug, catalogLoading]);

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
          <Link to="/brands">
            <Button variant="outline">Back to Brands</Button>
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
        {/* Hero Section */}
        <div className="bg-creme-light border-b border-coyote/10">
          <div className="main-container">
            {/* Back Navigation */}
            <div className="pt-6">
              <Link
                to="/brands"
                className="inline-flex items-center gap-2 text-dark/60 hover:text-dark transition-colors font-sans text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                All Brands
              </Link>
            </div>

            {/* Brand Info */}
            <div className="py-12 md:py-20">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-12">
                {/* Logo */}
                {brand.logo_url ? (
                  <div className="w-28 h-28 md:w-36 md:h-36 bg-white rounded-2xl shadow-sm p-5 flex-shrink-0 flex items-center justify-center border border-coyote/20">
                    <img src={brand.logo_url} alt={brand.name} className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-28 h-28 md:w-36 md:h-36 bg-white rounded-2xl shadow-sm flex-shrink-0 flex items-center justify-center border border-coyote/20">
                    <span className="text-5xl font-serif font-bold text-canyon">{brand.name.charAt(0)}</span>
                  </div>
                )}

                {/* Details */}
                <div className="flex-1 text-center md:text-left">
                  <h1 className="font-serif text-4xl md:text-5xl text-dark mb-4">
                    {brand.name}
                  </h1>

                  {/* Heritage Tags */}
                  {brand.heritage && (
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-6">
                      {brand.heritage.founded_year && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-xs font-medium text-dark/70 border border-coyote/20">
                          <Calendar className="w-3.5 h-3.5 text-canyon" />
                          Est. {brand.heritage.founded_year}
                        </span>
                      )}
                      {brand.heritage.origin_country && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-xs font-medium text-dark/70 border border-coyote/20">
                          <MapPin className="w-3.5 h-3.5 text-canyon" />
                          {brand.heritage.origin_country}
                        </span>
                      )}
                      {brand.heritage.founder && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-xs font-medium text-dark/70 border border-coyote/20">
                          <User className="w-3.5 h-3.5 text-canyon" />
                          {brand.heritage.founder}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Description */}
                  {brand.description && (
                    <p className="text-dark/70 font-sans text-base md:text-lg leading-relaxed max-w-2xl mb-6">
                      {brand.description}
                    </p>
                  )}

                  {/* Website Link */}
                  {brand.website_url && (
                    <a
                      href={brand.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-canyon hover:text-dark transition-colors"
                    >
                      <Globe className="w-4 h-4" />
                      Official Website
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Story Section */}
        {brand.heritage?.story && (
          <div className="bg-white border-b border-coyote/10">
            <div className="main-container py-12 md:py-16">
              <div className="max-w-3xl mx-auto">
                <h2 className="font-serif text-xl text-canyon mb-4 text-center">Our Heritage</h2>
                <p className="text-dark/70 font-sans text-base leading-relaxed text-center">
                  {brand.heritage.story}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Products Section */}
        <div className="main-container py-12 md:py-16">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-serif text-dark">{brand.name} Products</h2>
              <p className="text-dark/60 font-sans text-sm mt-1">
                {products.length} {products.length === 1 ? 'product' : 'products'} available
              </p>
            </div>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-16 bg-creme-light rounded-2xl border border-coyote/10">
              <Package className="w-12 h-12 mx-auto mb-4 text-coyote" />
              <h3 className="text-lg font-serif text-dark mb-2">Coming Soon</h3>
              <p className="text-dark/60 font-sans text-sm mb-6">We're curating the finest {brand.name} products.</p>
              <Link to="/products">
                <Button variant="outline">Browse All Products</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {products.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  variant="default"
                  onAddToCart={handleAddToCart}
                  isLoading={cartLoading}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
