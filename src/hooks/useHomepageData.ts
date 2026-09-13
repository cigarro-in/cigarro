import { HomepageData, HeroSlide, SectionConfig, ShowcaseConfig, BlogSectionConfig, BlogPost } from '../types/home';
import { supabase } from '../lib/supabase/client';
import { useCached } from '../lib/cache/swrCache';
import { useHeroSlides, useSectionConfig, useBlogPosts } from './data/useContent';

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

  // Wave 2: heroes, section configs, and homepage blog posts read from
  // Convex (realtime). Catalog (products/categories/brands) stays on the
  // cached API/Supabase path until Wave 3. Convex wins when present;
  // the cached payload is the fallback so the page never hangs if a
  // subscription is slow.
  const { slides, loading: slidesLoading } = useHeroSlides();
  const { config: featuredCfg } = useSectionConfig('featured_products');
  const { config: showcaseCfg } = useSectionConfig('product_showcase');
  const { config: blogSecCfg } = useSectionConfig('blog_section');
  const { posts: convexPosts } = useBlogPosts(6);

  const merged: HomepageData | undefined = data
    ? {
        ...data,
        heroSlides:
          !slidesLoading && slides.length > 0
            ? slides.map(mapHeroSlide)
            : data.heroSlides,
        featuredSectionConfig:
          featuredCfg != null ? mapSection(featuredCfg) : data.featuredSectionConfig,
        showcaseConfig:
          showcaseCfg != null ? mapShowcase(showcaseCfg) : data.showcaseConfig,
        blogSectionConfig:
          blogSecCfg != null ? mapBlogSection(blogSecCfg) : data.blogSectionConfig,
        blogPosts:
          convexPosts.length > 0 ? convexPosts.map(mapHomePost) : data.blogPosts,
      }
    : data;

  return { data: merged, isLoading, error };
}

// ---------- Convex (camelCase + compat aliases) -> home shapes ----------

function mapHeroSlide(s: any): HeroSlide {
  return {
    id: String(s._id ?? s.id),
    title: s.title ?? '',
    suptitle: s.suptitle,
    description: s.description,
    image_url: s.image_url ?? s.imageUrl ?? '',
    mobile_image_url: s.mobile_image_url ?? s.mobileImageUrl,
    button_text: s.button_text ?? s.buttonText,
    button_url: s.button_url ?? s.buttonUrl,
    product_name: s.product_name ?? s.productName,
    product_price:
      s.product_price ??
      (s.productPrice != null ? String(s.productPrice) : undefined),
    product_image_url: s.product_image_url ?? s.productImageUrl,
    is_active: s.is_active ?? true,
    sort_order: s.sort_order ?? s.sortOrder ?? 0,
  };
}

function mapSection(c: any): SectionConfig {
  return {
    title: c.title ?? '',
    subtitle: c.subtitle,
    description: c.description,
    button_text: c.button_text ?? c.buttonText,
    button_url: c.button_url ?? c.buttonUrl,
    is_enabled: c.is_enabled ?? c.isEnabled,
  };
}

function mapShowcase(c: any): ShowcaseConfig {
  return {
    title: c.title,
    background_image: c.background_image ?? c.backgroundImage,
    button_text: c.button_text ?? c.buttonText,
    button_url: c.button_url ?? c.buttonUrl,
    is_enabled: c.is_enabled ?? c.isEnabled,
  };
}

function mapBlogSection(c: any): BlogSectionConfig {
  return {
    title: c.title,
    subtitle: c.subtitle,
    description: c.description,
  };
}

function mapHomePost(p: any): BlogPost {
  return {
    id: String(p._id ?? p.id),
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    featured_image: p.featured_image ?? p.featuredImage,
    published_at: p.published_at ?? '',
    reading_time: p.reading_time ?? p.readingTime,
    author: p.author ?? (p.authorName ? { name: p.authorName } : undefined),
    category: p.category,
  };
}
