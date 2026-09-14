/**
 * Image Processing API - Cloudflare Pages Function
 *
 * Downloads external images and stores them in R2 (bucket `cigarro-assets`,
 * binding `ASSETS`), returning CDN URLs.
 *
 * NOTE: no server-side conversion — the browser pipeline (canvas → WebP,
 * metadata stripped, q0.82) handles optimization for direct uploads. Remote
 * imports are stored as-is (CORS prevents client-side fetch); prefer the
 * upload endpoint for new assets.
 *
 * POST /api/images/process
 * Body: { urls: string[], folder?: string }
 *
 * Returns: { success: true, images: [{ original: string, uploaded: string }] }
 */

export async function onRequest(context) {
    const { request, env } = context;

    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: corsHeaders,
        });
    }

    try {
        const body = await request.json();
        const { urls, folder = '' } = body;

        console.log('[process] Received request with', urls?.length || 0, 'URLs');
        console.log('[process] Folder:', folder);
        console.log('[process] URLs:', JSON.stringify(urls));

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            console.log('[process] ERROR: No valid URLs provided');
            return new Response(JSON.stringify({ error: 'urls array is required' }), {
                status: 400,
                headers: corsHeaders,
            });
        }

        // R2 config (binding ASSETS). Public reads via CDN base.
        const cdnBase = (env.CDN_BASE_URL || 'https://cdn.cigarro.in').replace(/\/$/, '');
        const BUCKET_PREFIX = 'asset_images/';
        const cleanFolder = String(folder).replace(/^\/+|\/+$/g, '').replace(/\.\./g, '').slice(0, 100);

        if (!env.ASSETS) {
            return new Response(JSON.stringify({ error: 'R2 binding ASSETS missing' }), {
                status: 500,
                headers: corsHeaders,
            });
        }

        const results = [];

        for (const originalUrl of urls) {
            console.log('[process] Processing URL:', originalUrl);
            try {
                // Fetch the image
                const imageResponse = await fetch(originalUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'image/*',
                    },
                });

                if (!imageResponse.ok) {
                    console.error(`Failed to fetch ${originalUrl}: ${imageResponse.status}`);
                    results.push({ original: originalUrl, error: 'Failed to fetch' });
                    continue;
                }

                // Get the image as a blob
                const imageBlob = await imageResponse.blob();

                // For now, we'll upload the image as-is since Cloudflare Workers
                // don't have native image processing. Consider using Cloudflare Images
                // or a library like @cloudflare/worker-sentry for WebP conversion.

                // Generate unique filename (stored as-is; see header note)
                const timestamp = Date.now();
                const random = Math.random().toString(36).substring(2, 8);
                const extension = getExtensionFromUrl(originalUrl) || 'jpg';
                const filename = `${timestamp}-${random}.${extension}`;
                const key = `${BUCKET_PREFIX}${cleanFolder ? cleanFolder + '/' : ''}${filename}`;

                console.log('[process] Storing to R2 key:', key);
                console.log('[process] Blob size:', imageBlob.size, 'type:', imageBlob.type);

                // Upload to R2
                try {
                    await env.ASSETS.put(key, imageBlob, {
                        httpMetadata: {
                            contentType: imageBlob.type || 'image/jpeg',
                            cacheControl: 'public, max-age=31536000, immutable',
                        },
                    });
                } catch (putErr) {
                    console.error(`[process] R2 put failed for ${originalUrl}:`, putErr.message);
                    results.push({ original: originalUrl, error: `Upload failed: ${putErr.message}` });
                    continue;
                }

                // Construct CDN URL
                const publicUrl = `${cdnBase}/${key}`;

                results.push({
                    original: originalUrl,
                    uploaded: publicUrl,
                    size: imageBlob.size,
                    type: imageBlob.type,
                });

            } catch (err) {
                console.error(`Error processing ${originalUrl}:`, err);
                results.push({ original: originalUrl, error: err.message });
            }
        }

        const successful = results.filter(r => r.uploaded);
        const failed = results.filter(r => r.error);

        return new Response(JSON.stringify({
            success: true,
            processed: successful.length,
            failed: failed.length,
            images: results,
        }), { headers: corsHeaders });

    } catch (error) {
        console.error('Process error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: corsHeaders,
        });
    }
}

function getExtensionFromUrl(url) {
    try {
        const pathname = new URL(url).pathname;
        const match = pathname.match(/\.(jpg|jpeg|png|webp|gif|avif)$/i);
        return match ? match[1].toLowerCase() : null;
    } catch {
        return null;
    }
}
