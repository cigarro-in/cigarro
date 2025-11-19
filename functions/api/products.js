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
    console.log('🔍 Products API request received');

    // Initialize Supabase
    const supabase = createClient(
      env.VITE_SUPABASE_URL,
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

    console.log(`✅ Fetched ${data?.length || 0} products`);

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
