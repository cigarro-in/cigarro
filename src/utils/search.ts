// Enhanced Search System for Variants and Combos
import { supabase } from '../utils/supabase/client';
import { logger } from './logger';
import { SearchResult, SearchQueryParse } from '../types/variants';

// Variant keyword mapping for intelligent search
const VARIANT_KEYWORDS = {
  'packet': ['packet', 'pack', 'single', '1s', 'one'],
  'carton': ['carton', 'box', 'pack of 10', '10s', 'ten'],
  'half carton': ['half carton', 'half box', 'pack of 5', '5s', 'five'],
  'combo': ['combo', 'combo pack', 'bundle', 'special offer', 'deal', 'pack']
};

// Parse search query to identify variant types and intent
export const parseSearchQuery = (query: string): SearchQueryParse => {
  const queryLower = query.toLowerCase().trim();
  
  // Determine if search is looking for specific variant
  let targetVariant: string | undefined;
  let isComboSearch = false;
  
  // Check for variant keywords
  for (const [variant, keywords] of Object.entries(VARIANT_KEYWORDS)) {
    if (keywords.some(keyword => queryLower.includes(keyword))) {
      if (variant === 'combo') {
        isComboSearch = true;
      } else {
        targetVariant = variant;
      }
      break;
    }
  }
  
  // Clean query by removing variant keywords
  let cleanQuery = queryLower;
  Object.values(VARIANT_KEYWORDS).flat().forEach(keyword => {
    cleanQuery = cleanQuery.replace(new RegExp(`\\b${keyword}\\b`, 'gi'), '').trim();
  });
  
  return {
    original_query: query,
    clean_query: cleanQuery,
    target_variant: targetVariant,
    is_combo_search: isComboSearch,
    variant_keywords: Object.keys(VARIANT_KEYWORDS),
    combo_keywords: VARIANT_KEYWORDS.combo
  };
};

// Enhanced search scoring algorithm
export const calculateEnhancedSearchScore = (
  item: SearchResult, 
  query: string, 
  targetVariant?: string,
  isComboSearch: boolean = false
): number => {
  const queryLower = query.toLowerCase();
  const nameLower = item.name.toLowerCase();
  const brandLower = item.brand.toLowerCase();
  const variantLower = (item.variant_name || '').toLowerCase();
  
  let score = 0;

  // Exact variant match gets highest priority
  if (targetVariant && variantLower === targetVariant.toLowerCase()) {
    score += 2000;
  }

  // Combo search priority
  if (isComboSearch && item.item_type === 'combo') {
    score += 1500;
  }

  // Exact matches
  if (nameLower === queryLower) score += 1000;
  if (brandLower === queryLower) score += 800;
  if (variantLower === queryLower) score += 1200;

  // Starts with matches
  if (nameLower.startsWith(queryLower)) score += 500;
  if (brandLower.startsWith(queryLower)) score += 400;
  if (variantLower.startsWith(queryLower)) score += 600;

  // Contains matches
  if (nameLower.includes(queryLower)) score += 300;
  if (brandLower.includes(queryLower)) score += 200;
  if (variantLower.includes(queryLower)) score += 400;

  // Word boundary matches
  const nameWords = nameLower.split(/\s+/);
  const brandWords = brandLower.split(/\s+/);
  const variantWords = variantLower.split(/\s+/);
  const queryWords = queryLower.split(/\s+/);

  // Check for word matches in name
  queryWords.forEach(queryWord => {
    if (nameWords.includes(queryWord)) score += 150;
    if (brandWords.includes(queryWord)) score += 100;
    if (variantWords.includes(queryWord)) score += 200;
  });

  // Boost score for products with higher ratings
  if (item.rating) score += item.rating * 10;

  // Boost score for variants when searching for specific variant
  if (targetVariant && item.item_type === 'variant') {
    score += 100;
  }

  // Boost score for combos when searching for combos
  if (isComboSearch && item.item_type === 'combo') {
    score += 200;
  }

  return score;
};

