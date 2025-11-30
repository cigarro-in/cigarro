import { useState, useEffect } from 'react';
import { HomepageData } from '../types/home';
import { supabase } from '../lib/supabase/client';

const API_URL = '/api/homepage-data';

// Transform products to include gallery_images from variants
function transformProducts(products: any[]) {
  return (products || []).map(product => {
    const activeVariants = product.product_variants?.filter((v: any) => v.is_active !== false) || [];
    const images = activeVariants.flatMap((v: any) => v.images || []);
    return {
      ...product,
      gallery_images: images,
      image: images[0] || null,
    };
  });
}

// Fallback: fetch directly from Supabase (for local development)
async function fetchFromSupabase(): Promise<HomepageData> {
  const [featuredProducts, categories, brands, heroSlides, sectionConfig, showcaseConfig, blogPosts, showcaseProducts, blogSectionConfig, categoriesWithProductsResult] = await Promise.all([
    supabase.from('products').select(`id, name, slug, brand_id, description, is_active, created_at, brand:brands(id, name), product_variants(id, price, images, is_active, is_default, variant_name)`).eq('is_active', true).order('created_at', { ascending: false }).limit(12),
    supabase.from('categories').select('id, name, slug, image, description').order('name').limit(20),
    supabase.from('brands').select('id, name, slug, description, logo_url, is_active').eq('is_active', true).order('name').limit(20),
    supabase.from('hero_slides').select('*').eq('is_active', true).order('sort_order', { ascending: true }).limit(10),
    supabase.from('section_configurations').select('title, subtitle, description, button_text, button_url, is_enabled').eq('section_name', 'featured_products').single(),
    supabase.from('section_configurations').select('title, background_image, button_text, button_url, is_enabled').eq('section_name', 'product_showcase').single(),
    supabase.from('blog_posts').select(`id, title, slug, excerpt, featured_image, published_at, reading_time, author:profiles(name, email), category:blog_categories(name, color)`).eq('status', 'published').order('published_at', { ascending: false }).limit(6),
    supabase.from('products').select(`id, name, slug, brand_id, description, is_active, created_at, brand:brands(id, name), product_variants(id, price, images, is_active, is_default, variant_name)`).eq('is_active', true).order('name', { ascending: true }).limit(6),
    supabase.from('section_configurations').select('title, subtitle, description').eq('section_name', 'blog_section').single(),
    supabase.from('categories').select(`id, name, slug, description, image, products:product_categories(products(id, name, slug, brand_id, description, is_active, created_at, brand:brands(id, name), product_variants(id, price, images, is_active, is_default, variant_name)))`).order('name').limit(6)
  ]);

  // Transform blog posts to flatten author/category from arrays
  const transformedBlogPosts = (blogPosts.data || []).map((post: any) => ({
    ...post,
    author: Array.isArray(post.author) ? post.author[0] : post.author,
    category: Array.isArray(post.category) ? post.category[0] : post.category
  }));

  // Transform categories with products
  const categoriesWithProducts = (categoriesWithProductsResult.data || []).map((cat: any) => {
    const products = (cat.products || [])
      .map((pc: any) => pc.products)
      .filter((p: any) => p && p.is_active)
      .map((p: any) => {
        const activeVariants = p.product_variants?.filter((v: any) => v.is_active !== false) || [];
        const images = activeVariants.flatMap((v: any) => v.images || []);
        return {
          ...p,
          brand: Array.isArray(p.brand) ? p.brand[0] : p.brand,
          gallery_images: images,
          image: images[0] || null
        };
      });
    return { ...cat, products };
  }).filter((cat: any) => cat.products.length > 0);

  return {
    featuredProducts: transformProducts(featuredProducts.data || []),
    categories: categories.data || [],
    brands: brands.data || [],
    heroSlides: heroSlides.data || [],
    featuredSectionConfig: sectionConfig.data || null,
    showcaseConfig: showcaseConfig.data || null,
    showcaseProducts: transformProducts(showcaseProducts.data || []),
    blogPosts: transformedBlogPosts,
    blogSectionConfig: blogSectionConfig.data || null,
    categoriesWithProducts
  };
}

export function useHomepageData() {
  const [data, setData] = useState<HomepageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Try the edge-cached API first (works in production on Cloudflare Pages)
        const response = await fetch(API_URL);
        
        // Check if response is JSON (API available) or HTML (404/dev mode)
        const contentType = response.headers.get('content-type');
        if (response.ok && contentType?.includes('application/json')) {
          const result = await response.json();
          console.log('🌐 API Response categoriesWithProducts:', result.categoriesWithProducts);
          setData(result);
          return;
        }
        
        // Fallback: fetch directly from Supabase (local development)
        if (import.meta.env.DEV) {
          console.log('📦 Using Supabase fallback (dev mode)');
        }
        const fallbackData = await fetchFromSupabase();
        setData(fallbackData);
      } catch (err) {
        console.error('Error fetching homepage data:', err);
        // Try Supabase fallback on any error
        try {
          const fallbackData = await fetchFromSupabase();
          setData(fallbackData);
        } catch (fallbackErr) {
          setError(fallbackErr instanceof Error ? fallbackErr : new Error('Unknown error'));
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  return {
    data,
    isLoading,
    error
  };
}
