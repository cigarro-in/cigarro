import { useMemo, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SEOHead } from '../../components/seo/SEOHead';
import { BreadcrumbNav } from '../../components/layout/BreadcrumbNav';
import { useBrandDetail } from '../../hooks/data/useCatalog';
import { useInlineStatus, InlineStatus } from '../../components/common/InlineStatus';
import { ArrowLeft, ExternalLink, Package, Calendar, MapPin, User, Globe } from 'lucide-react';
import { ProductCard } from '../../components/products/ProductCard';
import { useCart, Product } from '../../hooks/useCart';
import { trackViewItemList } from '../../lib/analytics/ga';
import { Button } from '../../components/ui/button';
import { useStoreSettings } from '../../hooks/data/useStoreSettings';
import { useOrgInfo } from '../../lib/org/OrgContext';
import { brandSeo } from '../../lib/seo/listingSeo';

export interface BrandPageProps {
  /** Set by the route (/brand/:slug). */
  brandSlug?: string;
}

// Brand page (classic). Derived state only: brand and rows come from
// useBrandDetail on the first render, so the server render is the full page.
export function BrandPage({ brandSlug }: BrandPageProps) {
  const location = useLocation();
  const { settings: store } = useStoreSettings();
  const { primaryHost } = useOrgInfo();
  const { addToCart, isLoading: cartLoading } = useCart();
  const { status: opStatus, setError: setOpError, setOk: setOpOk } = useInlineStatus();
  const detail = useBrandDetail(brandSlug);
  const brand = detail.brand;
  const products = useMemo(() => (detail.products ?? []) as unknown as Product[], [detail.products]);
  const isLoading = detail.status === 'loading';

  const seo = brand
    ? brandSeo({ brand, products, siteName: store.name, primaryHost })
    : null;

  const handleAddToCart = async (product: Product) => {
    try {
      await addToCart(product, 1);
      setOpOk(`${product.name} added to cart!`);
    } catch (error) {
      setOpError('Failed to add to cart');
    }
  };

  // GA4 view_item_list: once per distinct brand result set.
  const listSentRef = useRef<string | null>(null);
  useEffect(() => {
    if (isLoading || !brand || products.length === 0) return;
    const key = `brand:${brand.slug}:${products.map((p) => p.id).join(',')}`;
    if (listSentRef.current === key) return;
    listSentRef.current = key;
    trackViewItemList(products, brand.name);
  }, [products, brand, isLoading]);

  if (isLoading || !brand || !seo) {
    return (
      <div className="min-h-screen bg-creme flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-dark"></div>
          <p className="text-dark mt-4 font-sans">Loading brand information...</p>
        </div>
      </div>
    );
  }

  const heritage = brand.heritage as {
    founded_year?: string;
    origin_country?: string;
    founder?: string;
    story?: string;
  } | null;

  return (
    <>
      <SEOHead
        title={seo.title}
        titleVerbatim
        description={seo.description}
        url={location.pathname}
        type="website"
        brand={brand.name}
        keywords={[brand.name, 'premium cigarettes', 'tobacco products', `${brand.name} cigarettes`, 'authentic tobacco']}
        extraJsonLd={seo.extraJsonLd}
      />

      <div className="min-h-screen bg-creme">
        <BreadcrumbNav customBreadcrumbs={seo.visibleCrumbs} />

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
                {brand.logoUrl ? (
                  <div className="w-28 h-28 md:w-36 md:h-36 bg-white rounded-2xl shadow-sm p-5 flex-shrink-0 flex items-center justify-center border border-coyote/20">
                    <img src={brand.logoUrl} alt={brand.name} className="w-full h-full object-contain" />
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
                  {heritage && (
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-6">
                      {heritage.founded_year && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-xs font-medium text-dark/70 border border-coyote/20">
                          <Calendar className="w-3.5 h-3.5 text-canyon" />
                          Est. {heritage.founded_year}
                        </span>
                      )}
                      {heritage.origin_country && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-xs font-medium text-dark/70 border border-coyote/20">
                          <MapPin className="w-3.5 h-3.5 text-canyon" />
                          {heritage.origin_country}
                        </span>
                      )}
                      {heritage.founder && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-xs font-medium text-dark/70 border border-coyote/20">
                          <User className="w-3.5 h-3.5 text-canyon" />
                          {heritage.founder}
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
                  {brand.websiteUrl && (
                    <a
                      href={brand.websiteUrl}
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
        {heritage?.story && (
          <div className="bg-white border-b border-coyote/10">
            <div className="main-container py-12 md:py-16">
              <div className="max-w-3xl mx-auto">
                <h2 className="font-serif text-xl text-canyon mb-4 text-center">Our Heritage</h2>
                <p className="text-dark/70 font-sans text-base leading-relaxed text-center">
                  {heritage.story}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Products Section */}
        <div className="main-container py-12 md:py-16">
          <div className="mb-6">
            <InlineStatus status={opStatus} />
          </div>
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
                  listName={brand.name}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
