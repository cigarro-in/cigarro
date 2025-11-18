// Cloudflare Worker to Invalidate Categories Cache
// Call this after updating products/categories in admin
// URL: https://cigarro.in/api/invalidate-cache

export async function onRequest(context) {
  const { request, env } = context;
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  try {
    // Optional: Add authentication
    const authHeader = request.headers.get('Authorization');
    const expectedToken = env.CACHE_INVALIDATION_TOKEN; // Set this in Cloudflare env vars
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Get cache
    const cache = caches.default;
    
    // List of all cached endpoints to invalidate
    const cacheKeys = [
      'https://cigarro.in/api/categories',
      'https://cigarro.in/api/products',
      'https://cigarro.in/api/featured-products',
      'https://cigarro.in/api/brands',
      'https://cigarro.in/api/homepage-data',
    ];

    // Delete all caches
    const results = await Promise.all(
      cacheKeys.map(async (key) => {
        const deleted = await cache.delete(new Request(key));
        return { key, deleted };
      })
    );

    const deletedCount = results.filter(r => r.deleted).length;
    console.log('🗑️ Cache invalidation:', results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Cache invalidated successfully! Cleared ${deletedCount}/${cacheKeys.length} caches.`,
        results: results 
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error) {
    console.error('Cache invalidation error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to invalidate cache', details: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}
