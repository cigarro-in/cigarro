// Cloudflare Worker for Products Listing with Edge Caching
// Caching: Requires Cache Rule in Cloudflare Dashboard
// Cache Rule: URI Path starts with /api/ → Eligible for cache (24h TTL)
// URL: https://cigarro.in/api/products
// Wave 3: reads from Convex (fullCatalog bundle). Output shape is the exact
// legacy Supabase JSON (snake_case, UUID ids, ISO timestamps, explicit
// nulls) so storefront consumers are untouched.

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

// Supabase timestamptz serializes "+00:00"; Date.toISOString gives "Z".
const iso = (ms) => (ms == null ? null : new Date(ms).toISOString().replace('Z', '+00:00'));

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

    const convexUrl = env.VITE_CONVEX_URL || 'https://proper-coyote-383.convex.cloud';
    const bundle = await cxQuery(convexUrl, 'catalog:fullCatalog', {});
    const brandById = new Map((bundle.brands || []).map((b) => [b.supabaseId, b]));
    const catsByProduct = new Map();
    const catById = new Map((bundle.categories || []).map((c) => [c.supabaseId, c]));
    for (const j of bundle.productCategories || []) {
      const c = catById.get(j.categorySupabaseId);
      if (!c) continue;
      if (!catsByProduct.has(j.productSupabaseId)) catsByProduct.set(j.productSupabaseId, []);
      // Legacy join shape: [{ category: {...} }] — the transform below flattens.
      catsByProduct.get(j.productSupabaseId).push({ category: { id: c.supabaseId, name: c.name, slug: c.slug } });
    }
    const variantsByProduct = new Map();
    for (const x of bundle.variants || []) {
      if (!variantsByProduct.has(x.productSupabaseId)) variantsByProduct.set(x.productSupabaseId, []);
      variantsByProduct.get(x.productSupabaseId).push({
        id: x.supabaseId,
        variant_name: x.variantName,
        variant_type: x.variantType,
        price: x.priceRupees,
        stock: x.stock,
        images: x.images ?? [],
        is_active: x.isActive,
        is_default: x.isDefault,
      });
    }

    const rows = (bundle.products || [])
      .filter((p) => p.isActive)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, 500)
      .map((p) => {
        const b = p.brandSupabaseId ? brandById.get(p.brandSupabaseId) : null;
        return {
          id: p.supabaseId,
          name: p.name,
          slug: p.slug,
          brand_id: p.brandSupabaseId ?? null,
          description: p.description ?? null,
          short_description: p.shortDescription ?? null,
          is_active: p.isActive,
          origin: p.origin ?? null,
          specifications: p.specifications ?? null,
          meta_title: p.metaTitle ?? null,
          meta_description: p.metaDescription ?? null,
          canonical_url: p.canonicalUrl ?? null,
          created_at: iso(p.createdAt),
          updated_at: iso(p.updatedAt),
          brand: b ? { id: b.supabaseId, name: b.name, slug: b.slug } : null,
          product_variants: variantsByProduct.get(p.supabaseId) || [],
          categories: catsByProduct.get(p.supabaseId) || [],
        };
      });

    // Transform data to match expected frontend structure
    const formattedData = rows.map((product) => {
      // Find default or first active variant
      const activeVariants = product.product_variants?.filter((v) => v.is_active !== false) || [];
      const defaultVariant = activeVariants.find((v) => v.is_default) || activeVariants[0];
      const images = activeVariants.flatMap((v) => v.images || []);

      // Flatten categories
      const categories = (product.categories || [])
        .map((pc) => pc.category)
        .filter(Boolean);

      return {
        ...product,
        brand: Array.isArray(product.brand) ? product.brand[0] : product.brand,
        categories,
        price: defaultVariant?.price || 0,
        gallery_images: images,
        image: images[0] || null,
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
    return new Response(JSON.stringify({ error: 'Failed to fetch products', details: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
}
