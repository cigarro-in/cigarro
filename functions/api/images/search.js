// Cloudflare Worker for Image Search using DuckDuckGo
// Free image search API - no API key required
// URL: https://cigarro.in/api/images/search?q=product+name

export async function onRequest(context) {
    const { request } = context;

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

    try {
        // Append product context for better results
        const searchQuery = `${query} product`;

        // Step 1: Get the vqd token from DuckDuckGo
        const tokenUrl = `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&iax=images&ia=images`;
        const tokenResponse = await fetch(tokenUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
        });

        const html = await tokenResponse.text();

        // Extract vqd token from response
        const vqdMatch = html.match(/vqd=["']?([^"'&]+)/);
        if (!vqdMatch) {
            console.log('[ImageSearch] Could not extract vqd token');
            return new Response(
                JSON.stringify({ images: [], error: 'Token extraction failed' }),
                { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
        }

        const vqd = vqdMatch[1];

        // Step 2: Fetch the images
        const imageUrl = `https://duckduckgo.com/i.js?l=wt-wt&o=json&q=${encodeURIComponent(searchQuery)}&vqd=${vqd}&f=,,,,,&p=1`;

        const imageResponse = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Referer': 'https://duckduckgo.com/',
            },
        });

        if (!imageResponse.ok) {
            console.log('[ImageSearch] DuckDuckGo response not ok:', imageResponse.status);
            return new Response(
                JSON.stringify({ images: [] }),
                { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
        }

        const data = await imageResponse.json();

        // Extract and format image URLs (16 images for 4x4 grid)
        const images = (data.results || [])
            .slice(0, 16)
            .map((img) => ({
                url: img.image,
                thumbnail: img.thumbnail,
                title: img.title || '',
                source: img.source || '',
                width: img.width,
                height: img.height,
            }));

        console.log(`[ImageSearch] Found ${images.length} images for "${query}"`);

        return new Response(JSON.stringify({ images, query }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
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
