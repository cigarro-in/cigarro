import React, { useState, useEffect, useRef } from 'react';
import { Search, Menu, X, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../utils/supabase/client';
import { Product } from '../../hooks/useCart';
import { SearchResult } from '../../types/variants';
import { formatINR } from '../../utils/currency';
import { getProductImageUrl } from '../../utils/supabase/storage';
import Fuse from 'fuse.js';

interface MobileHeaderProps {
  onMenuToggle: () => void;
  isMenuOpen: boolean;
}

export const MobileHeader = ({ onMenuToggle, isMenuOpen }: MobileHeaderProps) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [fuseInstance, setFuseInstance] = useState<Fuse<Product> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Initialize Fuse.js for fuzzy search
  const initializeFuse = (products: Product[]) => {
    const fuse = new Fuse(products, {
      keys: [
        { name: 'name', weight: 0.4 },
        { name: 'brand', weight: 0.3 },
        { name: 'description', weight: 0.2 },
      ],
      threshold: 0.4,
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

  const searchProducts = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    
    try {
      if (fuseInstance) {
        const fuseResults = fuseInstance.search(query);
        const results = fuseResults
          .slice(0, 6) // Limit to 6 results for mobile
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
    <>
      {/* Mobile Header (desktop-like container) */}
      <header className="mobile-header md:hidden fixed top-0 left-0 right-0 z-[9999] safe-area-top">
        <div className="px-4 py-2">
        <div className="bg-creme border border-coyote rounded-md h-[50px] flex items-center justify-between">
          {/* Menu Button with triple lines */}
          <button 
            type="button" 
            className="flex items-center justify-center h-[50px] px-4 border-r border-coyote rounded-tl-md transition-colors duration-300 hover:bg-creme-light"
            onClick={onMenuToggle}
            aria-label="Open menu"
          >
            {isMenuOpen ? (
              <X className="w-6 h-6 text-dark" strokeWidth={1.5} />
            ) : (
              <div className="inline-block relative w-6 h-px bg-dark transition-colors duration-300 before:content-[''] before:block before:w-6 before:h-px before:bg-dark before:-translate-y-[6px] before:transition-all after:content-[''] after:block after:w-6 after:h-px after:bg-dark after:translate-y-[6px] after:transition-all"></div>
            )}
          </button>

          {/* Logo */}
          <Link to="/" className="flex-1 flex justify-center">
            <div className="text-dark font-serif font-normal tracking-tight leading-none text-xl uppercase">
              CIGARRO
            </div>
          </Link>

          {/* Search Button */}
          <button 
            type="button"
            className="flex items-center justify-center h-[50px] px-4 border-l border-coyote rounded-tr-md transition-colors duration-300 hover:bg-creme-light"
            onClick={() => setIsSearchOpen(true)}
            aria-label="Search"
          >
            <Search className="w-6 h-6 text-dark" strokeWidth={1.5} />
          </button>
        </div>
        </div>
      </header>

      {/* Search Sidebar - Standardized Mobile Sidebar */}
      <div
        className={`md:hidden fixed inset-0 z-[9999] transition-opacity duration-300 ${isSearchOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        aria-hidden={!isSearchOpen}
        onClick={handleSearchClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50" />

        {/* Right-side drawer - Standardized Mobile Sidebar */}
        <div
          className={`fixed right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-background border-l border-border shadow-xl transform transition-transform duration-300 ease-out will-change-transform flex flex-col ${isSearchOpen ? 'translate-x-0' : 'translate-x-full'}`}
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
            
            {/* FROZEN HEADER */}
            <div className="flex-shrink-0 p-4 border-b border-border bg-background/95 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={handleSearchClose}
                  className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors duration-200 hover:bg-muted/50"
                  aria-label="Close search"
                >
                  <X className="w-6 h-6 text-foreground" />
                </button>
                <h2 className="text-foreground font-sans font-semibold text-lg flex-1">Search Products</h2>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search products..."
                  className="w-full pl-10 pr-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground animate-spin" />
                )}
              </div>
            </div>

          {/* SCROLLABLE CONTENT */}
          <div className="flex-1 overflow-y-auto overscroll-y-bounce">
            {showResults ? (
              <>
                {searchResults.length > 0 ? (
                  <div className="p-4">
                    <div className="mb-4">
                      <h3 className="text-foreground font-sans font-semibold text-base">
                        {searchResults.length} {searchResults.length === 1 ? 'product' : 'products'} found
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {searchResults.map((result) => (
                        <Link
                          key={`${result.item_type}-${result.id}`}
                          to={`/product/${result.slug}`}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors border border-border/20 hover:border-border/40"
                          onClick={handleSearchClose}
                        >
                          <div className="flex-shrink-0">
                            <img
                              src={getProductImageUrl(result.gallery_images?.[0])}
                              alt={result.name}
                              className="w-12 h-12 rounded-lg object-cover bg-white"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = getProductImageUrl();
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-accent text-xs font-semibold uppercase tracking-wider font-sans truncate">
                              {result.brand || 'Premium'}
                            </p>
                            <h4 className="text-foreground font-sans font-semibold text-sm leading-tight line-clamp-2">
                              {result.name}
                            </h4>
                            <div className="text-foreground font-bold text-base font-sans mt-1">
                              {formatINR(result.base_price)}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : searchQuery.trim() && !isSearching ? (
                  <div className="p-8 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/20 flex items-center justify-center">
                      <Search className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-foreground font-sans font-semibold text-lg mb-2">No products found</h3>
                    <p className="text-muted-foreground font-sans mb-4">
                      Try searching with different keywords
                    </p>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/20 flex items-center justify-center">
                  <Search className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-foreground font-sans font-semibold text-lg mb-2">Start typing to search</h3>
                <p className="text-muted-foreground font-sans">
                  Find your favorite tobacco products
                </p>
              </div>
            )}
          </div>

          {/* FROZEN FOOTER */}
          {showResults && searchResults.length >= 6 && (
            <div className="flex-shrink-0 p-4 border-t border-border bg-background/95 backdrop-blur-sm">
              <Link
                to={`/products?search=${encodeURIComponent(searchQuery)}`}
                className="block w-full text-center bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors duration-300 text-sm uppercase tracking-wide"
                onClick={handleSearchClose}
              >
                View all results for "{searchQuery}"
              </Link>
            </div>
          )}
          
          {showResults && searchQuery.trim() && !isSearching && searchResults.length === 0 && (
            <div className="flex-shrink-0 p-4 border-t border-border bg-background/95 backdrop-blur-sm">
              <Link
                to="/products"
                className="block w-full text-center bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors duration-300 text-sm uppercase tracking-wide"
                onClick={handleSearchClose}
              >
                Browse All Products
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
