import React, { useState, useEffect, useRef } from 'react';
import { Search, Menu, X, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase/client';
import { Product } from '../../hooks/useCart';
import { SearchResult } from '../../types/variants';
import { formatINR } from '../../utils/currency';
import { getProductImageUrl } from '../../lib/supabase/storage';
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
      {/* Mobile Header */}
      <header className="mobile-header lg:hidden fixed top-0 left-0 right-0 z-[9999] bg-transparent pointer-events-none">
        <div className="px-3 py-2 pointer-events-auto">
        <div className="bg-creme/90 backdrop-blur-sm border border-coyote/30 rounded-lg h-12 sm:h-14 flex items-center justify-between shadow-sm">
          {/* Menu Button - Touch-friendly */}
          <button 
            type="button" 
            className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 border-r border-coyote/30 rounded-l-lg hover:bg-coyote/10 active:bg-coyote/20 transition-colors duration-200"
            onClick={onMenuToggle}
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {isMenuOpen ? (
              <X className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-dark" strokeWidth={1.5} />
            ) : (
              <div className="inline-block relative w-4 h-px sm:w-5 md:w-6 bg-dark before:content-[''] before:block before:w-4 sm:before:w-5 md:before:w-6 before:h-px before:bg-dark before:-translate-y-[5px] sm:before:-translate-y-[6px] before:transition-all after:content-[''] after:block after:w-4 sm:after:w-5 md:after:w-6 after:h-px after:bg-dark after:translate-y-[5px] sm:after:translate-y-[6px] after:transition-all"></div>
            )}
          </button>

          {/* Logo */}
          <Link to="/" className="flex-1 flex justify-center">
            <h1 className="text-dark font-serif font-normal tracking-tight leading-none text-lg sm:text-xl uppercase">
              CIGARRO
            </h1>
          </Link>

          {/* Search Button - Touch-friendly */}
          <button 
            type="button"
            className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 border-l border-coyote/30 rounded-r-lg hover:bg-coyote/10 active:bg-coyote/20 transition-colors duration-200"
            onClick={() => setIsSearchOpen(true)}
            aria-label="Search"
          >
            <Search className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-dark" strokeWidth={1.5} />
          </button>
        </div>
        </div>
      </header>

      {/* Search Sidebar - Reverted to Sidebar but "Better" (Solid Luxury) */}
      <div
        className={`md:hidden fixed inset-0 z-[99999] transition-opacity duration-300 ${isSearchOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        aria-hidden={!isSearchOpen}
        onClick={handleSearchClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

        {/* Right-side Sidebar */}
        <div
          className={`fixed right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-background border-l border-coyote shadow-2xl transform transition-transform duration-300 ease-out will-change-transform flex flex-col ${isSearchOpen ? 'translate-x-0' : 'translate-x-full'}`}
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
            
            {/* Header */}
            <div className="flex-shrink-0 p-4 bg-background">
              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={handleSearchClose}
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-muted/10 hover:bg-muted/20 transition-colors text-foreground"
                  aria-label="Close search"
                >
                  <X className="w-5 h-5" />
                </button>
                <h2 className="text-foreground font-serif text-xl flex-1">Search</h2>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="What are you looking for?"
                  className="w-full pl-10 pr-4 py-3 bg-input border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground animate-spin" />
                )}
              </div>
            </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto overscroll-y-bounce bg-background">
            {showResults ? (
              <>
                {searchResults.length > 0 ? (
                  <div className="p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-muted-foreground font-sans font-bold text-xs uppercase tracking-widest">
                        Results ({searchResults.length})
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {searchResults.map((result) => (
                        <Link
                          key={`${result.item_type}-${result.id}`}
                          to={`/product/${result.slug}`}
                          className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/40 shadow-sm hover:border-primary/50 transition-all"
                          onClick={handleSearchClose}
                        >
                          <div className="flex-shrink-0 border border-border/10 rounded-lg overflow-hidden">
                            <img
                              src={getProductImageUrl(result.gallery_images?.[0])}
                              alt={result.name}
                              className="w-14 h-14 object-cover bg-muted/20"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = getProductImageUrl();
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-primary text-[10px] font-bold uppercase tracking-wider font-sans truncate mb-1">
                              {result.brand || 'Premium'}
                            </p>
                            <h4 className="text-foreground font-sans font-medium text-sm leading-tight line-clamp-2 mb-1">
                              {result.name}
                            </h4>
                            <div className="text-foreground font-bold text-base font-sans">
                              {formatINR(result.base_price)}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : searchQuery.trim() && !isSearching ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center h-64">
                    <div className="w-16 h-16 mb-4 rounded-full bg-muted/10 flex items-center justify-center">
                      <Search className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-foreground font-serif text-lg mb-2">No matches found</h3>
                    <p className="text-muted-foreground font-sans text-sm">
                      Try checking your spelling or use different keywords
                    </p>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="p-8 text-center flex flex-col items-center justify-center h-64">
                <div className="w-16 h-16 mb-4 rounded-full bg-muted/10 flex items-center justify-center">
                  <Search className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-foreground font-serif text-lg mb-2">Start typing...</h3>
                <p className="text-muted-foreground font-sans text-sm">
                  Search for your favorite brands or products
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          {showResults && searchResults.length >= 6 && (
            <div className="flex-shrink-0 p-4 bg-background">
              <Link
                to={`/products?search=${encodeURIComponent(searchQuery)}`}
                className="block w-full text-center bg-primary text-primary-foreground py-3.5 rounded-full font-medium hover:bg-primary/90 transition-colors duration-300 text-sm uppercase tracking-wide shadow-lg"
                onClick={handleSearchClose}
              >
                View all results
              </Link>
            </div>
          )}
          
          {showResults && searchQuery.trim() && !isSearching && searchResults.length === 0 && (
            <div className="flex-shrink-0 p-4 bg-background">
              <Link
                to="/products"
                className="block w-full text-center bg-primary text-primary-foreground py-3.5 rounded-full font-medium hover:bg-primary/90 transition-colors duration-300 text-sm uppercase tracking-wide shadow-lg"
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
