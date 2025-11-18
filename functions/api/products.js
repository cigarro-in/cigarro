// Cloudflare Worker for Products Listing with Edge Caching
// Caches all active products for products page
// URL: https://cigarro.in/api/products

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
    const cacheKey = new Request('https://cigarro.in/api/products', request);
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

    // Fetch all active products with variants
    const { data, error } = await supabase
      .from('products')
      .select(`
        id, name, slug, brand, price, description,
        gallery_images, rating, review_count, is_featured,
        created_at, updated_at,
        product_variants(id, variant_name, variant_type, price, is_active)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      throw new Error(error.message);
    }

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
    console.error('Products API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch products', details: error.message }),
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
