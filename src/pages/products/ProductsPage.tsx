import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { cache, cacheHelpers, CACHE_KEYS, CACHE_DURATION } from '../../utils/cache';
import { ProductCard } from '../../components/products/ProductCard';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { Heart, ShoppingCart, Star, ChevronDown, ChevronUp, Grid3X3, Grid2X2, Search } from 'lucide-react';
import { useCart } from '../../hooks/useCart';
import { useWishlist } from '../../hooks/useWishlist';
import { formatINR } from '../../utils/currency';
import { Product } from '../../hooks/useCart';

interface FilterSection {
  id: string;
  name: string;
  items: string[];
  isExpanded: boolean;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Brand {
  brand: string;
  count: number;
}

export function ProductsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('name');
  const [viewMode, setViewMode] = useState<'grid' | 'two-col'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [origins, setOrigins] = useState<string[]>([]);
  const [strengths, setStrengths] = useState<string[]>([]);
  const [packSizes, setPackSizes] = useState<string[]>([]);
  
  // Filter states
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedOrigins, setSelectedOrigins] = useState<string[]>([]);
  const [selectedStrengths, setSelectedStrengths] = useState<string[]>([]);
  const [selectedPackSizes, setSelectedPackSizes] = useState<string[]>([]);
  const [selectedPriceRange, setSelectedPriceRange] = useState<string[]>([]);
  
  // Loading states
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  
  const { addToCart, isLoading: cartLoading } = useCart();

  const productsPerPage = 12;
  
  // Dynamic filter sections based on database data
  const [filterSections, setFilterSections] = useState<FilterSection[]>([]);

  // Get search query from URL parameters
  const searchParams = new URLSearchParams(location.search);
  const urlSearchQuery = searchParams.get('search') || '';

  useEffect(() => {
    const loadData = async () => {
      try {
        // Test database connection first
        // Skip DB connection test if we have cached data
        const hasCachedData = cacheHelpers.getFilterData() !== null;
        if (!hasCachedData) {
          console.log('Testing database connection...');
          const { data: testData, error: testError } = await supabase
            .from('products')
            .select('id')
            .limit(1);
          
          if (testError) {
            console.error('Database connection failed:', testError);
            toast.error('Database connection failed. Please check your configuration.');
            setIsLoading(false);
            return;
          }
          
          console.log('Database connection successful');
        }
        await Promise.all([fetchProducts(), fetchFilterData()]);
      } catch (error) {
        console.error('Error loading data:', error);
        setIsLoading(false);
      }
    };
    
    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        console.error('Loading timeout - setting loading to false');
        setIsLoading(false);
        toast.error('Loading timeout. Please refresh the page.');
      }
    }, 10000); // 10 second timeout
    
    loadData();
    
    return () => clearTimeout(timeoutId);
  }, [urlSearchQuery]);

  // Refetch products when filters change (with debounce)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchProducts();
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [selectedCategories, selectedBrands, selectedOrigins, selectedStrengths, selectedPackSizes, selectedPriceRange]);

  // Update filter sections when data is loaded (preserve expanded state) - Matching Luminaire Authentik structure
  useEffect(() => {
    const sections: FilterSection[] = [
      {
        id: 'categories',
        name: 'CATEGORIES',
        items: categories.map(c => c.name),
        isExpanded: filterSections.find(s => s.id === 'categories')?.isExpanded ?? true
      },
      {
        id: 'brands',
        name: 'BRANDS',
        items: brands.map(b => b.brand),
        isExpanded: filterSections.find(s => s.id === 'brands')?.isExpanded ?? false
      },
      {
        id: 'origins',
        name: 'ORIGINS',
        items: origins,
        isExpanded: filterSections.find(s => s.id === 'origins')?.isExpanded ?? false
      },
      {
        id: 'strengths',
        name: 'STRENGTHS',
        items: strengths,
        isExpanded: filterSections.find(s => s.id === 'strengths')?.isExpanded ?? false
      },
      {
        id: 'pack-sizes',
        name: 'PACK SIZES',
        items: packSizes,
        isExpanded: filterSections.find(s => s.id === 'pack-sizes')?.isExpanded ?? false
      },
      {
        id: 'price-range',
        name: 'PRICE RANGE',
        items: ['Under ₹500', '₹500 - ₹1000', '₹1000 - ₹2000', '₹2000 - ₹5000', 'Above ₹5000'],
        isExpanded: filterSections.find(s => s.id === 'price-range')?.isExpanded ?? false
      }
    ].filter(section => section.items.length > 0); // Only show sections with items
    
    setFilterSections(sections);
  }, [categories, brands, origins, strengths, packSizes]);


  const fetchFilterData = async () => {
    try {
      // Check cache first
      const cachedFilterData = cacheHelpers.getFilterData();
      if (cachedFilterData) {
        console.log('Using cached filter data');
        setCategories(cachedFilterData.categories || []);
        setBrands(cachedFilterData.brands || []);
        setOrigins(cachedFilterData.origins || []);
        setStrengths(cachedFilterData.strengths || []);
        setPackSizes(cachedFilterData.packSizes || []);
        return;
      }

      console.log('Fetching filter data...');
      
      // Fetch all filter data in parallel
      const [categoriesResult, brandsResult] = await Promise.all([
        supabase.from('categories').select('id, name, slug').order('name'),
        supabase.from('products').select('brand').eq('is_active', true)
      ]);

      const categoriesData = categoriesResult.data || [];
      const brandsData = brandsResult.data || [];
      
      if (brandsData) {
        const brandCounts = brandsData.reduce((acc: Record<string, number>, product) => {
          acc[product.brand] = (acc[product.brand] || 0) + 1;
          return acc;
        }, {});
        
        const brandsWithCounts = Object.entries(brandCounts)
          .map(([brand, count]) => ({ brand, count }))
          .sort((a, b) => a.brand.localeCompare(b.brand));
        
        setBrands(brandsWithCounts);
      }

      // Fetch unique origins
      const { data: originsData } = await supabase
        .from('products')
        .select('id')
        .eq('is_active', true)
        .limit(1); // Just check if table exists
      
      if (originsData) {
        // No origins filter available
        setOrigins([]);
      }

      // Fetch unique strengths
      const { data: strengthsData } = await supabase
        .from('products')
        .select('id')
        .eq('is_active', true)
        .limit(1); // Just check if table exists
      
      if (strengthsData) {
        // No strength filter available
        setStrengths([]);
      }

      // Fetch unique pack sizes
      const { data: packSizesData } = await supabase
        .from('products')
        .select('id')
        .eq('is_active', true)
        .limit(1); // Just check if table exists
      
      if (packSizesData) {
        // No pack size filter available
        setPackSizes([]);
      }
    } catch (error) {
      console.error('Error fetching filter data:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      let query = supabase
        .from('products')
        .select(`
          id, name, slug, brand, price, description, is_active, gallery_images, rating, review_count, created_at,
          categories (name)
        `)
        .eq('is_active', true);

      // Apply search filter
      if (urlSearchQuery.trim()) {
        query = query.or(`name.ilike.%${urlSearchQuery}%,brand.ilike.%${urlSearchQuery}%,description.ilike.%${urlSearchQuery}%`);
      }

      // Apply category filter
      if (selectedCategories.length > 0) {
        // For categories with nested relationships, we need to use the correct syntax
        query = query.in('categories.name', selectedCategories);
      }

      // Apply brand filter
      if (selectedBrands.length > 0) {
        query = query.in('brand', selectedBrands);
      }

      // Apply price range filter
      if (selectedPriceRange.length > 0) {
        const priceConditions = selectedPriceRange.map(range => {
          switch (range) {
            case 'Under ₹500':
              return 'price.lt.50000'; // 50000 cents = ₹500
            case '₹500 - ₹1000':
              return 'price.gte.50000,price.lt.100000';
            case '₹1000 - ₹2000':
              return 'price.gte.100000,price.lt.200000';
            case '₹2000 - ₹5000':
              return 'price.gte.200000,price.lt.500000';
            case 'Above ₹5000':
              return 'price.gte.500000';
            default:
              return '';
          }
        }).filter(Boolean);
        
        if (priceConditions.length > 0) {
          query = query.or(priceConditions.join(','));
        }
      }


      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Products query error:', error);
        throw error;
      }
      
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setIsLoading(false); // Add this line to fix the loading issue
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

  const toggleFilterSection = (sectionId: string) => {
    setFilterSections(prev => 
      prev.map(section => 
        section.id === sectionId 
          ? { ...section, isExpanded: !section.isExpanded }
          : section
      )
    );
  };

  const handleFilterChange = (filterType: string, value: string, checked: boolean) => {
    switch (filterType) {
      case 'categories':
        setSelectedCategories(prev => 
          checked ? [...prev, value] : prev.filter(item => item !== value)
        );
        break;
      case 'brands':
        setSelectedBrands(prev => 
          checked ? [...prev, value] : prev.filter(item => item !== value)
        );
        break;
      case 'origins':
        setSelectedOrigins(prev => 
          checked ? [...prev, value] : prev.filter(item => item !== value)
        );
        break;
      case 'strengths':
        setSelectedStrengths(prev => 
          checked ? [...prev, value] : prev.filter(item => item !== value)
        );
        break;
      case 'pack-sizes':
        setSelectedPackSizes(prev => 
          checked ? [...prev, value] : prev.filter(item => item !== value)
        );
        break;
      case 'price-range':
        setSelectedPriceRange(prev => 
          checked ? [...prev, value] : prev.filter(item => item !== value)
        );
        break;
      default:
        break;
    }
  };

  const resetAllFilters = () => {
    setSelectedCategories([]);
    setSelectedBrands([]);
    setSelectedOrigins([]);
    setSelectedStrengths([]);
    setSelectedPackSizes([]);
    setSelectedPriceRange([]);
    setSearchQuery('');
    setCurrentPage(1);
  };

  const sortedProducts = [...products].sort((a, b) => {
    switch (sortBy) {
      case 'price-low':
        return a.price - b.price;
      case 'price-high':
        return b.price - a.price;
      case 'rating':
        return (b.rating || 0) - (a.rating || 0);
      case 'newest':
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      default: // name
        return a.name.localeCompare(b.name);
    }
  });

  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * productsPerPage,
    currentPage * productsPerPage
  );

  const totalPages = Math.ceil(sortedProducts.length / productsPerPage);

  if (isLoading) {
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

  return (
    <>
      <Helmet>
        <title>All our products - Cigarro</title>
        <meta name="description" content="Discover our complete collection of premium cigarettes, cigars, and tobacco products from world-renowned brands." />
      </Helmet>

      <div className="min-h-screen bg-background md:bg-creme pb-24 md:pb-16">
        {/* Mobile Header */}
        <div className="md:hidden pt-20 pb-4 px-4 bg-background border-b border-border">
          <h1 className="text-foreground font-serif text-2xl font-normal">All Products</h1>
          <p className="text-muted-foreground text-sm mt-1">{sortedProducts.length} products found</p>
        </div>

        {/* Mobile Controls */}
        <div className="md:hidden px-4 py-3 bg-background border-b border-border">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg text-foreground font-medium"
            >
              <span>Filters</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showMobileFilters ? 'rotate-180' : ''}`} />
            </button>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('two-col')}
                className={`p-2 rounded-lg ${viewMode === 'two-col' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                <Grid2X2 className="w-4 h-4" />
              </button>
            </div>
            
            <button
              onClick={resetAllFilters}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm"
            >
              Reset
            </button>
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
          {/* Mobile Filter Toggle */}
          <div className="lg:hidden mb-6">
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="flex items-center gap-2 text-dark font-sans font-medium text-lg uppercase tracking-wide"
            >
              <span>Filters</span>
              <ChevronDown className={`w-5 h-5 transition-transform ${showMobileFilters ? 'rotate-180' : ''}`} />
            </button>
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
                      {section.isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                    
                    {section.isExpanded && (
                      <div className="space-y-1 pb-3">
                        {section.items.map((item, itemIndex) => {
                          const isChecked = (() => {
                            switch (section.id) {
                              case 'categories':
                                return selectedCategories.includes(item);
                              case 'brands':
                                return selectedBrands.includes(item);
                              case 'origins':
                                return selectedOrigins.includes(item);
                              case 'strengths':
                                return selectedStrengths.includes(item);
                              case 'pack-sizes':
                                return selectedPackSizes.includes(item);
                              case 'price-range':
                                return selectedPriceRange.includes(item);
                              default:
                                return false;
                            }
                          })();

                          return (
                            <label 
                              key={itemIndex} 
                              htmlFor={`${section.id}-${itemIndex}`}
                              className="flex items-center space-x-3 cursor-pointer hover:bg-creme/30 rounded-md p-1 -m-1 transition-colors"
                            >
                              <Checkbox
                                id={`${section.id}-${itemIndex}`}
                                checked={isChecked}
                                onCheckedChange={(checked: boolean) => handleFilterChange(section.id, item, !!checked)}
                                className="border-coyote/30 data-[state=checked]:bg-canyon data-[state=checked]:border-canyon"
                              />
                              <span className="text-dark font-sans text-base">
                                {item}
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

            {/* Mobile Filter Sidebar */}
            {showMobileFilters && (
              <div className="lg:hidden fixed inset-0 z-50 bg-creme">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-dark font-sans font-medium text-lg uppercase tracking-wide">Filters</h2>
                    <button
                      onClick={() => setShowMobileFilters(false)}
                      className="text-dark hover:text-canyon transition-colors"
                    >
                      <ChevronUp className="w-6 h-6" />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {filterSections.map((section, index) => (
                      <div key={section.id} className={`${index > 0 ? 'border-t border-coyote/30 pt-4' : ''}`}>
                        <button
                          onClick={() => toggleFilterSection(section.id)}
                          className="flex items-center justify-between w-full text-left text-dark font-sans font-medium text-lg uppercase tracking-wide mb-2"
                        >
                          <span>{section.name}</span>
                          {section.isExpanded ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </button>
                        
                        {section.isExpanded && (
                          <div className="space-y-1 pb-3">
                            {section.items.map((item, itemIndex) => {
                              const isChecked = (() => {
                                switch (section.id) {
                                  case 'categories':
                                    return selectedCategories.includes(item);
                                  case 'brands':
                                    return selectedBrands.includes(item);
                                  case 'origins':
                                    return selectedOrigins.includes(item);
                                  case 'strengths':
                                    return selectedStrengths.includes(item);
                                  case 'pack-sizes':
                                    return selectedPackSizes.includes(item);
                                  case 'price-range':
                                    return selectedPriceRange.includes(item);
                                  default:
                                    return false;
                                }
                              })();

                              return (
                                <label 
                                  key={itemIndex} 
                                  htmlFor={`mobile-${section.id}-${itemIndex}`}
                                  className="flex items-center space-x-3 cursor-pointer hover:bg-creme/30 rounded-md p-1 -m-1 transition-colors"
                                >
                                  <Checkbox
                                    id={`mobile-${section.id}-${itemIndex}`}
                                    checked={isChecked}
                                    onCheckedChange={(checked: boolean) => handleFilterChange(section.id, item, !!checked)}
                                    className="border-coyote/30 data-[state=checked]:bg-canyon data-[state=checked]:border-canyon"
                                  />
                                  <span className="text-dark font-sans text-base">
                                    {item}
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
              </div>
            )}

            {/* Products Grid */}
          <div className="flex-1 relative">

            {paginatedProducts.length === 0 ? (
              <div className="text-center py-16">
                <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-coyote" />
                <h3 className="text-2xl font-serif text-dark mb-4">No products found</h3>
                <p className="text-dark/80 mb-8">We couldn't find any products matching your criteria.</p>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div 
                  className={`${viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' : 'grid grid-cols-1 sm:grid-cols-2 gap-6'}`}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30 }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                  key={`products-${selectedCategories.join(',')}-${selectedBrands.join(',')}-${selectedOrigins.join(',')}-${selectedStrengths.join(',')}-${selectedPackSizes.join(',')}-${selectedPriceRange.join(',')}-${searchQuery}-${currentPage}`}
                >
                  {paginatedProducts.map((product, index) => (
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
                      />
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-12">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-coyote rounded-md text-dark font-sans disabled:opacity-50 disabled:cursor-not-allowed hover:bg-creme-light transition-colors duration-300"
              >
                Previous
              </button>
              
              <div className="flex gap-1">
                {[...Array(totalPages)].map((_, i) => {
                  const pageNum = i + 1;
                  if (
                    pageNum === 1 ||
                    pageNum === totalPages ||
                    (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-10 h-10 rounded-md font-sans font-medium transition-colors duration-300 ${
                          currentPage === pageNum
                            ? 'bg-dark text-creme-light'
                            : 'border border-coyote hover:bg-creme-light text-dark'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  } else if (
                    pageNum === currentPage - 2 ||
                    pageNum === currentPage + 2
                  ) {
                    return (
                      <span key={pageNum} className="w-10 h-10 flex items-center justify-center text-coyote">
                        ...
                      </span>
                    );
                  }
                  return null;
                })}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-coyote rounded-md text-dark font-sans disabled:opacity-50 disabled:cursor-not-allowed hover:bg-creme-light transition-colors duration-300"
              >
                Next
              </button>
            </div>
          )}
          </div>
          </div>
        </div>

        {/* Floating Help Button */}
        <div className="fixed bottom-6 right-6 z-50">
          <button className="w-14 h-14 bg-canyon text-creme-light rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110">
            <span className="text-xl font-bold">?</span>
          </button>
        </div>
      </div>
    </>
  );
}
