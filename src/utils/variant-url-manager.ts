// Variant URL Manager - Handle variant selection without page reload
// This utility manages URL state for product variants while maintaining SEO benefits

import React from 'react';
import { VariantURLState } from '../types/product-seo';

export class VariantURLManager {
  private static instance: VariantURLManager;
  private currentState: VariantURLState | null = null;
  private listeners: ((state: VariantURLState) => void)[] = [];

  static getInstance(): VariantURLManager {
    if (!VariantURLManager.instance) {
      VariantURLManager.instance = new VariantURLManager();
    }
    return VariantURLManager.instance;
  }

  /**
   * Update URL and meta tags when variant is selected
   * This maintains SEO benefits without page reload
   */
  updateVariantURL(state: VariantURLState): void {
    this.currentState = state;
    
    // Update browser URL without reload
    const newUrl = state.variantSlug 
      ? `/product/${state.productSlug}?variant=${state.variantSlug}`
      : `/product/${state.productSlug}`;
    
    window.history.replaceState(
      { productSlug: state.productSlug, variantSlug: state.variantSlug },
      state.metaTitle,
      newUrl
    );

    // Update meta tags dynamically
    this.updateMetaTags(state);
    
    // Notify listeners
    this.listeners.forEach(listener => listener(state));
  }

  /**
   * Update meta tags for SEO without page reload
   */
  private updateMetaTags(state: VariantURLState): void {
    // Update title
    document.title = state.metaTitle;

    // Update meta description
    this.updateMetaTag('name', 'description', state.metaDescription);

    // Update canonical URL
    this.updateLinkTag('rel', 'canonical', state.canonicalUrl);

    // Update Open Graph tags
    this.updateMetaTag('property', 'og:title', state.metaTitle);
    this.updateMetaTag('property', 'og:description', state.metaDescription);
    this.updateMetaTag('property', 'og:url', state.canonicalUrl);

    // Update Twitter Card tags
    this.updateMetaTag('name', 'twitter:title', state.metaTitle);
    this.updateMetaTag('name', 'twitter:description', state.metaDescription);

    // Update structured data if variant has specific data
    if (state.selectedVariant) {
      this.updateStructuredData(state);
    }
  }

  /**
   * Update or create meta tag
   */
  private updateMetaTag(attribute: string, value: string, content: string): void {
    let tag = document.querySelector(`meta[${attribute}="${value}"]`) as HTMLMetaElement;
    
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute(attribute, value);
      document.head.appendChild(tag);
    }
    
