// Local Storage Cache Utility
interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresIn: number;
}

class LocalCache {
  private static instance: LocalCache;
  private cache: Map<string, CacheItem<any>> = new Map();
  
  static getInstance(): LocalCache {
    if (!LocalCache.instance) {
      LocalCache.instance = new LocalCache();
    }
    return LocalCache.instance;
  }

  // Set cache with expiration time in milliseconds (default 15 minutes)
  set<T>(key: string, data: T, expiresIn: number = 15 * 60 * 1000): void {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      expiresIn
    };
    
    this.cache.set(key, item);
    
    // Also store in localStorage for persistence
    try {
      localStorage.setItem(`cache_${key}`, JSON.stringify(item));
    } catch (error) {
      console.warn('Failed to store in localStorage:', error);
    }
  }

  // Get cached data if not expired
  get<T>(key: string): T | null {
    let item = this.cache.get(key);
    
    // If not in memory, try localStorage
    if (!item) {
      try {
        const stored = localStorage.getItem(`cache_${key}`);
        if (stored) {
          item = JSON.parse(stored);
          this.cache.set(key, item!);
        }
      } catch (error) {
        console.warn('Failed to retrieve from localStorage:', error);
      }
    }
    
    if (!item) return null;
    
    const now = Date.now();
    const isExpired = (now - item.timestamp) > item.expiresIn;
    
    if (isExpired) {
      this.delete(key);
      return null;
    }
    
    return item.data;
  }

  // Delete cached item
  delete(key: string): void {
    this.cache.delete(key);
    try {
      localStorage.removeItem(`cache_${key}`);
    } catch (error) {
      console.warn('Failed to remove from localStorage:', error);
    }
  }

  // Clear all cache
  clear(): void {
    this.cache.clear();
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('cache_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Failed to clear localStorage cache:', error);
    }
  }

  // Check if key exists and is not expired
  has(key: string): boolean {
    return this.get(key) !== null;
  }
}

// Cache keys constants
export const CACHE_KEYS = {
  PRODUCTS: 'products',
  CATEGORIES: 'categories', 
  BRANDS: 'brands',
  FILTER_DATA: 'filter_data',
  PRODUCT_DETAIL: (slug: string) => `product_${slug}`,
  SEARCH_RESULTS: (query: string) => `search_${query}`,
  CART_ITEMS: 'cart_items',
  WISHLIST_ITEMS: 'wishlist_items'
} as const;

// Cache durations in milliseconds - More aggressive caching
export const CACHE_DURATION = {
  SHORT: 5 * 60 * 1000,      // 5 minutes
  MEDIUM: 15 * 60 * 1000,    // 15 minutes  
  LONG: 30 * 60 * 1000,      // 30 minutes
  VERY_LONG: 2 * 60 * 60 * 1000  // 2 hours
} as const;

export const cache = LocalCache.getInstance();

// Helper functions for common cache operations
export const cacheHelpers = {
  // Cache products with long duration
  setProducts: (products: any[]) => {
    cache.set(CACHE_KEYS.PRODUCTS, products, CACHE_DURATION.LONG);
  },
  
  getProducts: () => {
    return cache.get<any[]>(CACHE_KEYS.PRODUCTS);
  },
  
  // Cache filter data with very long duration
  setFilterData: (data: any) => {
    cache.set(CACHE_KEYS.FILTER_DATA, data, CACHE_DURATION.VERY_LONG);
  },
  
  getFilterData: () => {
    return cache.get<any>(CACHE_KEYS.FILTER_DATA);
  },
  
  // Cache individual product details
  setProductDetail: (slug: string, product: any) => {
    cache.set(CACHE_KEYS.PRODUCT_DETAIL(slug), product, CACHE_DURATION.LONG);
  },
  
  getProductDetail: (slug: string) => {
    return cache.get<any>(CACHE_KEYS.PRODUCT_DETAIL(slug));
  },
  
  // Cache search results with medium duration
  setSearchResults: (query: string, results: any[]) => {
    cache.set(CACHE_KEYS.SEARCH_RESULTS(query), results, CACHE_DURATION.MEDIUM);
  },
  
  getSearchResults: (query: string) => {
    return cache.get<any[]>(CACHE_KEYS.SEARCH_RESULTS(query));
  }
};
