// Cloudflare Worker for Categories API with Edge Caching
// Caches category data at the edge for ultra-fast response times
// URL: https://cigarro.in/api/categories

import { createClient } from '@supabase/supabase-js';

export async function onRequest(context) {
  const { request, env } = context;
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle OPTIONS request for CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create cache key
    const cacheKey = new Request('https://cigarro.in/api/categories', request);
    const cache = caches.default;

    // Try to get from cache first
    let response = await cache.match(cacheKey);

    if (response) {
      console.log('✅ Cache HIT - Serving from edge');
      // Add cache status header
      const newHeaders = new Headers(response.headers);
      newHeaders.set('X-Cache-Status', 'HIT');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    }

    console.log('❌ Cache MISS - Fetching from Supabase');

    // Initialize Supabase client
    const supabase = createClient(
      env.SUPABASE_URL,
      env.VITE_SUPABASE_ANON_KEY
    );

    // Call the optimized RPC function
    const { data, error } = await supabase.rpc('get_categories_with_products');

    if (error) {
      console.error('Supabase error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch categories', details: error.message }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // Create successful response
    response = new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400', // Cache for 24 hours
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
    console.error('Worker error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
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
