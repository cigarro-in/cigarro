// Cloudflare Worker for Homepage Data with Edge Caching
// Caches featured products, categories, hero data for ultra-fast homepage
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
    const cacheKey = new Request('https://cigarro.in/api/homepage-data', request);
    const cache = caches.default;

    // Try cache first
    let response = await cache.match(cacheKey);

    if (response) {
      const newHeaders = new Headers(response.headers);
      newHeaders.set('X-Cache-Status', 'HIT');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    }

    // Initialize Supabase
    const supabase = createClient(
      env.SUPABASE_URL,
      env.VITE_SUPABASE_ANON_KEY
    );

    // Fetch all homepage data in parallel
    const [featuredProducts, categories, heroSlides] = await Promise.all([
      // Featured products
      supabase
        .from('products')
        .select('id, name, slug, brand, price, gallery_images, rating, review_count, is_featured')
        .eq('is_active', true)
        .eq('is_featured', true)
        .limit(12),
      
      // Categories for scroller
      supabase
        .from('categories')
        .select('id, name, slug, image')
        .limit(20),
      
      // Hero slides
      supabase
        .from('hero_slides')
        .select('*')
        .eq('is_active', true)
        .order('order', { ascending: true })
        .limit(10)
    ]);

    // Check for errors
    if (featuredProducts.error || categories.error || heroSlides.error) {
      throw new Error('Failed to fetch homepage data');
    }

    const data = {
      featuredProducts: featuredProducts.data || [],
      categories: categories.data || [],
      heroSlides: heroSlides.data || [],
    };

    // Create response
    response = new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400', // 24 hours
        'CDN-Cache-Control': 'max-age=86400',
        'Cloudflare-CDN-Cache-Control': 'max-age=86400',
        'X-Cache-Status': 'MISS',
        ...corsHeaders,
      },
    });

    // Store in cache
    context.waitUntil(cache.put(cacheKey, response.clone()));

    return response;

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
