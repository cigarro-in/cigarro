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
    console.log('🔍 Categories API request received');

    // Initialize Supabase client
    const supabase = createClient(
      env.VITE_SUPABASE_URL,
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
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    console.log(`✅ Fetched ${data?.length || 0} categories with products`);

    // Return response - Cloudflare will cache automatically
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'CDN-Cache-Control': 'max-age=86400',
        ...corsHeaders,
      },
    });

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
