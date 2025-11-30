// Cloudflare Worker for Products Listing with Edge Caching
// Caching: Requires Cache Rule in Cloudflare Dashboard
// Cache Rule: URI Path starts with /api/ → Eligible for cache (24h TTL)
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

    // Fetch all active products with variants and brand
    const { data: productsData, error } = await supabase
      .from('products')
      .select(`
        id, name, slug, description,
        created_at, updated_at,
        brand:brands(name, slug),
        product_variants(id, variant_name, variant_type, price, images, is_active)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      throw new Error(error.message);
    }

    // Transform data to match expected frontend structure
    const formattedData = productsData.map(product => {
      // Find default or first active variant
      const activeVariants = product.product_variants?.filter(v => v.is_active !== false) || [];
      const defaultVariant = activeVariants[0]; // Assuming order returned is sufficient or first is default enough
      
      return {
        ...product,
        brand: product.brand?.name || 'Unknown',
        price: defaultVariant?.price || 0,
        gallery_images: activeVariants.flatMap(v => v.images || []),
        image: defaultVariant?.images?.[0] || null,
        // Add dummy values for removed columns if needed by frontend types
        rating: 0,
        review_count: 0,
        is_featured: false 
      };
    });

    console.log(`✅ Fetched ${formattedData?.length || 0} products`);

    // Return response - Cloudflare CDN will cache automatically
    return new Response(JSON.stringify(formattedData), {
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
