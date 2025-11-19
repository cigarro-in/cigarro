// Cloudflare Worker for Featured Products with Edge Caching
// Caches featured products for homepage and featured sections
// URL: https://cigarro.in/api/featured-products

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
    console.log('🔍 Featured products API request received');

    // Initialize Supabase
    const supabase = createClient(
      env.VITE_SUPABASE_URL,
      env.VITE_SUPABASE_ANON_KEY
    );

    // Fetch featured products
    const { data, error } = await supabase
      .from('products')
      .select('id, name, slug, brand, price, gallery_images, rating, review_count, is_featured')
      .eq('is_active', true)
      .eq('is_featured', true)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      throw new Error(error.message);
    }

    console.log(`✅ Fetched ${data?.length || 0} featured products`);

    // Return response - Cloudflare CDN will cache automatically
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
    console.error('Featured products API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch featured products', details: error.message }),
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
