import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SEOHead } from '../../components/seo/SEOHead';
import { motion, AnimatePresence } from 'framer-motion';
import { useFullCatalog } from '../../hooks/data/useCatalog';
import { useStoreSettings } from '../../hooks/data/useStoreSettings';
import { useOrgInfo } from '../../lib/org/OrgContext';
import { useInlineStatus, InlineStatus } from '../../components/common/InlineStatus';
import { ProductCard } from '../../components/products/ProductCard';
import { Checkbox } from '../../components/ui/checkbox';
import { trackViewItemList } from '../../lib/analytics/ga';
import { ChevronDown, ChevronUp, Grid3X3, Grid2X2, ShoppingCart } from 'lucide-react';
import { useCart } from '../../hooks/useCart';
import { Product } from '../../hooks/useCart';
import { hubSeo, hubItemListJsonLd } from '../../lib/seo/hubSeo';
import { BreadcrumbSchema } from '../../components/seo/BreadcrumbSchema';

// Products hub (/products, classic theme). The page state lives in the URL, so
// the server render and the client's first render are the same tree:
//   ?category=<slug>[,<slug>]  category facet (multi)
//   ?brand=<slug>[,<slug>]     brand facet (multi)
//   ?price=<0-4>[,<0-4>]       price range index (multi, see PRICE_RANGES)
//   ?sort=name|price-low|price-high|newest   (default name)
//   ?q= (or the legacy ?search=)            search text
// Filter changes replace the history entry, so Back leaves the catalog.

const PRICE_RANGES = ['Under ₹500', '₹500 - ₹1000', '₹1000 - ₹2000', '₹2000 - ₹5000', 'Above ₹5000'];
const SORT_KEYS = ['name', 'price-low', 'price-high', 'newest'] as const;
type SortKey = (typeof SORT_KEYS)[number];

const FACET_PARAM: Record<string, string> = {
  categories: 'category',
  brands: 'brand',
  'price-range': 'price',
};

interface FacetItem {
  label: string;
  value: string;
}

interface FilterSection {
  id: string;
  name: string;
  items: FacetItem[];
}

function listParam(params: URLSearchParams, key: string): string[] {
  const raw = params.get(key);
  return raw ? raw.split(',').filter(Boolean) : [];
}

function priceInRange(price: number, index: number): boolean {
  switch (index) {
    case 0:
      return price < 500;
    case 1:
      return price >= 500 && price < 1000;
    case 2:
      return price >= 1000 && price < 2000;
    case 3:
      return price >= 2000 && price < 5000;
    case 4:
      return price >= 5000;
    default:
      return true;
  }
}

// Default-variant price (rupees): the is_default variant, else the first.
function defaultVariantOf(product: any): { price: number } | undefined {
  const variants: any[] = product.product_variants || [];
  return variants.find((v) => v.is_default) || variants[0];
}

function getProductPrice(product: Product): number {
  const variants = (product as any).product_variants as { price: number; is_default?: boolean }[] | undefined;
  if (variants && variants.length > 0) {
    const def = variants.find((v) => v.is_default) || variants[0];
    return def?.price ?? 0;
  }
  return (product as any).price ?? 0;
}

