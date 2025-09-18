import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '../utils/supabase/client';
import { Product } from '../hooks/useCart';
import { toast } from 'sonner';
import { ProductCard } from './ProductCard';
import { Button } from './ui/button';
import { Heart, ShoppingCart, Star, ChevronDown, ChevronUp, Grid3X3, List, Search } from 'lucide-react';
import { useCart } from '../hooks/useCart';
import { useWishlist } from '../hooks/useWishlist';
import { formatINR } from '../utils/currency';

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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
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
  const [isFilterLoading, setIsFilterLoading] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  
  const { addToCart, isLoading: cartLoading } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();

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
        id: 'styles',
        name: 'STYLES',
        items: ['Pendant Light', 'Multi Light', 'Wall Mount', 'Ceiling Light', 'Stone', 'Linear', 'Free-Standing', 'Built-in', 'Objects', 'Tala bulbs'],
        isExpanded: filterSections.find(s => s.id === 'styles')?.isExpanded ?? false
      },
      {
        id: 'moods',
        name: 'MOODS',
        items: ['Minimalist', 'Contemporary', 'Scandinavian', 'Organic', 'Post Modern', 'Farmhouse', 'Luxe'],
        isExpanded: filterSections.find(s => s.id === 'moods')?.isExpanded ?? false
      },
      {
        id: 'collections',
        name: 'COLLECTIONS',
        items: ['Stone', 'Pivoine', 'Onyx', 'Coquelicot', 'Danoise', 'Flora', 'Nomad', 'Luxe', 'Nopal', 'Linear', 'Quick Ship', 'Classics', 'Chrome', 'Hospitality', 'Outdoor'],
        isExpanded: filterSections.find(s => s.id === 'collections')?.isExpanded ?? true
      },
      {
        id: 'rooms',
        name: 'ROOMS',
        items: ['Living Room', 'Kitchen', 'Dining room', 'Bathroom', 'Bedroom', 'Entrance Hall', 'Corridor', 'Exterior', 'Staircase'],
        isExpanded: filterSections.find(s => s.id === 'rooms')?.isExpanded ?? false
      },
      {
        id: 'brands',
        name: 'BRANDS',
        items: brands.map(b => `${b.brand} (${b.count})`),
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
      },
      {
        id: 'quick-ship',
        name: 'QUICK SHIP',
        items: ['Quick ship'],
        isExpanded: filterSections.find(s => s.id === 'quick-ship')?.isExpanded ?? false
      }
    ].filter(section => section.items.length > 0); // Only show sections with items
    
    setFilterSections(sections);
  }, [categories, brands, origins, strengths, packSizes]);


  const fetchFilterData = async () => {
    try {
      console.log('Fetching filter data...');
      
      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('id, name, slug')
        .order('name');
      
      if (categoriesError) {
        console.error('Categories error:', categoriesError);
      } else {
        console.log('Categories loaded:', categoriesData?.length || 0);
        setCategories(categoriesData || []);
      }

      // Fetch brands with counts
      const { data: brandsData } = await supabase
        .from('products')
        .select('brand')
        .eq('is_active', true);
      
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
        .select('origin')
        .eq('is_active', true)
        .not('origin', 'is', null);
      
      if (originsData) {
        const uniqueOrigins = [...new Set(originsData.map(p => p.origin).filter(Boolean))].sort();
        setOrigins(uniqueOrigins);
      }

      // Fetch unique strengths
      const { data: strengthsData } = await supabase
        .from('products')
        .select('strength')
        .eq('is_active', true)
        .not('strength', 'is', null);
      
      if (strengthsData) {
        const uniqueStrengths = [...new Set(strengthsData.map(p => p.strength).filter(Boolean))].sort();
        setStrengths(uniqueStrengths);
      }

      // Fetch unique pack sizes
      const { data: packSizesData } = await supabase
        .from('products')
        .select('pack_size')
        .eq('is_active', true)
        .not('pack_size', 'is', null);
      
      if (packSizesData) {
        const uniquePackSizes = [...new Set(packSizesData.map(p => p.pack_size).filter(Boolean))].sort();
        setPackSizes(uniquePackSizes);
      }
    } catch (error) {
      console.error('Error fetching filter data:', error);
    }
  };

  const fetchProducts = async () => {
    setIsFilterLoading(true);
    try {
      console.log('Fetching products...');
      let query = supabase
        .from('products')
        .select(`
          id, name, slug, brand, price, description, is_active, gallery_images, rating, review_count, created_at,
          origin, strength, pack_size,
          product_categories (
            categories (id, name, slug)
          )
        `)
        .eq('is_active', true);

      // Apply search filter
      if (urlSearchQuery.trim()) {
        query = query.or(`name.ilike.%${urlSearchQuery}%,brand.ilike.%${urlSearchQuery}%,description.ilike.%${urlSearchQuery}%`);
      }

      // Apply category filter
      if (selectedCategories.length > 0) {
        query = query.in('product_categories.categories.name', selectedCategories);
      }

      // Apply brand filter
      if (selectedBrands.length > 0) {
        query = query.in('brand', selectedBrands);
      }

      // Apply origin filter
      if (selectedOrigins.length > 0) {
        query = query.in('origin', selectedOrigins);
      }

      // Apply strength filter
      if (selectedStrengths.length > 0) {
        query = query.in('strength', selectedStrengths);
      }

      // Apply pack size filter
      if (selectedPackSizes.length > 0) {
        query = query.in('pack_size', selectedPackSizes);
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
      
      console.log('Products loaded:', data?.length || 0);
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setIsFilterLoading(false);
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
      case 'styles':
        setSelectedCategories(prev => 
          checked ? [...prev, value] : prev.filter(item => item !== value)
        );
        break;
      case 'moods':
        setSelectedBrands(prev => 
          checked ? [...prev, value] : prev.filter(item => item !== value)
        );
        break;
      case 'collections':
        setSelectedOrigins(prev => 
          checked ? [...prev, value] : prev.filter(item => item !== value)
        );
        break;
      case 'rooms':
        setSelectedStrengths(prev => 
          checked ? [...prev, value] : prev.filter(item => item !== value)
        );
        break;
      case 'brands':
        setSelectedPackSizes(prev => 
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
      case 'quick-ship':
        setSelectedPriceRange(prev => 
          checked ? [...prev, value] : prev.filter(item => item !== value)
        );
        break;
    }
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

      <div className="min-h-screen bg-creme">
        {/* Main Title - Exact Inspiration Style */}
        <div className="main-container">
          <div className="title-wrapper text-center py-16">
            <h1 className="main-title">All our products</h1>
          </div>
        </div>

        {/* Product Count and View Options - Exact Inspiration Style */}
        <div className="main-container mb-8">
          <div className="flex justify-between items-center">
            <div className="text-dark font-sans font-medium text-lg uppercase tracking-wide">
              {sortedProducts.length} PRODUCTS
            </div>
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
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${viewMode === 'list' ? 'bg-dark text-creme-light' : 'bg-creme-light text-dark border border-coyote'}`}
                >
                  <List className="w-5 h-5" />
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
            <div className="hidden lg:block w-80 flex-shrink-0">
              <div className="space-y-0">
                {filterSections.map((section, index) => (
                  <div key={section.id} className={`${index > 0 ? 'border-t border-coyote/30 pt-6' : ''}`}>
                    <button
                      onClick={() => toggleFilterSection(section.id)}
                      className="flex items-center justify-between w-full text-left text-dark font-sans font-medium text-lg uppercase tracking-wide mb-4"
                    >
                      <span>{section.name}</span>
                      {section.isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                    
                    {section.isExpanded && (
                      <div className="space-y-2">
                        {section.items.map((item, itemIndex) => {
                          // Extract brand name from "Brand (count)" format
                          const displayValue = section.id === 'brands' ? item.split(' (')[0] : item;
                          const isChecked = (() => {
                            switch (section.id) {
                              case 'styles':
                                return selectedCategories.includes(item);
                              case 'moods':
                                return selectedBrands.includes(item);
                              case 'collections':
                                return selectedOrigins.includes(item);
                              case 'rooms':
                                return selectedStrengths.includes(item);
                              case 'brands':
                                return selectedPackSizes.includes(displayValue);
                              case 'origins':
                                return selectedOrigins.includes(item);
                              case 'strengths':
                                return selectedStrengths.includes(item);
                              case 'pack-sizes':
                                return selectedPackSizes.includes(item);
                              case 'price-range':
                                return selectedPriceRange.includes(item);
                              case 'quick-ship':
                                return selectedPriceRange.includes(item);
                              default:
                                return false;
                            }
                          })();

                          return (
                            <label key={itemIndex} className="flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => handleFilterChange(section.id, displayValue, e.target.checked)}
                                className="mr-3 w-4 h-4 text-dark border-coyote rounded focus:ring-dark"
                              />
                              <span className="text-dark font-sans text-base">{item}</span>
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
                  
                  <div className="space-y-6">
                    {filterSections.map((section, index) => (
                      <div key={section.id} className={`${index > 0 ? 'border-t border-coyote/30 pt-6' : ''}`}>
                        <button
                          onClick={() => toggleFilterSection(section.id)}
                          className="flex items-center justify-between w-full text-left text-dark font-sans font-medium text-lg uppercase tracking-wide mb-4"
                        >
                          <span>{section.name}</span>
                          {section.isExpanded ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </button>
                        
                        {section.isExpanded && (
                          <div className="space-y-2">
                            {section.items.map((item, itemIndex) => {
                              const displayValue = section.id === 'brands' ? item.split(' (')[0] : item;
                              const isChecked = (() => {
                                switch (section.id) {
                                  case 'styles':
                                    return selectedCategories.includes(item);
                                  case 'moods':
                                    return selectedBrands.includes(item);
                                  case 'collections':
                                    return selectedOrigins.includes(item);
                                  case 'rooms':
                                    return selectedStrengths.includes(item);
                                  case 'brands':
                                    return selectedPackSizes.includes(displayValue);
                                  case 'origins':
                                    return selectedOrigins.includes(item);
                                  case 'strengths':
                                    return selectedStrengths.includes(item);
                                  case 'pack-sizes':
                                    return selectedPackSizes.includes(item);
                                  case 'price-range':
                                    return selectedPriceRange.includes(item);
                                  case 'quick-ship':
                                    return selectedPriceRange.includes(item);
                                  default:
                                    return false;
                                }
                              })();

                              return (
                                <label key={itemIndex} className="flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => handleFilterChange(section.id, displayValue, e.target.checked)}
                                    className="mr-3 w-4 h-4 text-dark border-coyote rounded focus:ring-dark"
                                  />
                                  <span className="text-dark font-sans text-base">{item}</span>
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
            {/* Subtle loading overlay */}
            {isFilterLoading && (
              <div className="absolute inset-0 bg-creme/50 backdrop-blur-sm z-10 flex items-center justify-center">
                <div className="bg-white rounded-lg p-4 shadow-lg flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-dark"></div>
                  <span className="text-dark font-sans text-sm">Filtering products...</span>
                </div>
              </div>
            )}

            {paginatedProducts.length === 0 ? (
              <div className="text-center py-16">
                <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-coyote" />
                <h3 className="text-2xl font-serif text-dark mb-4">No products found</h3>
                <p className="text-dark/80 mb-8">We couldn't find any products matching your criteria.</p>
              </div>
            ) : (
              <div className={`${viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' : 'space-y-4'}`}>
                {paginatedProducts.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    variant={viewMode === 'list' ? 'list' : 'default'}
                    onAddToCart={handleAddToCart}
                    onToggleWishlist={toggleWishlist}
                    isWishlisted={isWishlisted(product.id)}
                    isLoading={cartLoading}
                    index={index}
                  />
                ))}
              </div>
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
