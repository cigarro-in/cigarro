// Cloudflare Worker to Purge CDN Cache
// Purges Cloudflare's CDN cache for all API endpoints
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
    console.log('🗑️ Cache purge requested');

    // Optional: Add authentication
    const authHeader = request.headers.get('Authorization');
    const expectedToken = env.CACHE_INVALIDATION_TOKEN;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // List of all API endpoints to purge from CDN cache
    const urlsToPurge = [
      'https://cigarro.in/api/homepage-data',
      'https://cigarro.in/api/categories',
      'https://cigarro.in/api/products',
      'https://cigarro.in/api/brands',
    ];

    // Purge each URL by making a request with Cache-Control: no-cache
    // This forces Cloudflare to fetch fresh content from origin
    const purgeResults = await Promise.all(
      urlsToPurge.map(async (url) => {
        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
            },
            cf: {
              cacheTtl: 0,
              cacheEverything: false,
            }
          });
          
          console.log(`✅ Purged: ${url} (${response.status})`);
          return { url, success: response.ok, status: response.status };
        } catch (err) {
          console.error(`❌ Failed to purge: ${url}`, err);
          return { url, success: false, error: err.message };
        }
      })
    );

    const successCount = purgeResults.filter(r => r.success).length;
    console.log(`🗑️ Cache purge complete: ${successCount}/${urlsToPurge.length} successful`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Cache purged! ${successCount}/${urlsToPurge.length} endpoints refreshed. Next request will be MISS, then cached.`,
        results: purgeResults 
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error) {
    console.error('Cache purge error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to purge cache', details: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}
