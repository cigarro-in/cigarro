// Cloudflare Worker for Homepage Data with Edge Caching
// Caching: Requires Cache Rule in Cloudflare Dashboard (see setup guide below)
// Cache Rule: URI Path starts with /api/ → Eligible for cache (24h TTL)
// URL: https://cigarro.in/api/homepage-data

import { createClient } from '@supabase/supabase-js';

export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Homepage data request received');

    // Initialize Supabase
    const supabase = createClient(
      env.VITE_SUPABASE_URL,
      env.VITE_SUPABASE_ANON_KEY
    );

    // Fetch all homepage data in parallel
    const [featuredProducts, categories, brands, heroSlides, sectionConfig, showcaseConfig, blogPosts, showcaseProducts, blogSectionConfig, categoriesWithProducts] = await Promise.all([
      // Featured products
      supabase
        .from('products')
        .select(`
          id, name, slug, brand_id, description, is_active, created_at,
          brand:brands(id, name),
          product_variants(id, price, images, is_active, is_default, variant_name)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(12),

      // Categories for scroller and grid
      supabase
        .from('categories')
        .select('id, name, slug, image, description')
        .order('name')
        .limit(20),

      // Brands for scroller
      supabase
        .from('brands')
        .select('id, name, slug, description, logo_url, is_active')
        .eq('is_active', true)
        .order('name')
        .limit(20),

      // Hero slides
      supabase
        .from('hero_slides')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(10),

      // Featured Products Section Config
      supabase
        .from('section_configurations')
        .select('title, subtitle, description, button_text, button_url, is_enabled')
        .eq('section_name', 'featured_products')
        .single(),

      // Product Showcase Section Config
      supabase
        .from('section_configurations')
        .select('title, background_image, button_text, button_url, is_enabled')
        .eq('section_name', 'product_showcase')
        .single(),

      // Blog Posts
      supabase
        .from('blog_posts')
        .select(`
          id, title, slug, excerpt, featured_image, published_at, reading_time,
          author:profiles(name, email),
          category:blog_categories(name, color)
        `)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(6),

      // Showcase Products (6 products for the grid) - use different sort for variety
      supabase
        .from('products')
        .select(`
          id, name, slug, brand_id, description, is_active, created_at,
          brand:brands(id, name),
          product_variants(id, price, images, is_active, is_default, variant_name)
        `)
        .eq('is_active', true)
        .order('name', { ascending: true })
        .limit(6),

      // Blog Section Config
      supabase
        .from('section_configurations')
        .select('title, subtitle, description')
        .eq('section_name', 'blog_section')
        .single(),

      // Categories with products for CategoryShowcases (mobile)
      supabase
        .from('categories')
        .select(`
          id, name, slug, description, image,
          products:product_categories(
            products(
              id, name, slug, brand_id, description, is_active, created_at,
              brand:brands(id, name),
              product_variants(id, price, images, is_active, is_default, variant_name)
            )
          )
        `)
        .order('name')
        .limit(6)
    ]);

    // Check for errors with detailed logging
    if (featuredProducts.error) {
      console.error('Featured products error:', featuredProducts.error);
      throw new Error(`Featured products: ${featuredProducts.error.message}`);
    }
    if (categories.error) {
      console.error('Categories error:', categories.error);
      throw new Error(`Categories: ${categories.error.message}`);
    }
    if (brands.error) {
      console.error('Brands error:', brands.error);
      throw new Error(`Brands: ${brands.error.message}`);
    }
    if (heroSlides.error) {
      console.error('Hero slides error:', heroSlides.error);
      throw new Error(`Hero slides: ${heroSlides.error.message}`);
    }
    if (sectionConfig.error) {
      console.error('Section config error:', sectionConfig.error);
      throw new Error(`Section config: ${sectionConfig.error.message}`);
    }
    if (showcaseConfig.error) {
      console.error('Showcase config error:', showcaseConfig.error);
      throw new Error(`Showcase config: ${showcaseConfig.error.message}`);
    }
    if (showcaseProducts.error) {
      console.error('Showcase products error:', showcaseProducts.error);
      throw new Error(`Showcase products: ${showcaseProducts.error.message}`);
    }
    if (blogPosts.error) {
      console.error('Blog posts error:', blogPosts.error);
      throw new Error(`Blog posts: ${blogPosts.error.message}`);
    }
    if (blogSectionConfig.error) {
      console.error('Blog section config error:', blogSectionConfig.error);
      throw new Error(`Blog section config: ${blogSectionConfig.error.message}`);
    }
    if (categoriesWithProducts.error) {
      console.error('Categories with products error:', categoriesWithProducts.error);
      throw new Error(`Categories with products: ${categoriesWithProducts.error.message}`);
    }

    // Transform products to include gallery_images from variants and fix brand format
    const transformProducts = (products) => {
      return (products || []).map(product => {
        const activeVariants = product.product_variants?.filter(v => v.is_active !== false) || [];
        const images = activeVariants.flatMap(v => v.images || []);
        return {
          ...product,
          brand: Array.isArray(product.brand) ? product.brand[0] : product.brand,
          gallery_images: images,
          image: images[0] || null,
        };
      });
    };

    const transformedFeaturedProducts = transformProducts(featuredProducts.data);
    const transformedShowcaseProducts = transformProducts(showcaseProducts.data);

    // Transform categories with products
    const transformedCategoriesWithProducts = (categoriesWithProducts.data || []).map(cat => {
      const products = (cat.products || [])
        .map(pc => pc.products)
        .filter(p => p && p.is_active)
        .map(p => {
          const activeVariants = p.product_variants?.filter(v => v.is_active !== false) || [];
          const images = activeVariants.flatMap(v => v.images || []);
          return {
            ...p,
            brand: Array.isArray(p.brand) ? p.brand[0] : p.brand,
            gallery_images: images,
            image: images[0] || null
          };
        });
      return {
        ...cat,
        products
      };
    }).filter(cat => cat.products.length > 0);

    const data = {
      featuredProducts: transformedFeaturedProducts,
      categories: categories.data || [],
      brands: brands.data || [],
      heroSlides: heroSlides.data || [],
      featuredSectionConfig: sectionConfig.data || null,
      showcaseConfig: showcaseConfig.data || null,
      showcaseProducts: transformedShowcaseProducts,
      blogPosts: blogPosts.data || [],
      blogSectionConfig: blogSectionConfig.data || null,
      categoriesWithProducts: transformedCategoriesWithProducts
    };

    console.log('✅ Homepage data fetched successfully');

    // Return response with proper caching headers
    // Cloudflare will automatically cache this based on Cache-Control
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // Cache for 24 hours in Cloudflare's CDN
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'CDN-Cache-Control': 'max-age=86400',
        ...corsHeaders,
      },
    });

  } catch (error) {
    console.error('Homepage data error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch homepage data', details: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
}
