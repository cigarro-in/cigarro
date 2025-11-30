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

    // Fetch all active products with full details for product pages
    const { data: productsData, error } = await supabase
      .from('products')
      .select(`
        id, name, slug, brand_id, description, short_description, 
        is_active, origin, specifications, 
        meta_title, meta_description, canonical_url,
        created_at, updated_at,
        brand:brands(id, name, slug),
        product_variants(id, variant_name, variant_type, price, stock, images, is_active, is_default),
        categories:product_categories(category:categories(id, name, slug))
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
      const defaultVariant = activeVariants.find(v => v.is_default) || activeVariants[0];
      const images = activeVariants.flatMap(v => v.images || []);
      
      // Flatten categories
      const categories = (product.categories || [])
        .map(pc => pc.category)
        .filter(Boolean);
      
      return {
        ...product,
        brand: Array.isArray(product.brand) ? product.brand[0] : product.brand,
        categories,
        price: defaultVariant?.price || 0,
        gallery_images: images,
        image: images[0] || null
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
