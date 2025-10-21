import React, { useState, useEffect, useRef } from 'react';
import { useCart } from '../../hooks/useCart';
import { useAuth } from '../../hooks/useAuth';
import { useWishlist } from '../../hooks/useWishlist';
import { Search, ShoppingBag, Menu, X, Heart, User, LogOut, Loader2, Package, ExternalLink } from 'lucide-react';
import { AuthDialog } from '../auth/AuthDialog';
import { MiniCart } from '../cart/MiniCart';
import { Badge } from '../ui/badge';
import { supabase } from '../../utils/supabase/client';
import { Product } from '../../hooks/useCart';
import { Link } from 'react-router-dom';
import { formatINR } from '../../utils/currency';
import { searchProductsEnhanced } from '../../utils/search';
import { SearchResult } from '../../types/variants';
import Fuse from 'fuse.js';
import { getProductImageUrl } from '../../utils/supabase/storage';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [isMiniCartOpen, setIsMiniCartOpen] = useState(false);
  const [autoShowTimeout, setAutoShowTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [fuseInstance, setFuseInstance] = useState<Fuse<Product> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { items, totalItems } = useCart();
  const { user, signOut } = useAuth();
  const { wishlistCount } = useWishlist();


  // Initialize Fuse.js for fuzzy search
  const initializeFuse = (products: Product[]) => {
    const fuse = new Fuse(products, {
      keys: [
        { name: 'name', weight: 0.4 },
        { name: 'brand', weight: 0.3 },
        { name: 'description', weight: 0.2 },
        { name: 'origin', weight: 0.1 }
      ],
      threshold: 0.4, // Lower threshold = more strict matching
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 2,
      shouldSort: true,
      findAllMatches: true,
      ignoreLocation: true,
      useExtendedSearch: true
    });
    setFuseInstance(fuse);
  };

  // Fetch all products for client-side fuzzy search
  const fetchAllProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, slug, brand, price, description, is_active, gallery_images, rating, review_count, created_at')
        .eq('is_active', true);

      if (error) throw error;
      setAllProducts(data || []);
      initializeFuse(data || []);
    } catch (error) {
      console.error('Error fetching products for search:', error);
    }
  };

  // Advanced search algorithm with fuzzy matching
  const calculateLevenshteinDistance = (str1: string, str2: string): number => {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  };

  const calculateSearchScore = (product: Product, query: string): number => {
    const queryLower = query.toLowerCase();
    const nameLower = product.name.toLowerCase();
    const brandLower = (product.brand || '').toLowerCase();
    const descriptionLower = (product.description || '').toLowerCase();
    
    let score = 0;
    
    // Exact matches get highest score
    if (nameLower === queryLower) score += 1000;
    if (brandLower === queryLower) score += 800;
    
    // Starts with matches
    if (nameLower.startsWith(queryLower)) score += 500;
    if (brandLower.startsWith(queryLower)) score += 400;
    
    // Contains matches
    if (nameLower.includes(queryLower)) score += 300;
    if (brandLower.includes(queryLower)) score += 200;
    if (descriptionLower.includes(queryLower)) score += 100;
    
    // Word boundary matches (more precise)
    const nameWords = nameLower.split(/\s+/);
    const brandWords = brandLower.split(/\s+/);
    const queryWords = queryLower.split(/\s+/);
    
    queryWords.forEach(queryWord => {
      nameWords.forEach(nameWord => {
        if (nameWord.startsWith(queryWord)) score += 150;
        if (nameWord.includes(queryWord)) score += 75;
      });
      brandWords.forEach(brandWord => {
        if (brandWord.startsWith(queryWord)) score += 120;
        if (brandWord.includes(queryWord)) score += 60;
      });
    });
    
    // Fuzzy matching with Levenshtein distance
    const nameDistance = calculateLevenshteinDistance(queryLower, nameLower);
    const brandDistance = calculateLevenshteinDistance(queryLower, brandLower);
    
    if (nameDistance <= 2) score += Math.max(0, 200 - nameDistance * 50);
    if (brandDistance <= 2) score += Math.max(0, 150 - brandDistance * 40);
    
    // Boost score for products with higher ratings
    if (product.rating) score += product.rating * 10;
    
    return score;
  };

  const searchProducts = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    
    try {
      // Use Fuse.js for fuzzy search if available (most reliable)
      if (fuseInstance) {
        const fuseResults = fuseInstance.search(query);
          const results = fuseResults
            .slice(0, 8)
            .map(result => ({
              ...result.item,
              item_type: 'product' as const,
              search_score: result.score || 0,
              searchable_text: `${result.item.name} ${result.item.brand} ${result.item.description || ''}`,
              base_price: result.item.price,
              created_at: result.item.created_at || new Date().toISOString(),
              variant_id: undefined,
              variant_name: undefined,
              variant_price: undefined,
              combo_id: undefined,
              combo_name: undefined,
              combo_price: undefined,
              original_price: undefined,
              matched_variant: undefined,
              matched_combo: undefined
            }));
        
        setSearchResults(results);
        setShowResults(true);
      } else {
        // Fallback to database search
        const { data, error } = await supabase
          .from('products')
          .select('id, name, slug, brand, price, description, is_active, gallery_images, rating, review_count, created_at')
          .eq('is_active', true)
          .or(`name.ilike.%${query}%,brand.ilike.%${query}%,description.ilike.%${query}%`);

        if (error) throw error;

          const basicResults = (data || []).map(product => ({
            ...product,
            item_type: 'product' as const,
            search_score: calculateSearchScore(product, query),
            searchable_text: `${product.name} ${product.brand} ${product.description || ''}`,
            base_price: product.price,
            created_at: product.created_at || new Date().toISOString(),
            variant_id: undefined,
            variant_name: undefined,
            variant_price: undefined,
            combo_id: undefined,
            combo_name: undefined,
            combo_price: undefined,
            original_price: undefined,
            matched_variant: undefined,
            matched_combo: undefined
          }));

        setSearchResults(basicResults.slice(0, 8));
        setShowResults(true);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchProducts(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Fetch all products on component mount
  useEffect(() => {
    fetchAllProducts();
  }, []);

  // Listen for cart item added events to auto-show mini cart
  useEffect(() => {
    const handleCartItemAdded = () => {
      // Clear any existing timeout
      if (autoShowTimeout) {
        clearTimeout(autoShowTimeout);
      }
      
      // Show mini cart immediately
      setIsMiniCartOpen(true);
      
      // Set timeout to hide after 3 seconds
      const timeout = setTimeout(() => {
        setIsMiniCartOpen(false);
      }, 3000);
      
      setAutoShowTimeout(timeout);
    };

    window.addEventListener('cartItemAdded', handleCartItemAdded);
    
    return () => {
      window.removeEventListener('cartItemAdded', handleCartItemAdded);
      if (autoShowTimeout) {
        clearTimeout(autoShowTimeout);
      }
    };
  }, [autoShowTimeout]);

  // Focus search input when search opens
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  const handleSearchClose = () => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
  };

  return (
    <header className="hidden lg:block fixed top-0 left-0 right-0 z-50 px-4 py-3">
      <div className="bg-creme border border-coyote rounded-lg h-14 flex items-center justify-between px-2 relative z-10">
        {/* Left Section - Menu */}
        <button 
          type="button" 
          className="flex items-center gap-3 px-4 py-2 border-r border-coyote rounded-l-lg hover:bg-dark transition-colors duration-300 group"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {/* Hamburger Menu */}
          <div className="inline-block relative w-4 h-px lg:w-5 bg-dark transition-colors duration-300 group-hover:bg-creme-light before:content-[''] before:block before:w-4 lg:before:w-5 before:h-px before:bg-dark before:transform before:-translate-y-[5px] lg:before:-translate-y-[6px] before:transition-all before:duration-300 after:content-[''] after:block after:w-4 lg:after:w-5 after:h-px after:bg-dark after:translate-y-[5px] lg:after:translate-y-[6px] after:transition-all after:duration-300 group-hover:before:bg-creme-light group-hover:after:bg-creme-light"></div>
          <span className="text-dark font-sans font-normal text-base leading-tight tracking-tight transition-colors duration-300 group-hover:text-creme-light">
            Menu
          </span>
        </button>

        {/* Center Section - Logo */}
        <Link to="/" className="absolute left-1/2 -translate-x-1/2">
          <h1 className="text-dark font-serif font-normal tracking-tight leading-none text-2xl uppercase">
            CIGARRO
          </h1>
        </Link>

        {/* Right Section - Icons */}
        <div className="flex items-center gap-1">
          {/* Search */}
          <button 
            className="flex items-center justify-center w-12 h-12 hover:bg-creme-light rounded-lg transition-colors duration-300"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            aria-label="Search"
          >
            <Search className="w-4 h-4 lg:w-5 lg:h-5 xl:w-5 xl:h-5 text-dark" strokeWidth={1.5} />
          </button>
          
          {/* Wishlist */}
          <Link 
            to="/wishlist" 
            className="flex items-center justify-center w-12 h-12 hover:bg-creme-light rounded-lg transition-colors duration-300 relative"
            aria-label="Wishlist"
          >
            <Heart className="w-4 h-4 lg:w-5 lg:h-5 xl:w-5 xl:h-5 text-dark" strokeWidth={1.5} />
            {wishlistCount > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-creme-light bg-dark rounded-full">
                {wishlistCount}
              </span>
            )}
          </Link>

          {/* Cart */}
          <div 
            className="relative"
            onMouseEnter={() => {
              if (autoShowTimeout) {
                clearTimeout(autoShowTimeout);
                setAutoShowTimeout(null);
              }
              setIsMiniCartOpen(true);
            }}
            onMouseLeave={() => setIsMiniCartOpen(false)}
          >
            <button 
              className="flex items-center justify-center w-12 h-12 hover:bg-creme-light rounded-lg transition-colors duration-300 relative"
              onClick={() => setIsMiniCartOpen(!isMiniCartOpen)}
              aria-label="Shopping cart"
            >
              <ShoppingBag className="w-4 h-4 lg:w-5 lg:h-5 xl:w-5 xl:h-5 text-dark" strokeWidth={1.5} />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-creme-light bg-dark rounded-full">
                  {totalItems}
                </span>
              )}
            </button>
            
            {/* Mini Cart */}
            <MiniCart 
              isVisible={isMiniCartOpen} 
              onClose={() => setIsMiniCartOpen(false)} 
            />
          </div>

          {/* Authentication */}
          {user ? (
            <div 
              className="relative"
              onMouseEnter={() => setIsUserDropdownOpen(true)}
              onMouseLeave={() => setIsUserDropdownOpen(false)}
            >
              <button 
                className="flex items-center justify-center w-12 h-12 hover:bg-creme-light rounded-lg transition-colors duration-300"
                onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                aria-label="User menu"
              >
                <User className="w-4 h-4 lg:w-5 lg:h-5 xl:w-5 xl:h-5 text-dark" strokeWidth={1.5} />
              </button>
              {/* User Dropdown */}
              <div className={`absolute right-0 top-full mt-2 w-56 bg-creme border border-coyote rounded-lg shadow-xl transition-all duration-300 z-50 ${isUserDropdownOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                <div className="p-4 border-b border-coyote">
                  <p className="font-medium text-dark text-base">{user.name}</p>
                  <p className="text-coyote text-sm truncate">{user.email}</p>
                </div>
                <div className="py-2">
                  {user.isAdmin && (
                    <Link to="/admin" className="block px-4 py-2.5 text-sm text-dark hover:bg-creme-light transition-colors">
                      Admin Dashboard
                    </Link>
                  )}
                  <Link to="/orders" className="block px-4 py-2.5 text-sm text-dark hover:bg-creme-light transition-colors">
                    My Orders
                  </Link>
                  <button 
                    onClick={() => signOut()}
                    className="w-full text-left px-4 py-2.5 text-sm text-dark hover:bg-creme-light transition-colors flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button 
              className="flex items-center justify-center w-12 h-12 hover:bg-creme-light rounded-lg transition-colors duration-300"
              onClick={() => setIsAuthDialogOpen(true)}
              aria-label="Sign in"
            >
              <User className="w-5 h-5 text-dark" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Menu */}
      {isMenuOpen && (
        <div className="absolute top-[calc(100%-0.75rem)] left-4 right-4 bg-creme border border-coyote border-t-0 rounded-b-lg max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-hide shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-0">
            {/* Shop Section */}
            <div className="p-6 border-b border-coyote lg:border-b-0 lg:border-r lg:border-coyote">
              <span className="block text-dark font-sans font-medium uppercase text-sm leading-tight tracking-tight mb-4">
                Shop
              </span>
              <Link to="/products" className="block py-2 text-dark font-sans font-normal text-sm leading-relaxed tracking-tight transition-colors duration-300 hover:text-canyon" onClick={() => setIsMenuOpen(false)}>
                All Products
              </Link>
              <Link to="/collections" className="block py-2 text-dark font-sans font-normal text-sm leading-relaxed tracking-tight transition-colors duration-300 hover:text-canyon" onClick={() => setIsMenuOpen(false)}>
                Collections
              </Link>
              <Link to="/wishlist" className="block py-2 text-dark font-sans font-normal text-sm leading-relaxed tracking-tight transition-colors duration-300 hover:text-canyon" onClick={() => setIsMenuOpen(false)}>
                Wishlist
              </Link>
              <Link to="/cart" className="block py-2 text-dark font-sans font-normal text-sm leading-relaxed tracking-tight transition-colors duration-300 hover:text-canyon" onClick={() => setIsMenuOpen(false)}>
                Shopping Cart
              </Link>
            </div>
            
            {/* Account Section */}
            <div className="p-6 border-b border-coyote lg:border-b-0 lg:border-r lg:border-coyote">
              <span className="block text-dark font-sans font-medium uppercase text-sm leading-tight tracking-tight mb-4">
                Account
              </span>
              {user ? (
                <>
                  <Link to="/orders" className="block py-2 text-dark font-sans font-normal text-sm leading-relaxed tracking-tight transition-colors duration-300 hover:text-canyon" onClick={() => setIsMenuOpen(false)}>
                    My Orders
                  </Link>
                  <Link to="/wishlist" className="block py-2 text-dark font-sans font-normal text-sm leading-relaxed tracking-tight transition-colors duration-300 hover:text-canyon" onClick={() => setIsMenuOpen(false)}>
                    My Wishlist
                  </Link>
                  {user.isAdmin && (
                    <Link to="/admin" className="block py-2 text-dark font-sans font-normal text-sm leading-relaxed tracking-tight transition-colors duration-300 hover:text-canyon" onClick={() => setIsMenuOpen(false)}>
                      Admin Dashboard
                    </Link>
                  )}
                  <button 
                    onClick={() => { signOut(); setIsMenuOpen(false); }}
                    className="block py-2 text-dark font-sans font-normal text-sm leading-relaxed tracking-tight transition-colors duration-300 hover:text-canyon text-left"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => { setIsAuthDialogOpen(true); setIsMenuOpen(false); }}
                  className="block py-2 text-dark font-sans font-normal text-sm leading-relaxed tracking-tight transition-colors duration-300 hover:text-canyon text-left"
                >
                  Sign In / Register
                </button>
              )}
            </div>
            
            {/* Information Section */}
            <div className="p-6 border-b border-coyote lg:border-b-0 lg:border-r lg:border-coyote">
              <span className="block text-dark font-sans font-medium uppercase text-sm leading-tight tracking-tight mb-4">
                Information
              </span>
              <Link to="/about" className="block py-2 text-dark font-sans font-normal text-sm leading-relaxed tracking-tight transition-colors duration-300 hover:text-canyon" onClick={() => setIsMenuOpen(false)}>
                About Us
              </Link>
              <Link to="/blog" className="block py-2 text-dark font-sans font-normal text-sm leading-relaxed tracking-tight transition-colors duration-300 hover:text-canyon" onClick={() => setIsMenuOpen(false)}>
                Blog
              </Link>
              <Link to="/contact" className="block py-2 text-dark font-sans font-normal text-sm leading-relaxed tracking-tight transition-colors duration-300 hover:text-canyon" onClick={() => setIsMenuOpen(false)}>
                Contact Us
              </Link>
              <Link to="/shipping" className="block py-2 text-dark font-sans font-normal text-sm leading-relaxed tracking-tight transition-colors duration-300 hover:text-canyon" onClick={() => setIsMenuOpen(false)}>
                Shipping Info
              </Link>
            </div>
            
            {/* Legal Section */}
            <div className="p-6">
              <span className="block text-dark font-sans font-medium uppercase text-sm leading-tight tracking-tight mb-4">
                Legal
              </span>
              <Link to="/privacy" className="block py-2 text-dark font-sans font-normal text-sm leading-relaxed tracking-tight transition-colors duration-300 hover:text-canyon" onClick={() => setIsMenuOpen(false)}>
                Privacy Policy
              </Link>
              <Link to="/terms" className="block py-2 text-dark font-sans font-normal text-sm leading-relaxed tracking-tight transition-colors duration-300 hover:text-canyon" onClick={() => setIsMenuOpen(false)}>
                Terms of Service
              </Link>
              <a href="#" className="block py-2 text-dark font-sans font-normal text-sm leading-relaxed tracking-tight transition-colors duration-300 hover:text-canyon">
                Age Verification
              </a>
              <a href="#" className="block py-2 text-dark font-sans font-normal text-sm leading-relaxed tracking-tight transition-colors duration-300 hover:text-canyon">
                Responsible Use
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Search Overlay */}
      {isSearchOpen && (
        <div className="fixed inset-0 bg-black/50 z-[99999]" onClick={handleSearchClose}>
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 w-full max-w-4xl mx-auto p-4">
            <div className="bg-creme rounded-lg shadow-xl border border-coyote" onClick={(e) => e.stopPropagation()}>
              {/* Search Input */}
              <div className="p-6 border-b border-coyote">
                <div className="flex items-center gap-3 lg:gap-4">
                  <Search className="w-5 h-5 lg:w-6 lg:h-6 text-coyote" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search for quality tobacco products..."
                    className="flex-1 bg-transparent text-dark placeholder:text-coyote text-base lg:text-lg focus:outline-none"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {isSearching && <Loader2 className="w-4 h-4 lg:w-5 lg:h-5 text-coyote animate-spin" />}
                  <button 
                    onClick={handleSearchClose}
                    className="text-coyote hover:text-dark transition-colors p-1"
                    aria-label="Close search"
                  >
                    <X className="w-5 h-5 lg:w-6 lg:h-6" />
                  </button>
                </div>
              </div>

              {/* Search Results */}
              {showResults && (
                <div className="max-h-96 overflow-y-auto">
                  {searchResults.length > 0 ? (
                    <div className="p-4">
                      <div className="mb-4">
                        <h3 className="text-dark font-sans font-semibold text-lg">
                          {searchResults.length} {searchResults.length === 1 ? 'product' : 'products'} found
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {searchResults.map((result) => (
                          <Link
                            key={`${result.item_type}-${result.id}`}
                            to={`/product/${result.slug}`}
                            className="flex items-center gap-4 p-4 rounded-lg hover:bg-creme-light transition-colors border border-transparent hover:border-coyote/20"
                            onClick={handleSearchClose}
                          >
                            {/* Product Image */}
                            <div className="flex-shrink-0">
                              <img
                                src={getProductImageUrl(result.gallery_images?.[0])}
                                alt={result.name}
                                className="w-16 h-16 rounded-lg object-cover bg-white"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = getProductImageUrl();
                                }}
                              />
                            </div>
                            
                            {/* Product Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-canyon text-sm font-semibold uppercase tracking-wider font-sans truncate">
                                    {result.brand || 'Quality'}
                                  </p>
                                  <h4 className="text-dark font-sans font-semibold text-base leading-tight line-clamp-2">
                                    {result.name}
                                  </h4>
                                  
                                  {/* Variant/Combo Info */}
                                  {result.item_type === 'variant' && result.variant_name && (
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge variant="secondary" className="text-xs">
                                        <Package className="w-3 h-3 mr-1" />
                                        {result.variant_name}
                                      </Badge>
                                    </div>
                                  )}
                                  
                                  {result.item_type === 'combo' && (
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge variant="default" className="text-xs bg-accent text-accent-foreground">
                                        <ExternalLink className="w-3 h-3 mr-1" />
                                        Combo Pack
                                      </Badge>
                                    </div>
                                  )}
                                  
                                  {/* Match indicator */}
                                  {result.matched_variant && (
                                    <div className="text-xs text-green-600 mt-1">
                                      ✓ Matched: {result.matched_variant}
                                    </div>
                                  )}
                                  
                                  {result.description && (
                                    <p className="text-dark/70 text-sm leading-relaxed line-clamp-2 font-sans mt-1">
                                      {result.description}
                                    </p>
                                  )}
                                </div>
                                <div className="flex-shrink-0 text-right">
                                  <div className="text-dark font-bold text-lg font-sans">
                                    {formatINR(result.variant_price || result.combo_price || result.base_price)}
                                  </div>
                                  {result.item_type === 'combo' && result.original_price && (
                                    <div className="text-xs text-muted-foreground line-through">
                                      {formatINR(result.original_price)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                      
                      {/* View All Results */}
                      {searchResults.length >= 8 && (
                        <div className="mt-4 pt-4 border-t border-coyote">
                          <Link
                            to={`/products?search=${encodeURIComponent(searchQuery)}`}
                            className="block text-center text-dark font-sans font-medium text-base hover:text-canyon transition-colors"
                            onClick={handleSearchClose}
                          >
                            View all results for "{searchQuery}"
                          </Link>
                        </div>
                      )}
                    </div>
                  ) : searchQuery.trim() && !isSearching ? (
                    <div className="p-8 text-center">
                      <Search className="w-12 h-12 mx-auto mb-4 text-coyote" />
                      <h3 className="text-dark font-sans font-semibold text-lg mb-2">No products found</h3>
                      <p className="text-dark/70 font-sans">
                        Try searching with different keywords or browse our full collection
                      </p>
                      <Link
                        to="/products"
                        className="inline-block mt-4 bg-dark text-creme-light px-6 py-2 rounded-full font-medium hover:bg-creme-light hover:text-dark transition-colors duration-300 text-sm uppercase tracking-wide"
                        onClick={handleSearchClose}
                      >
                        Browse All Products
                      </Link>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Authentication Dialog */}
      <AuthDialog 
        open={isAuthDialogOpen} 
        onOpenChange={setIsAuthDialogOpen} 
      />
    </header>
  );
};

export default Header;
