import { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCategoryListing } from '../../hooks/data/useCatalog';
import { useStoreSettings } from '../../hooks/data/useStoreSettings';
import { useOrgInfo } from '../../lib/org/OrgContext';
import { ProductCard } from '../../components/products/ProductCard';
import { Button } from '../../components/ui/button';
import { Grid3X3, Grid2X2, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { Product, useCart } from '../../hooks/useCart';
import { trackViewItemList } from '../../lib/analytics/ga';
import { SEOHead } from '../../components/seo/SEOHead';
import { BreadcrumbNav } from '../../components/layout/BreadcrumbNav';
import { listingSeo } from '../../lib/seo/listingSeo';
import { useInlineStatus, InlineStatus } from '../../components/common/InlineStatus';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { RichText } from '../../components/RichText';

export interface CategoryPageProps {
  /** Set by the route: /category/:slug, and the category half of /category/:category/:brand. */
  categorySlug?: string;
  /** Set by the route for /category/:category/:brand. */
  brandSlug?: string;
}

// Category listing (classic theme). Derived state only: the rows come from
// useCategoryListing on the first render, so the server render is the full list
// (no effect-driven loading state).
export function CategoryPage({ categorySlug, brandSlug }: CategoryPageProps) {
  const location = useLocation();
  const [sortBy, setSortBy] = useState('name');
  const [viewMode, setViewMode] = useState<'grid' | 'two-col'>('grid');
  const [showMobileSort, setShowMobileSort] = useState(false);
  const { addToCart, isLoading: cartLoading } = useCart();
  const { status: opStatus, setError: setOpError, setOk: setOpOk } = useInlineStatus();
  const { primaryHost } = useOrgInfo();
  const { settings: store } = useStoreSettings();

  const listing = useCategoryListing(categorySlug, brandSlug);
  const isLoading = listing.status === 'loading';
  const category = listing.category;
  const brand = listing.brand;
  const products = useMemo(() => (listing.products ?? []) as unknown as Product[], [listing.products]);

  const sortedProducts = useMemo(() => {
    const sorted = [...products];
    switch (sortBy) {
      case 'price-low':
        return sorted.sort((a, b) => priceOf(a) - priceOf(b));
      case 'price-high':
        return sorted.sort((a, b) => priceOf(b) - priceOf(a));
      case 'newest':
        return sorted.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      default: // name
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [products, sortBy]);

  const seo = category
    ? listingSeo({ category, brand, products: sortedProducts, siteName: store.name, primaryHost })
    : null;
  const listName = brand ? `${category?.name ?? ''} ${brand.name}`.trim() : category?.name || 'category';

  // GA4 view_item_list: once per distinct result set.
  const listSentRef = useRef<string | null>(null);
  useEffect(() => {
    if (isLoading || sortedProducts.length === 0) return;
    const key = `${listName}:${sortedProducts.map((p) => p.id).join(',')}`;
    if (listSentRef.current === key) return;
    listSentRef.current = key;
    trackViewItemList(sortedProducts, listName);
  }, [sortedProducts, isLoading, listName]);

  const handleAddToCart = async (product: Product) => {
    try {
      await addToCart(product, 1);
      setOpOk(`${product.name} added to cart!`);
    } catch (error) {
      setOpError('Failed to add to cart');
    }
  };

  const sortOptions = [
    { label: 'Name (A-Z)', value: 'name' },
    { label: 'Price: Low to High', value: 'price-low' },
    { label: 'Price: High to Low', value: 'price-high' },
    { label: 'Newest First', value: 'newest' },
  ];

  if (isLoading || !seo) {
    return (
      <div className="min-h-screen bg-creme flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-dark"></div>
          <p className="text-dark mt-4 font-sans">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title={seo.title}
        titleVerbatim
        description={seo.description}
        url={location.pathname}
        type="website"
        keywords={[category?.name || 'tobacco products']}
        extraJsonLd={seo.extraJsonLd}
      />

      <div className="min-h-screen bg-creme pb-16">
        <BreadcrumbNav customBreadcrumbs={seo.visibleCrumbs} />

        {/* Header Section */}
        <div className="bg-creme-light border-b border-coyote/10">
          <div className="main-container py-12 md:py-20">
            <div className="text-center max-w-3xl mx-auto">
              <h1 className="font-serif text-3xl md:text-5xl text-dark mb-4">{seo.heading}</h1>
              {category?.description && (
                <RichText html={category.description} className="text-dark/70 font-sans text-base md:text-lg leading-relaxed" />
              )}
            </div>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="main-container px-4 md:px-8 py-6">
          <div className="mb-4">
            <InlineStatus status={opStatus} />
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            {/* Product Count */}
            <p className="text-dark/60 font-sans text-sm">
              {sortedProducts.length} {sortedProducts.length === 1 ? 'product' : 'products'}
            </p>

            {/* Sort & View Controls */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Mobile Sort Button */}
              <div className="sm:hidden flex-1">
                <Button
                  variant="outline"
                  onClick={() => setShowMobileSort(!showMobileSort)}
                  className="w-full h-11 justify-between border-coyote/30 bg-white"
                >
                  <span className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4" />
                    {sortOptions.find((o) => o.value === sortBy)?.label}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showMobileSort ? 'rotate-180' : ''}`} />
                </Button>
              </div>

              {/* Desktop Sort */}
              <div className="hidden sm:block">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[180px] h-10 bg-white border-coyote/30">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {sortOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* View Mode Toggle */}
              <div className="flex gap-1 bg-white border border-coyote/30 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded transition-colors ${viewMode === 'grid' ? 'bg-dark text-creme-light' : 'text-dark hover:bg-creme-light'}`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('two-col')}
                  className={`p-2 rounded transition-colors ${viewMode === 'two-col' ? 'bg-dark text-creme-light' : 'text-dark hover:bg-creme-light'}`}
                >
                  <Grid2X2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Sort Dropdown */}
          {showMobileSort && (
            <div className="sm:hidden mt-3 bg-white border border-coyote/20 rounded-xl overflow-hidden shadow-lg">
              {sortOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setSortBy(opt.value); setShowMobileSort(false); }}
                  className={`w-full px-4 py-3 text-left text-sm font-medium transition-colors ${sortBy === opt.value ? 'bg-canyon/10 text-canyon' : 'text-dark hover:bg-creme-light'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Products Grid */}
        <div className="main-container px-4 md:px-8">
          {sortedProducts.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-coyote/10">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-creme-light flex items-center justify-center">
                <X className="w-8 h-8 text-coyote" />
              </div>
              <h3 className="text-xl font-serif text-dark mb-2">No products found</h3>
              <p className="text-dark/60 font-sans mb-6">Try browsing all products or check back later.</p>
              <Link to="/products">
                <Button>Browse All Products</Button>
              </Link>
            </div>
          ) : (
            <div className={`grid gap-4 md:gap-6 ${
              viewMode === 'grid'
                ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                : 'grid-cols-1 md:grid-cols-2'
            }`}>
              {sortedProducts.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  variant="default"
                  onAddToCart={handleAddToCart}
                  isLoading={cartLoading}
                  index={index}
                  listName={listName}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function priceOf(p: Product): number {
  return p.product_variants?.find((v) => v.is_default)?.price || 0;
}