// Main enhanced search function
export const searchProductsEnhanced = async (query: string): Promise<SearchResult[]> => {
  if (!query.trim()) return [];

  const queryParse = parseSearchQuery(query);
  
  try {
    // Use secure function instead of direct materialized view access
    const { data, error } = await supabase
      .rpc('get_searchable_products', { search_query: queryParse.clean_query })
      .limit(20);

    if (error) {
      logger.error('Enhanced search error:', error);
      // Fallback to basic search
      return await searchProductsBasic(query);
    }

    // Enhanced scoring algorithm
    const scoredResults = (data || []).map(item => {
      const score = calculateEnhancedSearchScore(
        item as SearchResult, 
        queryParse.clean_query, 
        queryParse.target_variant, 
        queryParse.is_combo_search
      );
      
      return {
        ...item,
        search_score: score,
        matched_variant: queryParse.target_variant,
        matched_combo: queryParse.is_combo_search ? item.combo_name : undefined
      } as SearchResult;
    });

    // Sort by score and return top results
    return scoredResults
      .sort((a, b) => b.search_score - a.search_score)
      .slice(0, 8);

  } catch (error) {
    logger.error('Enhanced search error:', error);
    // Fallback to basic search
    return await searchProductsBasic(query);
  }
};

// Fallback basic search function
export const searchProductsBasic = async (query: string): Promise<SearchResult[]> => {
  try {
    // Use secure function instead of direct materialized view access
    const { data, error } = await supabase
      .rpc('get_searchable_products', { search_query: query })
      .limit(8);

    if (error) throw error;

    const queryParse = parseSearchQuery(query);
    
    // Apply basic scoring
    const scoredResults = (data || []).map(item => {
      const score = calculateEnhancedSearchScore(
        item as SearchResult, 
        query, 
        queryParse.target_variant, 
        queryParse.is_combo_search
      );
      
      return {
        ...item,
        search_score: score,
        matched_variant: queryParse.target_variant,
        matched_combo: queryParse.is_combo_search ? item.combo_name : undefined
      } as SearchResult;
    });

    return scoredResults.sort((a, b) => b.search_score - a.search_score);

  } catch (error) {
    logger.error('Basic search error:', error);
    return [];
  }
};

// Search suggestions based on variants and combos
export const getSearchSuggestions = async (query: string): Promise<string[]> => {
  if (!query.trim()) return [];

  try {
    const { data, error } = await supabase
      .from('searchable_products')
      .select('name, brand, variant_name, combo_name')
      .or(`name.ilike.%${query}%,brand.ilike.%${query}%,variant_name.ilike.%${query}%`)
      .limit(5);

    if (error) throw error;

    const suggestions = new Set<string>();
    
    (data || []).forEach(item => {
      // Add product name suggestions
      if (item.name.toLowerCase().includes(query.toLowerCase())) {
        suggestions.add(item.name);
      }
      
      // Add brand suggestions
      if (item.brand.toLowerCase().includes(query.toLowerCase())) {
        suggestions.add(item.brand);
      }
      
      // Add variant suggestions
      if (item.variant_name && item.variant_name.toLowerCase().includes(query.toLowerCase())) {
        suggestions.add(`${item.name} ${item.variant_name}`);
      }
      
      // Add combo suggestions
      if (item.combo_name && item.combo_name.toLowerCase().includes(query.toLowerCase())) {
        suggestions.add(item.combo_name);
      }
    });

    return Array.from(suggestions).slice(0, 5);

  } catch (error) {
    console.error('Search suggestions error:', error);
    return [];
  }
};

// Get popular search terms (for analytics)
export const getPopularSearchTerms = async (limit: number = 10): Promise<string[]> => {
  try {
    // This would typically come from a search analytics table
    // For now, return common tobacco industry terms
    return [
      'Marlboro',
      'Gold Flake',
      'Carton',
      'Packet',
      'Combo Pack',
      'Cigarettes',
      'Tobacco',
      'Special Offer',
      'Bundle',
      'Deal'
    ].slice(0, limit);

  } catch (error) {
    console.error('Popular search terms error:', error);
    return [];
  }
};

// Search result grouping (group variants by product)
export const groupSearchResults = (results: SearchResult[]): {
  products: SearchResult[];
  variants: { [productId: string]: SearchResult[] };
  combos: SearchResult[];
} => {
  const products: SearchResult[] = [];
  const variants: { [productId: string]: SearchResult[] } = {};
  const combos: SearchResult[] = [];

  results.forEach(result => {
    if (result.item_type === 'combo') {
      combos.push(result);
    } else if (result.item_type === 'variant') {
      if (!variants[result.id]) {
        variants[result.id] = [];
      }
      variants[result.id].push(result);
    } else {
      products.push(result);
    }
  });

  return { products, variants, combos };
};

// Refresh the materialized view (call this when products/variants/combos are updated)
export const refreshSearchableProducts = async (): Promise<void> => {
  try {
    const { error } = await supabase.rpc('refresh_searchable_products');
    if (error) throw error;
  } catch (error) {
    console.error('Error refreshing searchable products:', error);
  }
};
