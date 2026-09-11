// Cloudflare Function for Image Search using Brave Search API
// Key-based API (DDG scraping died: i.js 403s). Key lives in Cloudflare env
// as BRAVE_API_KEY (Secret) — never in code. Same {images[]} shape back.
// URL: https://cigarro.in/api/images/search?q=product+name

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

    const url = new URL(request.url);
    const query = url.searchParams.get('q');

    if (!query) {
        return new Response(
            JSON.stringify({ error: 'Missing query parameter', images: [] }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
    }

    const apiKey = env.BRAVE_API_KEY;
    if (!apiKey) {
        console.log('[ImageSearch] BRAVE_API_KEY not configured');
        return new Response(
            JSON.stringify({ images: [], error: 'Image search not configured' }),
            { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
    }

    try {
        // Append product context for better results (as before)
        const searchQuery = `${query} product`;

        const braveUrl = `https://api.search.brave.com/res/v1/images/search?q=${encodeURIComponent(searchQuery)}&count=20&country=IN&search_lang=en&safesearch=strict`;
        const braveResponse = await fetch(braveUrl, {
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip',
                'X-Subscription-Token': apiKey,
            },
        });

        if (!braveResponse.ok) {
            console.log('[ImageSearch] Brave response not ok:', braveResponse.status);
            return new Response(
                JSON.stringify({ images: [], error: `Search failed (${braveResponse.status})` }),
                { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
        }

        const data = await braveResponse.json();

        // Map to the modal's shape (16 images for 4x4 grid).
        // thumbnail.src = Brave proxy (reliable for grid display);
        // properties.url = original (best for upload).
        const images = (data.results || [])
            .map((img) => {
                const original = img.properties && img.properties.url;
                const thumb = img.thumbnail && img.thumbnail.src;
                return {
                    url: original || thumb || '',
                    thumbnail: thumb || original || '',
                    title: img.title || '',
                    source: img.url || '',
                    width: (img.properties && img.properties.width) || undefined,
                    height: (img.properties && img.properties.height) || undefined,
                };
            })
            .filter((img) => img.url)
            .slice(0, 16);

        console.log(`[ImageSearch] Found ${images.length} images for "${query}"`);

        return new Response(JSON.stringify({ images, query }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=3600', // Cache 1h — Brave bills per request
                ...corsHeaders,
            },
        });

    } catch (error) {
        console.error('[ImageSearch] Error:', error);
        return new Response(
            JSON.stringify({ error: 'Failed to search images', images: [] }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
    }
}