    tag.content = content;
  }

  /**
   * Update or create link tag
   */
  private updateLinkTag(attribute: string, value: string, href: string): void {
    let tag = document.querySelector(`link[${attribute}="${value}"]`) as HTMLLinkElement;
    
    if (!tag) {
      tag = document.createElement('link');
      tag.setAttribute(attribute, value);
      document.head.appendChild(tag);
    }
    
    tag.href = href;
  }

  /**
   * Update structured data for variant
   */
  private updateStructuredData(state: VariantURLState): void {
    const existingScript = document.querySelector('script[type="application/ld+json"]');
    if (existingScript) {
      existingScript.remove();
    }

    if (state.selectedVariant) {
      const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: `${state.selectedVariant.variant_name}`,
        description: state.selectedVariant.meta_description || state.metaDescription,
        url: state.canonicalUrl,
        offers: {
          '@type': 'Offer',
          price: state.selectedVariant.price,
          priceCurrency: 'INR',
          availability: state.selectedVariant.stock > 0 
            ? 'https://schema.org/InStock' 
            : 'https://schema.org/OutOfStock'
        }
      };

      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }
  }

  /**
   * Subscribe to URL state changes
   */
  subscribe(listener: (state: VariantURLState) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get current state
   */
  getCurrentState(): VariantURLState | null {
    return this.currentState;
  }

  /**
   * Parse current URL to extract variant information
   */
  parseCurrentURL(): { productSlug: string; variantSlug?: string } {
    const path = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    
    const productSlugMatch = path.match(/\/product\/([^\/]+)/);
    const productSlug = productSlugMatch ? productSlugMatch[1] : '';
    const variantSlug = searchParams.get('variant') || undefined;
    
    return { productSlug, variantSlug };
  }

  /**
   * Generate SEO-friendly variant URL
   */
  generateVariantURL(productSlug: string, variantSlug?: string): string {
    const baseUrl = window.location.origin;
    const productUrl = `${baseUrl}/product/${productSlug}`;
    
    return variantSlug ? `${productUrl}?variant=${variantSlug}` : productUrl;
  }

  /**
   * Generate canonical URL for variant
   */
  generateCanonicalURL(productSlug: string, variantSlug?: string): string {
    return this.generateVariantURL(productSlug, variantSlug);
  }

  /**
   * Handle browser back/forward navigation
   */
  handlePopState(event: PopStateEvent): void {
    if (event.state && event.state.productSlug) {
      const { productSlug, variantSlug } = event.state;
      
      // Trigger variant change without updating URL again
      if (this.currentState) {
        const newState: VariantURLState = {
          ...this.currentState,
          productSlug,
          variantSlug,
          canonicalUrl: this.generateCanonicalURL(productSlug, variantSlug)
        };
        
        this.currentState = newState;
        this.updateMetaTags(newState);
        this.listeners.forEach(listener => listener(newState));
      }
    }
  }

  /**
   * Initialize the URL manager
   */
  initialize(): void {
    // Listen for browser navigation
    window.addEventListener('popstate', (event) => this.handlePopState(event));
  }

  /**
   * Clean up the URL manager
   */
  destroy(): void {
    window.removeEventListener('popstate', (event) => this.handlePopState(event));
    this.listeners = [];
    this.currentState = null;
  }
}

// Export singleton instance
export const variantURLManager = VariantURLManager.getInstance();

// React hook for using variant URL manager
export function useVariantURL() {
  const [currentState, setCurrentState] = React.useState<VariantURLState | null>(
    variantURLManager.getCurrentState()
  );

  React.useEffect(() => {
    const unsubscribe = variantURLManager.subscribe(setCurrentState);
    return unsubscribe;
  }, []);

  const updateVariantURL = React.useCallback((state: VariantURLState) => {
    variantURLManager.updateVariantURL(state);
  }, []);

  const parseCurrentURL = React.useCallback(() => {
    return variantURLManager.parseCurrentURL();
  }, []);

  return {
    currentState,
    updateVariantURL,
    parseCurrentURL,
    generateVariantURL: variantURLManager.generateVariantURL.bind(variantURLManager),
    generateCanonicalURL: variantURLManager.generateCanonicalURL.bind(variantURLManager)
  };
}

// SEO utilities for variants
export const variantSEOUtils = {
  /**
   * Generate meta title for variant
   */
  generateVariantMetaTitle(productName: string, variantName: string, brand: string): string {
    return `${productName} - ${variantName} | ${brand} | Premium Quality`;
  },

  /**
   * Generate meta description for variant
   */
  generateVariantMetaDescription(productName: string, variantName: string, price: number): string {
    return `Buy ${productName} - ${variantName} for ₹${price}. Premium quality, fast delivery, authentic products. Order now!`;
  },

  /**
   * Generate variant slug from name
   */
  generateVariantSlug(variantName: string): string {
    return variantName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  },

  /**
   * Validate SEO completeness for variant
   */
  validateVariantSEO(variant: any): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    if (!variant.meta_title || variant.meta_title.length < 30) {
      issues.push('Meta title should be at least 30 characters');
    }
    
    if (!variant.meta_description || variant.meta_description.length < 120) {
      issues.push('Meta description should be at least 120 characters');
    }
    
    if (!variant.variant_slug) {
      issues.push('Variant slug is required for SEO URLs');
    }
    
    // Images are managed centrally; if present, accept either variant_images or images
    const imgs = (variant.variant_images || variant.images || []) as any[];
    if (!Array.isArray(imgs)) {
      // do not block; images may be assigned from product-level gallery
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
};
