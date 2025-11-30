// Cloudflare Worker for Categories with Edge Caching
// Caching: Requires Cache Rule in Cloudflare Dashboard
// Cache Rule: URI Path starts with /api/ → Eligible for cache (24h TTL)
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

    // Fetch categories with products using direct query (not broken RPC)
    const { data: rawData, error } = await supabase
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
      .order('name');

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

    // Transform data to flatten products and add image info
    const data = (rawData || []).map(cat => {
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
        products,
        product_count: products.length
      };
    }).filter(cat => cat.products.length > 0);

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