export function ProductsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { primaryHost } = useOrgInfo();
  const { settings: store } = useStoreSettings();
  const { addToCart, isLoading: cartLoading } = useCart();
  const { status: opStatus, setOk: setOpOk, setError: setOpError } = useInlineStatus();

  // Products + filter facets from the Convex catalog. Filtering is local.
  const {
    products: catalogProducts,
    brands: catalogBrands,
    categories: catalogCategories,
    loading: catalogLoading,
  } = useFullCatalog();

  // URL state. Read on every render, so the URL is the single source of truth.
  const params = new URLSearchParams(location.search);
  const q = (params.get('q') || params.get('search') || '').trim();
  const selCategories = listParam(params, 'category');
  const selBrands = listParam(params, 'brand');
  const selPriceRange = listParam(params, 'price').filter((v) => /^[0-4]$/.test(v));
  const sortParam = params.get('sort');
  const sortBy: SortKey = (SORT_KEYS as readonly string[]).includes(sortParam ?? '') ? (sortParam as SortKey) : 'name';

  // UI-only state (not part of the URL).
  const [viewMode, setViewMode] = useState<'grid' | 'two-col'>('grid');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Drag to dismiss states
  const [dragStartY, setDragStartY] = useState(0);
  const [dragCurrentY, setDragCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Filter sections from the catalog (sections without items are not shown).
  const filterSections: FilterSection[] = useMemo(() => {
    const categoryItems = (catalogCategories as any[]).map((c) => ({ label: c.name, value: c.slug }));
    const brandItems = (catalogBrands as any[])
      .filter((b) => b.isActive)
      .map((b) => ({ label: b.name, value: b.slug }));
    const priceItems = PRICE_RANGES.map((label, i) => ({ label, value: String(i) }));
    return [
      { id: 'categories', name: 'CATEGORIES', items: categoryItems },
      { id: 'brands', name: 'BRANDS', items: brandItems },
      { id: 'price-range', name: 'PRICE RANGE', items: priceItems },
    ].filter((section) => section.items.length > 0);
  }, [catalogCategories, catalogBrands]);

  const isExpanded = (sectionId: string) => expanded[sectionId] ?? sectionId === 'categories';

  const selectedFor = (sectionId: string): string[] => {
    switch (sectionId) {
      case 'categories':
        return selCategories;
      case 'brands':
        return selBrands;
      case 'price-range':
        return selPriceRange;
      default:
        return [];
    }
  };

  // Filter, sort and shape the catalog rows. Pure function of the catalog and the URL.
  const displayedProducts: Product[] = useMemo(() => {
    let list = (catalogProducts as any[]).filter((p) => p.is_active);

    if (q) {
      const needle = q.toLowerCase();
      list = list.filter(
        (p) =>
          String(p.name || '').toLowerCase().includes(needle) ||
          String(p.brand?.name || '').toLowerCase().includes(needle) ||
          String(p.description || '').toLowerCase().includes(needle),
      );
    }
    if (selCategories.length > 0) {
      const set = new Set(selCategories);
      list = list.filter((p) => (p.categories || []).some((c: any) => set.has(c.slug)));
    }
    if (selBrands.length > 0) {
      const set = new Set(selBrands);
      list = list.filter((p) => !!p.brand && set.has(p.brand.slug));
    }
    if (selPriceRange.length > 0) {
      list = list.filter((p) => {
        const price = Number(defaultVariantOf(p)?.price ?? 0);
        return selPriceRange.some((i) => priceInRange(price, Number(i)));
      });
    }

    // Newest first, then the chosen sort (stable, so ties keep this order).
    list = [...list].sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
    );
    const rows = list.map((product) => ({
      ...product,
      brand: product.brand ?? { id: 'unknown', name: 'Premium' },
      product_variants: (product.product_variants || []).map((variant: any) => ({
        ...variant,
        images: variant.images || [],
      })),
    })) as unknown as Product[];

    return rows.sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return getProductPrice(a) - getProductPrice(b);
        case 'price-high':
          return getProductPrice(b) - getProductPrice(a);
        case 'newest':
          return new Date((b as any).created_at || 0).getTime() - new Date((a as any).created_at || 0).getTime();
        default:
          return a.name.localeCompare(b.name);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogProducts, q, selCategories.join(','), selBrands.join(','), selPriceRange.join(','), sortBy]);

  const listName = q ? 'search_results' : 'all_products';

  // Writes the URL. Replaces the history entry: one filter tap is not a page view.
  const writeParams = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(location.search);
    mutate(next);
    const search = next.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true });
  };

  const handleAddToCart = async (product: Product) => {
    try {
      await addToCart(product, 1);
      setOpOk(`${product.name} added to cart!`);
    } catch (error) {
      setOpError('Failed to add to cart');
    }
  };

  const toggleFilterSection = (sectionId: string) => {
    setExpanded((prev) => ({ ...prev, [sectionId]: !isExpanded(sectionId) }));
  };

  const handleFilterChange = (sectionId: string, value: string, checked: boolean) => {
    const key = FACET_PARAM[sectionId];
    if (!key) return;
    const current = selectedFor(sectionId);
    const next = checked
      ? current.includes(value) ? current : [...current, value]
      : current.filter((item) => item !== value);
    writeParams((p) => {
      if (next.length > 0) p.set(key, next.join(','));
      else p.delete(key);
    });
  };

  const resetAllFilters = () => {
    writeParams((p) => {
      p.delete('category');
      p.delete('brand');
      p.delete('price');
    });
  };

  // Drag to dismiss handlers
  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragStartY(clientY);
    setDragCurrentY(clientY);
    setIsDragging(true);
  };

  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const diff = clientY - dragStartY;
    if (diff > 0) {
      setDragCurrentY(clientY);
    }
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    const diff = dragCurrentY - dragStartY;
    if (diff > 100) {
      setShowMobileFilters(false);
    }
    setIsDragging(false);
    setDragStartY(0);
    setDragCurrentY(0);
  };

  // GA4 view_item_list: once per distinct result set (refires on
  // filter/search change, not on every render).
  const listSentRef = useRef<string | null>(null);
  useEffect(() => {
    if (catalogLoading || displayedProducts.length === 0) return;
    const key = `${listName}:${displayedProducts.map((p) => p.id).join(',')}`;
    if (listSentRef.current === key) return;
    listSentRef.current = key;
    trackViewItemList(displayedProducts, listName);
  }, [displayedProducts, catalogLoading, listName]);

  if (catalogLoading) {
    return (
      <div className="min-h-screen bg-creme flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-dark"></div>
          <p className="text-dark mt-4 font-sans">Loading premium products...</p>
          <p className="text-dark/60 mt-2 font-sans text-sm">Connecting to database...</p>
        </div>
      </div>
    );
  }

  const seo = hubSeo('/products', store.name);
  const site = `https://${primaryHost}`;
  const activeFilterCount = selCategories.length + selBrands.length + selPriceRange.length;

  return (
    <>
      <SEOHead
        title={seo.title}
        titleVerbatim
        description={seo.description}
        url="/products"
        type="website"
        keywords={['premium cigarettes', 'buy cigarettes online', 'tobacco products', 'cigars online', 'cigarette shop', 'premium tobacco India']}
        robots={q ? 'noindex, follow' : undefined}
        forceCanonical
        extraJsonLd={[
          hubItemListJsonLd(
            seo.listName,
            displayedProducts.map((p) => ({ name: p.name, url: `${site}/product/${p.slug}` })),
          ),
        ]}
      />
      <BreadcrumbSchema items={[{ name: 'Home', url: `${site}/` }, { name: seo.crumb, url: `${site}/products` }]} />

      <div className="min-h-screen bg-background md:bg-creme pb-24 md:pb-16">
        {/* Mobile Header (one h1 per page: the desktop title below) */}
        <div className="md:hidden px-4 bg-background">
          <div className="text-center">
            <p className="medium-title leading-tight text-2xl sm:text-3xl lg:text-4xl xl:text-5xl">Products</p>
          </div>
        </div>

        {/* Desktop Title - Preserved */}
        <div className="hidden md:block main-container">
          <div className="title-wrapper text-center py-16">
            <h1 className="main-title">All our products</h1>
          </div>
        </div>

        {/* Desktop Product Count and View Options - Preserved */}
        <div className="hidden md:block main-container mb-8 pl-4">
          <div className="flex justify-between items-center">
            <button
              onClick={resetAllFilters}
              className="bg-dark text-creme-light hover:bg-canyon transition-all duration-300 font-medium text-sm uppercase tracking-wide px-4 py-2 rounded-full"
            >
              Show Everything
            </button>
            <div className="flex items-center gap-4">
              <span className="text-dark font-sans font-medium text-lg uppercase tracking-wide">VIEW</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${viewMode === 'grid' ? 'bg-dark text-creme-light' : 'bg-creme-light text-dark border border-coyote'}`}
                >
                  <Grid3X3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('two-col')}
                  className={`p-2 rounded ${viewMode === 'two-col' ? 'bg-dark text-creme-light' : 'bg-creme-light text-dark border border-coyote'}`}
                >
                  <Grid2X2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="main-container">
          {/* Mobile Filter Button */}
          <div className="lg:hidden mb-6 px-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMobileFilters(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-dark text-creme-light rounded-xl font-medium text-sm transition-all active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="px-2 py-0.5 bg-canyon text-creme-light rounded-full text-xs font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              <button
                onClick={resetAllFilters}
                className="px-4 py-3 bg-creme-light border border-coyote text-dark rounded-xl font-medium text-sm transition-all active:scale-95"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="flex gap-8">
            {/* Desktop Sidebar - Filters */}
            <div className="hidden lg:block w-72 flex-shrink-0 pl-4">
              <div className="space-y-0">
                {filterSections.map((section, index) => (
                  <div key={section.id} className={`${index > 0 ? 'border-t border-coyote/30 pt-4' : ''}`}>
                    <button
                      onClick={() => toggleFilterSection(section.id)}
                      className="flex items-center justify-between w-full text-left text-dark font-sans font-medium text-lg uppercase tracking-wide mb-2"
                    >
                      <span>{section.name}</span>
                      {isExpanded(section.id) ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>

                    {isExpanded(section.id) && (
                      <div className="space-y-1 pb-3">
                        {section.items.map((item, itemIndex) => {
                          const isChecked = selectedFor(section.id).includes(item.value);

                          return (
                            <label
                              key={itemIndex}
                              htmlFor={`${section.id}-${itemIndex}`}
                              className="flex items-center space-x-3 cursor-pointer hover:bg-creme/30 rounded-md p-1 -m-1 transition-colors"
                            >
                              <Checkbox
                                id={`${section.id}-${itemIndex}`}
                                checked={isChecked}
                                onCheckedChange={(checked: boolean) => handleFilterChange(section.id, item.value, !!checked)}
                                className="border-coyote/30 data-[state=checked]:bg-canyon data-[state=checked]:border-canyon"
                              />
                              <span className="text-dark font-sans text-base">
                                {item.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile Filter Drawer - World-Class Design */}
            {showMobileFilters && (
              <>
                {/* Backdrop */}
                <div
                  className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in"
                  onClick={() => setShowMobileFilters(false)}
                />

                {/* Drawer */}
                <div
                  className="lg:hidden fixed inset-x-0 bottom-0 z-50 bg-creme rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col animate-slide-up-smooth transition-transform duration-200"
                  style={{
                    transform: isDragging ? `translateY(${Math.max(0, dragCurrentY - dragStartY)}px)` : 'translateY(0)'
                  }}
                >
                  {/* Handle Bar - Draggable */}
                  <div
                    className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
                    onTouchStart={handleDragStart}
                    onTouchMove={handleDragMove}
                    onTouchEnd={handleDragEnd}
                    onMouseDown={handleDragStart}
                    onMouseMove={handleDragMove}
                    onMouseUp={handleDragEnd}
                    onMouseLeave={handleDragEnd}
                  >
                    <div className="w-12 h-1.5 bg-coyote/30 rounded-full" />
                  </div>

                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-coyote/20">
                    <div>
                      <h2 className="text-xl font-serif text-dark">Filters</h2>
                      <p className="text-sm text-dark/60 font-sans mt-0.5">
                        {activeFilterCount > 0
                          ? `${activeFilterCount} active`
                          : 'Select filters'}
                      </p>
                    </div>
                  </div>

                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-4">
                    <div className="space-y-6 pb-6">
                      {filterSections.map((section) => (
                        <div key={section.id} className="space-y-3">
                          <button
                            onClick={() => toggleFilterSection(section.id)}
                            className="flex items-center justify-between w-full text-left group"
                          >
                            <span className="text-base font-semibold text-dark uppercase tracking-wide">
                              {section.name}
                            </span>
                            <div className="flex items-center gap-2">
                              {selectedFor(section.id).length > 0 ? (
                                <span className="px-2 py-0.5 bg-canyon text-creme-light rounded-full text-xs font-bold">
                                  {selectedFor(section.id).length}
                                </span>
                              ) : null}
                              {isExpanded(section.id) ? (
                                <ChevronUp className="w-5 h-5 text-dark transition-transform" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-dark transition-transform" />
                              )}
                            </div>
                          </button>

                          {isExpanded(section.id) && (
                            <div className="space-y-2 pl-1">
                              {section.items.map((item, itemIndex) => {
                                const isChecked = selectedFor(section.id).includes(item.value);

                                return (
                                  <label
                                    key={itemIndex}
                                    htmlFor={`mobile-${section.id}-${itemIndex}`}
                                    className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                                      isChecked
                                        ? 'bg-canyon/10 border-2 border-canyon'
                                        : 'bg-creme-light border-2 border-transparent hover:border-coyote/30'
                                    }`}
                                  >
                                    <span className={`text-sm font-medium ${
                                      isChecked ? 'text-canyon' : 'text-dark'
                                    }`}>
                                      {item.label}
                                    </span>
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                      isChecked
                                        ? 'bg-canyon border-canyon'
                                        : 'border-coyote bg-white'
                                    }`}>
                                      {isChecked && (
                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </div>
                                    <input
                                      type="checkbox"
                                      id={`mobile-${section.id}-${itemIndex}`}
                                      checked={isChecked}
                                      onChange={(e) => handleFilterChange(section.id, item.value, e.target.checked)}
                                      className="sr-only"
                                    />
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex-shrink-0 px-6 py-4 border-t border-coyote/20 bg-creme/95 backdrop-blur-sm">
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          resetAllFilters();
                          setShowMobileFilters(false);
                        }}
                        className="flex-1 px-4 py-3 bg-creme-light border-2 border-coyote text-dark rounded-xl font-semibold text-sm transition-all active:scale-95"
                      >
                        Clear All
                      </button>
                      <button
                        onClick={() => setShowMobileFilters(false)}
                        className="flex-1 px-4 py-3 bg-dark text-creme-light rounded-xl font-semibold text-sm transition-all active:scale-95 shadow-lg"
                      >
                        Show {displayedProducts.length} Products
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Products Grid */}
            <div className="flex-1 relative">
              <div className="mb-4">
                <InlineStatus status={opStatus} />
              </div>

            {displayedProducts.length === 0 ? (
              <div className="text-center py-16">
                <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-coyote" />
                <h3 className="text-2xl font-serif text-dark mb-4">No products found</h3>
                <p className="text-dark/80 mb-8">We couldn't find any products matching your criteria.</p>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  className={`${viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6' : 'grid grid-cols-1 sm:grid-cols-2 gap-6'}`}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30 }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                  key={`products-${selCategories.join(',')}-${selBrands.join(',')}-${selPriceRange.join(',')}-${sortBy}-${q}`}
                >
                  {displayedProducts.map((product, index) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -30 }}
                      transition={{
                        duration: 0.4,
                        delay: index * 0.08,
                        ease: "easeInOut"
                      }}
                    >
                      <ProductCard
                        product={product}
                        variant="default"
                        onAddToCart={handleAddToCart}
                        isLoading={cartLoading}
                        index={index}
                        listName={listName}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
            )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
