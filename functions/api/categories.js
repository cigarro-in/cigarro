// Cloudflare Worker for Categories with Edge Caching
// Caching: Requires Cache Rule in Cloudflare Dashboard
// Cache Rule: URI Path starts with /api/ → Eligible for cache (24h TTL)
// URL: https://cigarro.in/api/categories
// Wave 3: reads from Convex (fullCatalog bundle). Output shape is the exact
// legacy Supabase JSON so consumers are untouched.

async function cxQuery(baseUrl, path, args) {
  const res = await fetch(`${baseUrl}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, args, format: 'json' }),
  });
  const body = await res.json();
  if (body.status !== 'success') throw new Error(`Convex ${path} failed`);
  return body.value;
}

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

import { requiredConvexUrl } from '../lib/env.js';
    const convexUrl = requiredConvexUrl(env);
    const bundle = await cxQuery(convexUrl, 'catalog:fullCatalog', {});
    const brandById = new Map((bundle.brands || []).map((b) => [b.supabaseId, b]));
    const variantsByProduct = new Map();
    for (const x of bundle.variants || []) {
      if (!variantsByProduct.has(x.productSupabaseId)) variantsByProduct.set(x.productSupabaseId, []);
      variantsByProduct.get(x.productSupabaseId).push(x);
    }
    const joinsByCategory = new Map();
    for (const j of bundle.productCategories || []) {
      if (!joinsByCategory.has(j.categorySupabaseId)) joinsByCategory.set(j.categorySupabaseId, []);
      joinsByCategory.get(j.categorySupabaseId).push(j);
    }
    const productById = new Map((bundle.products || []).map((p) => [p.supabaseId, p]));

    const shapeVariant = (x) => ({
      id: x.supabaseId,
      price: x.priceRupees,
      images: x.images ?? [],
      is_active: x.isActive,
      is_default: x.isDefault,
      variant_name: x.variantName,
    });

    const shapeProduct = (p) => {
      const b = p.brandSupabaseId ? brandById.get(p.brandSupabaseId) : null;
      return {
        id: p.supabaseId,
        name: p.name,
        slug: p.slug,
        brand_id: p.brandSupabaseId ?? null,
        description: p.description ?? null,
        is_active: p.isActive,
        created_at: p.createdAt ? new Date(p.createdAt).toISOString().replace('Z', '+00:00') : null,
        brand: b ? { id: b.supabaseId, name: b.name } : null,
        product_variants: (variantsByProduct.get(p.supabaseId) || []).map(shapeVariant),
      };
    };

    // Legacy: categories name-ascending with nested active products.
    const rawData = (bundle.categories || [])
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .map((c) => ({
        id: c.supabaseId,
        name: c.name,
        slug: c.slug,
        description: c.description ?? null,
        image: c.image ?? null,
        products: (joinsByCategory.get(c.supabaseId) || []).map((j) => ({
          products: productById.has(j.productSupabaseId)
            ? shapeProduct(productById.get(j.productSupabaseId))
            : null,
        })),
      }));

    // Transform data to flatten products and add image info
    const data = (rawData || [])
      .map((cat) => {
        const products = (cat.products || [])
          .map((pc) => pc.products)
          .filter((p) => p && p.is_active)
          .map((p) => {
            const activeVariants = p.product_variants?.filter((v) => v.is_active !== false) || [];
            const images = activeVariants.flatMap((v) => v.images || []);
            return {
              ...p,
              brand: Array.isArray(p.brand) ? p.brand[0] : p.brand,
              gallery_images: images,
              image: images[0] || null,
            };
          });
        return {
          ...cat,
          products,
          product_count: products.length,
        };
      })
      .filter((cat) => cat.products.length > 0);

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
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
}
