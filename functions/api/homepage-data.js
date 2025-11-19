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
        .order('sort_order', { ascending: true })
        .limit(10)
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
    if (heroSlides.error) {
      console.error('Hero slides error:', heroSlides.error);
      throw new Error(`Hero slides: ${heroSlides.error.message}`);
    }

    const data = {
      featuredProducts: featuredProducts.data || [],
      categories: categories.data || [],
      heroSlides: heroSlides.data || [],
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
