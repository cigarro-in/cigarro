// Cloudflare Worker for Featured Products with Edge Caching
// Caching: Requires Cache Rule in Cloudflare Dashboard
// Cache Rule: URI Path starts with /api/ → Eligible for cache (24h TTL)
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

    // Fetch featured products (fallback to latest active products since is_featured was removed)
    const { data: rawData, error } = await supabase
      .from('products')
      .select(`
        id, name, slug, description,
        created_at, updated_at,
        brand:brands(name, slug),
        product_variants(id, variant_name, variant_type, price, images, is_active)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      throw new Error(error.message);
    }

    // Transform data
    const data = rawData.map(product => {
      const activeVariants = product.product_variants?.filter(v => v.is_active !== false) || [];
      const defaultVariant = activeVariants[0];

      return {
        ...product,
        brand: product.brand?.name || 'Unknown',
        price: defaultVariant?.price || 0,
        gallery_images: activeVariants.flatMap(v => v.images || []),
        image: defaultVariant?.images?.[0] || null,
        is_featured: true // Dummy value
      };
    });

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
