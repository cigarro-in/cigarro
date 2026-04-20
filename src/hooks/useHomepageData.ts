import { HomepageData } from '../types/home';
import { supabase } from '../lib/supabase/client';
import { useCached } from '../lib/cache/swrCache';

const API_URL = '/api/homepage-data';
const CACHE_KEY = 'homepage:v1';
const TTL = 5 * 60_000;

function transformProducts(products: any[]) {
  return (products || []).map((product) => {
    const activeVariants = product.product_variants?.filter((v: any) => v.is_active !== false) || [];
    const images = activeVariants.flatMap((v: any) => v.images || []);
    return {
      ...product,
      gallery_images: images,
      image: images[0] || null,
    };
  });
}

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

  const transformedBlogPosts = (blogPosts.data || []).map((post: any) => ({
    ...post,
    author: Array.isArray(post.author) ? post.author[0] : post.author,
    category: Array.isArray(post.category) ? post.category[0] : post.category
  }));

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

async function fetchHomepageData(): Promise<HomepageData> {
  try {
    const response = await fetch(API_URL);
    const contentType = response.headers.get('content-type');
    if (response.ok && contentType?.includes('application/json')) {
      return (await response.json()) as HomepageData;
    }
  } catch {
    /* fall through to Supabase */
  }
  return fetchFromSupabase();
}

export function useHomepageData() {
  const { data, isLoading, error } = useCached<HomepageData>(
    CACHE_KEY,
    fetchHomepageData,
    { ttl: TTL }
  );

  return { data, isLoading, error };
}
